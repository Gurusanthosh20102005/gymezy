import mongoose from 'mongoose';
import { Gym } from '../models/gym.model.js';
import { Employee } from '../models/employee.model.js';
import { Membership } from '../models/membership.model.js';
import { Section } from '../models/section.model.js';
import { Wallet } from '../models/wallet.model.js';
import { User } from '../models/user.model.js';
import { PaymentTransaction } from '../models/paymentTransaction.model.js';
import { ProrationEngine } from '../services/proration.service.js';
import {
  createRazorpayOrder,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from '../services/razorpay.service.js';
import { ENV } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { createMembership, requestSwitchPlan, resolveTargetPlanDetails } from './membership.controller.js';
import { createBooking } from './booking.controller.js';
import { topUpWallet } from './wallet.controller.js';

const TIER_PRICE_KEYS = {
  Monthly: 'monthly',
  Quarterly: 'quarterly',
  'Half Yearly': 'halfYearly',
  Annual: 'annual',
};

async function resolveGymDoc(gymId) {
  const normalizedId = typeof gymId === 'object' && gymId !== null
    ? (gymId._id || gymId.id || gymId.partnerId)
    : gymId;
  if (!normalizedId) throw ApiError.badRequest('Gym ID is required.');
  const isObj = mongoose.Types.ObjectId.isValid(normalizedId);
  const gym = await Gym.findOne(
    isObj ? { $or: [{ _id: normalizedId }, { partnerId: normalizedId }] } : { partnerId: normalizedId }
  );
  if (!gym) throw ApiError.notFound('Gym not found.');
  return gym;
}

async function resolveAuthenticatedUserId(req, body = {}) {
  const rawUserId = req.user?.userId || req.user?.id || req.user?._id || body.userId;
  if (rawUserId && mongoose.Types.ObjectId.isValid(rawUserId)) {
    return new mongoose.Types.ObjectId(rawUserId);
  }
  if (req.user?.email || body.email || req.user?.phone || body.phone) {
    const found = await User.findOne({
      $or: [
        { email: req.user?.email || body.email || '' },
        { phone: req.user?.phone || body.phone || '' },
      ],
    }).select('_id');
    if (found) return found._id;
  }
  throw ApiError.unauthorized('User authentication is required for payment.');
}

async function computeAuthoritativeAmountPaise({ flowType, payload, userId }) {
  if (flowType === 'WALLET_TOPUP') {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
      throw ApiError.badRequest('Wallet top-up amount must be between ₹1 and ₹1,00,000.');
    }
    const gym = await resolveGymDoc(payload.gymId);
    return {
      gym,
      totalPaise: Math.round(amount * 100),
      walletAppliedPaise: 0,
      payablePaise: Math.round(amount * 100),
    };
  }

  if (flowType === 'MEMBERSHIP_PURCHASE') {
    const gym = await resolveGymDoc(payload.gymId);
    const tier = payload.membershipTier;
    const priceKey = TIER_PRICE_KEYS[tier];
    if (!priceKey) throw ApiError.badRequest('Invalid membership tier.');
    const basePrice = Number(gym.pricingPlans?.[priceKey] || 0);

    let trainerFee = 0;
    if (payload.trainerId && payload.trainerId !== 'No Personal Trainer') {
      const isTrObj = mongoose.Types.ObjectId.isValid(payload.trainerId);
      const trainer = await Employee.findOne(
        isTrObj ? { $or: [{ _id: payload.trainerId }, { employeeId: payload.trainerId }] } : { employeeId: payload.trainerId }
      );
      if (!trainer || trainer.status !== 'Active') {
        throw ApiError.badRequest('Selected personal trainer is unavailable.');
      }
      trainerFee = Number(trainer.trainerPricing?.[priceKey] || 0);
      if (trainerFee <= 0) {
        throw ApiError.badRequest('Selected trainer does not support this membership tier.');
      }
    }

    const totalPaise = Math.round((basePrice + trainerFee) * 100);
    let walletAppliedPaise = 0;
    if (payload.applyWallet || payload.useWallet) {
      const wallet = await Wallet.findOne({ userId, gymId: gym._id }).select('balancePaise').lean();
      const avail = wallet?.balancePaise || 0;
      const requested = payload.appliedWalletAmount != null
        ? Math.round(Number(payload.appliedWalletAmount) * 100)
        : avail;
      walletAppliedPaise = Math.max(0, Math.min(avail, requested, totalPaise));
    }
    return {
      gym,
      totalPaise,
      walletAppliedPaise,
      payablePaise: Math.max(0, totalPaise - walletAppliedPaise),
    };
  }

  if (flowType === 'BOOKING_PASS') {
    const gym = await resolveGymDoc(payload.gymId);
    let baseSubtotal = 0;
    if (payload.sectionId) {
      const section = await Section.findById(payload.sectionId).select('cost').lean();
      if (!section) throw ApiError.notFound('Selected section/batch not found.');
      baseSubtotal = Number(section.cost || 0);
    } else {
      const daysCount = Array.isArray(payload.customDates) && payload.customDates.length > 0
        ? payload.customDates.length
        : Number(payload.durationDays || 1);
      const dayPrice = Number(gym.singleSessionPrice || gym.pricingPlans?.singleSession || 199);
      let trainerFee = 0;
      if (payload.trainerId) {
        const trainer = await Employee.findById(payload.trainerId).select('trainerPricing').lean();
        trainerFee = Number(trainer?.trainerPricing?.singleSession || 0);
      }
      baseSubtotal = daysCount * (dayPrice + trainerFee);
    }
    const totalPaise = Math.round(Math.max(0, baseSubtotal) * 100);
    let walletAppliedPaise = 0;
    if (payload.applyWallet || payload.useWallet) {
      const wallet = await Wallet.findOne({ userId, gymId: gym._id }).select('balancePaise').lean();
      const avail = wallet?.balancePaise || 0;
      walletAppliedPaise = Math.max(0, Math.min(avail, totalPaise));
    }
    return {
      gym,
      totalPaise,
      walletAppliedPaise,
      payablePaise: Math.max(0, totalPaise - walletAppliedPaise),
    };
  }

  if (flowType === 'PLAN_SWITCH_UPGRADE') {
    const membership = await Membership.findById(payload.membershipId);
    if (!membership) throw ApiError.notFound('Membership not found.');
    const gym = await resolveGymDoc(membership.gymId);
    const targetPlan = resolveTargetPlanDetails(gym, payload.targetTier, payload.targetPlanId);
    const gymSettings = {
      ...(gym.prorationSettings ? (typeof gym.prorationSettings.toObject === 'function' ? gym.prorationSettings.toObject() : gym.prorationSettings) : {}),
      pricingPlans: gym.pricingPlans,
    };
    const quote = ProrationEngine.calculateSwitchQuote({
      currentMembership: membership,
      newPlan: targetPlan,
      gymSettings,
      userWalletBalancePaise: 0,
      downgradeSettlementPreference: payload.downgradeSettlementPreference || 'WALLET',
      switchDate: new Date(),
    });
    const totalPaise = Math.round(Number(quote?.financialBreakdown?.netAmountToPayPaise || 0));
    if (totalPaise <= 0) {
      throw ApiError.badRequest('This plan switch does not require an online upgrade payment.');
    }
    return {
      gym,
      totalPaise,
      walletAppliedPaise: 0,
      payablePaise: totalPaise,
    };
  }

  if (flowType === 'MEMBERSHIP_EXTEND') {
    const membership = await Membership.findById(payload.membershipId);
    if (!membership) throw ApiError.notFound('Membership not found.');
    const gym = await resolveGymDoc(membership.gymId);
    const priceKey = TIER_PRICE_KEYS[payload.extendTier];
    if (!priceKey) throw ApiError.badRequest('Invalid extension tier.');
    const basePrice = Number(gym.pricingPlans?.[priceKey] || 0);
    const totalPaise = Math.round(basePrice * 100);
    return {
      gym,
      totalPaise,
      walletAppliedPaise: 0,
      payablePaise: totalPaise,
    };
  }

  throw ApiError.badRequest(`Unsupported payment flowType: ${flowType}`);
}

/**
 * Invoke an existing Express controller internally and capture its JSON response.
 */
function runControllerInternal(controllerFn, { user, params = {}, body = {} }) {
  return new Promise((resolve, reject) => {
    const fakeReq = { user, params, body, headers: {} };
    const fakeRes = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ statusCode: this.statusCode, payload });
        return this;
      },
    };
    Promise.resolve(
      controllerFn(fakeReq, fakeRes, (err) => {
        if (err) reject(err);
      })
    ).catch(reject);
  });
}

async function fulfillTransaction(txn, userContext) {
  const payload = txn.draftPayload || {};
  const enrichedBody = {
    ...payload,
    userId: txn.userId,
    paymentMethod: 'Razorpay',
    paymentMode: 'Razorpay',
    transactionId: txn.paymentId,
    payment: {
      ...(payload.payment || {}),
      method: 'Razorpay',
      transactionId: txn.paymentId,
      razorpayOrderId: txn.orderId,
      razorpayPaymentId: txn.paymentId,
      status: 'Paid',
    },
  };

  if (txn.flowType === 'MEMBERSHIP_PURCHASE') {
    const result = await runControllerInternal(createMembership, {
      user: userContext,
      body: enrichedBody,
    });
    const doc = result.payload?.data;
    return {
      referenceId: doc?._id || null,
      referenceModel: 'Membership',
      data: doc,
    };
  }

  if (txn.flowType === 'BOOKING_PASS') {
    const result = await runControllerInternal(createBooking, {
      user: userContext,
      body: enrichedBody,
    });
    const doc = result.payload?.data;
    return {
      referenceId: doc?._id || null,
      referenceModel: 'Booking',
      data: doc,
    };
  }

  if (txn.flowType === 'PLAN_SWITCH_UPGRADE') {
    const result = await runControllerInternal(requestSwitchPlan, {
      user: userContext,
      params: { id: payload.membershipId },
      body: enrichedBody,
    });
    const doc = result.payload?.data;
    return {
      referenceId: doc?._id || null,
      referenceModel: 'MembershipSwitchRequest',
      data: doc,
    };
  }

  if (txn.flowType === 'WALLET_TOPUP') {
    const result = await runControllerInternal(topUpWallet, {
      user: userContext,
      body: enrichedBody,
    });
    const doc = result.payload?.data;
    return {
      referenceId: doc?._id || null,
      referenceModel: 'Wallet',
      data: doc,
    };
  }

  throw ApiError.badRequest(`Unsupported fulfillment flowType: ${txn.flowType}`);
}

/**
 * POST /api/v1/payments/create-order
 */
export const createPaymentOrder = async (req, res, next) => {
  try {
    const { flowType, payload = {} } = req.body || {};
    if (!flowType) throw ApiError.badRequest('flowType is required.');

    const userId = await resolveAuthenticatedUserId(req, payload);
    const userDoc = await User.findById(userId).select('fullName email phone').lean();

    const { gym, totalPaise, walletAppliedPaise, payablePaise } =
      await computeAuthoritativeAmountPaise({ flowType, payload, userId });

    if (payablePaise === 0 && walletAppliedPaise > 0) {
      // 100% covered by gym wallet; fulfill directly without Razorpay order
      const fakeTxn = {
        flowType,
        userId,
        gymId: gym._id,
        orderId: `WALLET_${Date.now()}`,
        paymentId: `WALLET_${Date.now()}`,
        draftPayload: { ...payload, applyWallet: true, paymentMethod: 'Wallet' },
      };
      const fulfilled = await fulfillTransaction(fakeTxn, req.user || { userId });
      return res.status(200).json(
        new ApiResponse(200, {
          walletSettled: true,
          payablePaise: 0,
          walletAppliedPaise,
          totalPaise,
          data: fulfilled.data,
        }, 'Settled via Gym Wallet.')
      );
    }

    const order = await createRazorpayOrder({
      amountPaise: payablePaise,
      currency: 'INR',
      receipt: `${flowType.slice(0, 10)}_${Date.now()}`,
      notes: {
        flowType,
        gymId: String(gym._id),
        userId: String(userId),
      },
    });

    const txn = await PaymentTransaction.create({
      orderId: order.id,
      userId,
      gymId: gym._id,
      gymPartnerId: gym.partnerId || '',
      flowType,
      amountPaise: payablePaise,
      walletAppliedPaise,
      currency: order.currency || 'INR',
      status: 'CREATED',
      draftPayload: payload,
    });

    return res.status(201).json(
      new ApiResponse(201, {
        walletSettled: false,
        transactionId: txn._id,
        orderId: order.id,
        amountPaise: payablePaise,
        walletAppliedPaise,
        totalPaise,
        currency: order.currency || 'INR',
        keyId: ENV.RAZORPAY_KEY_ID,
        prefill: {
          name: userDoc?.fullName || '',
          email: userDoc?.email || '',
          contact: userDoc?.phone || '',
        },
      }, 'Razorpay order created successfully.')
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/payments/verify
 */
export const verifyPaymentAndFulfill = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw ApiError.badRequest('razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.');
    }

    const isValidSig = verifyCheckoutSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
    if (!isValidSig) {
      throw ApiError.badRequest('Invalid Razorpay payment signature.');
    }

    const existing = await PaymentTransaction.findOne({ orderId: razorpay_order_id });
    if (!existing) {
      throw ApiError.notFound('Payment order not found.');
    }

    if (existing.status === 'PAID') {
      return res.status(200).json(
        new ApiResponse(200, {
          alreadyProcessed: true,
          transactionId: existing._id,
          paymentId: existing.paymentId,
          referenceId: existing.referenceId,
          referenceModel: existing.referenceModel,
        }, 'Payment already verified.')
      );
    }

    const lockedTxn = await PaymentTransaction.findOneAndUpdate(
      { orderId: razorpay_order_id, status: { $in: ['CREATED', 'FAILED'] } },
      {
        $set: {
          status: 'PROCESSING',
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
        },
      },
      { new: true }
    );

    if (!lockedTxn) {
      const settled = await PaymentTransaction.findOne({ orderId: razorpay_order_id });
      return res.status(200).json(
        new ApiResponse(200, {
          alreadyProcessed: true,
          transactionId: settled?._id,
          paymentId: settled?.paymentId,
          referenceId: settled?.referenceId,
        }, 'Payment is being processed.')
      );
    }

    try {
      const fulfilled = await fulfillTransaction(lockedTxn, req.user || { userId: lockedTxn.userId });
      lockedTxn.status = 'PAID';
      lockedTxn.referenceId = fulfilled.referenceId;
      lockedTxn.referenceModel = fulfilled.referenceModel;
      await lockedTxn.save();

      return res.status(200).json(
        new ApiResponse(200, {
          transactionId: lockedTxn._id,
          orderId: lockedTxn.orderId,
          paymentId: lockedTxn.paymentId,
          referenceId: fulfilled.referenceId,
          referenceModel: fulfilled.referenceModel,
          data: fulfilled.data,
        }, 'Payment verified and fulfilled successfully.')
      );
    } catch (fulfillErr) {
      lockedTxn.status = 'CREATED';
      lockedTxn.failureReason = fulfillErr.message;
      await lockedTxn.save();
      throw fulfillErr;
    }
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/payments/webhook
 */
export const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));

    if (!verifyWebhookSignature({ rawBody, signature })) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    const eventType = event?.event;

    if (eventType === 'payment.captured') {
      const paymentEntity = event?.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      if (orderId && paymentId) {
        const locked = await PaymentTransaction.findOneAndUpdate(
          { orderId, status: 'CREATED' },
          { $set: { status: 'PROCESSING', paymentId } },
          { new: true }
        );
        if (locked) {
          try {
            const fulfilled = await fulfillTransaction(locked, { userId: locked.userId });
            locked.status = 'PAID';
            locked.referenceId = fulfilled.referenceId;
            locked.referenceModel = fulfilled.referenceModel;
            await locked.save();
          } catch (err) {
            locked.status = 'CREATED';
            locked.failureReason = err.message;
            await locked.save();
          }
        }
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = event?.payload?.payment?.entity;
      if (paymentEntity?.order_id) {
        await PaymentTransaction.findOneAndUpdate(
          { orderId: paymentEntity.order_id, status: 'CREATED' },
          {
            $set: {
              status: 'FAILED',
              paymentId: paymentEntity.id || undefined,
              failureReason: paymentEntity.error_description || 'Payment failed',
            },
          }
        );
      }
    } else if (eventType === 'refund.processed') {
      const refundEntity = event?.payload?.refund?.entity;
      if (refundEntity?.payment_id && refundEntity?.id) {
        await PaymentTransaction.findOneAndUpdate(
          { paymentId: refundEntity.payment_id, 'refunds.refundId': refundEntity.id },
          { $set: { 'refunds.$.status': 'PROCESSED' } }
        );
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
};
