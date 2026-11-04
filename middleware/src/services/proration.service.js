import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { Membership } from '../models/membership.model.js';
import { MembershipSwitchRequest } from '../models/membershipSwitchRequest.model.js';
import { Wallet } from '../models/wallet.model.js';
import Employee from '../models/employee.model.js';
import Counter from '../models/counter.model.js';
import { ApiError } from '../utils/apiError.js';

const TIER_PRICE_KEYS = {
  Monthly: 'monthly',
  Quarterly: 'quarterly',
  'Half Yearly': 'halfYearly',
  Annual: 'annual',
};

export class ProrationEngine {
  /**
   * Normalize date to midnight in Asia/Kolkata timezone
   */
  static getKolkataMidnight(date = new Date()) {
    const d = new Date(date);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [year, month, day] = formatter.format(d).split('-');
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0));
  }

  /**
   * Calculate exact calendar days between two dates in Asia/Kolkata
   */
  static diffCalendarDays(startDate, endDate) {
    const start = this.getKolkataMidnight(startDate);
    const end = this.getKolkataMidnight(endDate);
    const msPerDay = 86400000;
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / msPerDay));
  }

  /**
   * Normalize tier name to standard schema enum: 'Monthly', 'Quarterly', 'Half Yearly', 'Annual'
   */
  static normalizeTier(rawTier) {
    if (!rawTier) return 'Monthly';
    const clean = String(rawTier).trim().toLowerCase();
    if (clean.includes('month')) return 'Monthly';
    if (clean.includes('quarter')) return 'Quarterly';
    if (clean.includes('half')) return 'Half Yearly';
    if (clean.includes('annual') || clean.includes('year')) return 'Annual';
    return rawTier;
  }

  /**
   * Compute proration breakdown in Integer Paise
   */
  static calculateSwitchQuote({
    currentMembership,
    newPlan,
    gymSettings,
    userWalletBalancePaise = 0,
    downgradeSettlementPreference,
    switchDate = new Date(),
  }) {
    if (!currentMembership) {
      throw ApiError.badRequest('Current active membership is required for switch calculation.');
    }
    if (!newPlan || typeof newPlan.price !== 'number') {
      throw ApiError.badRequest('Valid target plan with price is required.');
    }

    let currentPricePaise = Math.round(
      (currentMembership.pricing?.totalAmount ??
       currentMembership.pricing?.basePrice ??
       currentMembership.amountPaid ??
       currentMembership.price ??
       0) * 100
    );

    // If pricing is missing from membership, check authentic gym pricing configuration
    if (currentPricePaise === 0 && gymSettings?.pricingPlans) {
      const tier = String(currentMembership.membershipTier || '').toLowerCase();
      let gymPrice = 0;
      if (tier.includes('month')) gymPrice = gymSettings.pricingPlans.monthly;
      else if (tier.includes('quarter')) gymPrice = gymSettings.pricingPlans.quarterly;
      else if (tier.includes('half')) gymPrice = gymSettings.pricingPlans.halfYearly;
      else if (tier.includes('annual') || tier.includes('year')) gymPrice = gymSettings.pricingPlans.annual;

      if (typeof gymPrice === 'number' && gymPrice > 0) {
        currentPricePaise = Math.round(gymPrice * 100);
      }
    }

    if (currentPricePaise <= 0) {
      throw ApiError.badRequest(
        'Unable to calculate switch quote: Membership pricing information is missing or invalid. Please try again or contact gym support.'
      );
    }
    const durationDays = Number(currentMembership.durationDays) || 30;

    // 1. Calculate paused days
    const totalPausedDays = (currentMembership.pauseHistory || []).reduce(
      (sum, p) => sum + (p.daysPaused || 0),
      0
    );

    // 2. Days math
    const daysElapsed = this.diffCalendarDays(currentMembership.startDate, switchDate);
    const daysUsed = Math.max(0, daysElapsed - totalPausedDays);
    const daysRemaining = Math.max(0, durationDays - daysUsed);

    // 3. Rate & Credit calculation
    const perDayCostPaise = durationDays > 0 ? Math.round(currentPricePaise / durationDays) : 0;

    // Credit is 0 if plan is expired or has 0 days remaining
    const creditPaise =
      daysRemaining > 0
        ? Math.min(currentPricePaise, Math.round(daysRemaining * perDayCostPaise))
        : 0;

    const newPricePaise = Math.round(newPlan.price * 100);
    const newDurationDays =
      Number(newPlan.durationDays) ||
      (newPlan.months ? Number(newPlan.months) * 30 : 30);
    const newPerDayCostPaise =
      newDurationDays > 0 ? Math.round(newPricePaise / newDurationDays) : 0;

    const isUpgrade = newPricePaise >= creditPaise;
    const grossAmountToPayPaise = Math.max(0, newPricePaise - creditPaise);
    const leftoverCreditPaise = Math.max(0, creditPaise - newPricePaise);

    // 4. Wallet application to gross payable
    const walletDeductionPaise = Math.min(userWalletBalancePaise, grossAmountToPayPaise);
    const netAmountToPayPaise = grossAmountToPayPaise - walletDeductionPaise;

    // 5. Downgrade policy resolution
    const policy = downgradeSettlementPreference || gymSettings?.downgradePolicy || 'WALLET';
    let extraDays = 0;
    let effectiveNewDurationDays = newDurationDays;
    let leftoverWalletCreditPaise = 0;
    let leftoverRefundPaise = 0;

    if (!isUpgrade && leftoverCreditPaise > 0) {
      if (policy === 'EXTEND' && newPerDayCostPaise > 0) {
        extraDays = Math.floor(leftoverCreditPaise / newPerDayCostPaise);
        effectiveNewDurationDays += extraDays;
        leftoverWalletCreditPaise = leftoverCreditPaise - extraDays * newPerDayCostPaise;
      } else if (policy === 'REFUND') {
        leftoverRefundPaise = leftoverCreditPaise;
      } else {
        // WALLET (Default)
        leftoverWalletCreditPaise = leftoverCreditPaise;
      }
    }

    return {
      switchType: isUpgrade ? 'UPGRADE' : 'DOWNGRADE',
      currentPlan: {
        membershipId: currentMembership.membershipId,
        tier: currentMembership.membershipTier,
        pricePaise: currentPricePaise,
        priceINR: currentPricePaise / 100,
        price: currentPricePaise / 100,
        durationDays,
        daysUsed,
        daysRemaining,
        perDayCostPaise,
        perDayCostINR: perDayCostPaise / 100,
      },
      newPlan: {
        tier: newPlan.tierId || newPlan.name || newPlan.badge,
        name: newPlan.name || newPlan.tierId,
        pricePaise: newPricePaise,
        priceINR: newPricePaise / 100,
        price: newPricePaise / 100,
        baseDurationDays: newDurationDays,
        extraDaysAwarded: extraDays,
        effectiveDurationDays: effectiveNewDurationDays,
        perDayCostPaise: newPerDayCostPaise,
        perDayCostINR: newPerDayCostPaise / 100,
      },
      financialBreakdown: {
        proRatedCreditPaise: creditPaise,
        proRatedCreditINR: creditPaise / 100,
        proRatedCredit: creditPaise / 100,
        grossPayablePaise: grossAmountToPayPaise,
        grossPayableINR: grossAmountToPayPaise / 100,
        grossPayable: grossAmountToPayPaise / 100,
        walletDeductionPaise,
        walletDeductionINR: walletDeductionPaise / 100,
        netAmountToPayPaise,
        netAmountToPayINR: netAmountToPayPaise / 100,
        netAmountToPay: netAmountToPayPaise / 100,
        leftoverCreditPaise,
        leftoverCreditINR: leftoverCreditPaise / 100,
        leftoverCredit: leftoverCreditPaise / 100,
        leftoverWalletCreditPaise,
        leftoverWalletCreditINR: leftoverWalletCreditPaise / 100,
        leftoverRefundPaise,
        leftoverRefundINR: leftoverRefundPaise / 100,
        policyApplied: policy,
      },
    };
  }

  /**
   * Generate sequential Switch Request ID formatted as REQ_SW_{seq}
   */
  static async generateRequestId(gymId) {
    const seqKey = `switch_req_${gymId}`;
    const seq = await Counter.getNextSequence(seqKey);
    return `REQ_SW_${String(seq).padStart(3, '0')}`;
  }

  /**
   * Generate sequential Membership ID formatted as MEM00{seq}
   */
  static async generateMembershipId(gym) {
    const gymSeqKey = `mem_${gym.partnerId || gym._id}`;
    const seq = await Counter.getNextSequence(gymSeqKey);
    return `MEM00${seq}`;
  }

  /**
   * Execute atomic transaction on Super Admin Approval
   */
  static async executeApprovedSwitchTransaction({ switchRequestId, superAdminUser, approvedByUser, remarks = '' }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await MembershipSwitchRequest.findById(switchRequestId)
        .populate('membershipId')
        .populate('gymId')
        .populate('userId')
        .session(session);

      if (!request) {
        throw ApiError.notFound('Switch request not found.');
      }
      if (!['PENDING_GYM_APPROVAL', 'PENDING_GYM_ADMIN_APPROVAL', 'PENDING_SUPER_ADMIN_APPROVAL'].includes(request.status)) {
        throw ApiError.badRequest(
          `Cannot execute switch. Request is in status '${request.status}', expected pending approval status.`
        );
      }

      const currentMembership = request.membershipId;
      const gym = request.gymId;
      const user = request.userId;
      const quote = request.quoteSnapshot;

      // 1. Mark current membership as 'Switched'
      currentMembership.status = 'Switched';
      await currentMembership.save({ session });

      // 2. Calculate new start and end dates
      const newStartDate = new Date();
      const newEndDate = new Date(newStartDate);
      newEndDate.setDate(newEndDate.getDate() + quote.effectiveNewDurationDays);

      const newMembershipId = await this.generateMembershipId(gym);
      const generatedOtp = crypto.randomInt(100000, 1000000).toString();

      const targetTierNormalized = ProrationEngine.normalizeTier(request.targetTier);

      // Compute target trainer fee (if trainer is attached)
      let targetTrainerFee = 0;
      if (currentMembership.hasTrainer && currentMembership.trainerId) {
        const trainerDoc = await Employee.findById(currentMembership.trainerId).session(session);
        if (trainerDoc) {
          const priceKey = TIER_PRICE_KEYS[targetTierNormalized];
          const directFee = trainerDoc.trainerPricing?.[priceKey];
          if (typeof directFee === 'number' && directFee > 0) {
            targetTrainerFee = directFee;
          } else {
            const baseMonthly = Number(trainerDoc.trainerPricing?.monthly) || 0;
            const multiplier = {
              Monthly: 1,
              Quarterly: 3,
              'Half Yearly': 6,
              Annual: 12,
            }[targetTierNormalized] || 1;
            targetTrainerFee = baseMonthly * multiplier;
          }
        }
      }

      const targetBasePrice = quote.newPricePaise / 100;
      const targetTotalAmount = targetBasePrice + targetTrainerFee;

      // 3. Create and activate new Membership
      const [newMembership] = await Membership.create(
        [
          {
            membershipId: newMembershipId,
            gymId: gym._id,
            gymPartnerId: gym.partnerId || '',
            userId: user._id,
            trainerId: currentMembership.trainerId || null,
            hasTrainer: currentMembership.hasTrainer || false,
            trainerSlot: currentMembership.trainerSlot || null,
            membershipTier: targetTierNormalized,
            durationDays: quote.effectiveNewDurationDays,
            startDate: newStartDate,
            endDate: newEndDate,
            pricing: {
              basePrice: targetBasePrice,
              trainerFee: targetTrainerFee,
              totalAmount: targetTotalAmount,
              currency: 'INR',
            },
            payment: {
              method: request.paymentDetails?.method || 'UPI',
              status: 'Completed',
              transactionId: request.paymentDetails?.transactionId || `TXN_SW_${Date.now()}`,
              paidAt: new Date(),
            },
            status: 'Active',
            entryOtp: generatedOtp,
            switchMetadata: {
              switchType: quote.switchType,
              switchedAt: new Date(),
              previousMembershipId: currentMembership._id,
              daysUsed: quote.daysUsed,
              daysRemaining: quote.daysRemaining,
              dailyRatePaise: quote.dailyRatePaise,
              proRatedCreditPaise: quote.proRatedCreditPaise,
              creditAppliedPaise: Math.min(quote.proRatedCreditPaise, quote.newPricePaise),
              leftoverCreditPaise: quote.leftoverCreditPaise,
              leftoverActionTaken:
                quote.leftoverCreditPaise > 0
                  ? quote.downgradePolicy === 'WALLET'
                    ? 'WALLET_CREDITED'
                    : quote.downgradePolicy === 'REFUND'
                    ? 'REFUNDED'
                    : 'EXTENDED_DAYS'
                  : 'NONE',
              extraDaysAwarded: quote.extraDaysAwarded,
            },
          },
        ],
        { session }
      );

      // 4. Update old membership switchMetadata pointer
      currentMembership.switchMetadata = {
        switchType: quote.switchType,
        switchedAt: new Date(),
        replacedByMembershipId: newMembership._id,
        daysUsed: quote.daysUsed,
        daysRemaining: quote.daysRemaining,
        dailyRatePaise: quote.dailyRatePaise,
        proRatedCreditPaise: quote.proRatedCreditPaise,
        creditAppliedPaise: Math.min(quote.proRatedCreditPaise, quote.newPricePaise),
        leftoverCreditPaise: quote.leftoverCreditPaise,
        leftoverActionTaken:
          quote.leftoverCreditPaise > 0
            ? quote.downgradePolicy === 'WALLET'
              ? 'WALLET_CREDITED'
              : quote.downgradePolicy === 'REFUND'
              ? 'REFUNDED'
              : 'EXTENDED_DAYS'
            : 'NONE',
        extraDaysAwarded: quote.extraDaysAwarded,
      };
      await currentMembership.save({ session });

      // 5. Apply Wallet Credit if leftover credit > 0 and policy is WALLET
      if (quote.leftoverCreditPaise > 0 && quote.downgradePolicy === 'WALLET') {
        let userWallet = await Wallet.findOne({ userId: user._id, gymId: gym._id }).session(session);
        if (!userWallet) {
          userWallet = new Wallet({
            userId: user._id,
            gymId: gym._id,
            balancePaise: 0,
            currency: 'INR',
            history: [],
          });
        }

        const newBalance = userWallet.balancePaise + quote.leftoverCreditPaise;
        userWallet.balancePaise = newBalance;
        userWallet.history.push({
          transactionId: `WAL_${Date.now()}_${crypto.randomInt(100, 999)}`,
          type: 'CREDIT',
          source: 'MEMBERSHIP_DOWNGRADE_PRORATION',
          amountPaise: quote.leftoverCreditPaise,
          balanceAfterPaise: newBalance,
          referenceRequestId: request._id,
          description: `Prorated credit for plan downgrade from ${currentMembership.membershipTier} to ${request.targetTier}`,
          createdAt: new Date(),
        });

        await userWallet.save({ session });
      }

      // 6. Mark Switch Request as APPROVED_AND_EXECUTED
      request.status = 'APPROVED_AND_EXECUTED';
      request.executedNewMembershipId = newMembership._id;
      request.executedAt = new Date();
      const reviewerId = approvedByUser?._id || approvedByUser?.id || superAdminUser?._id || superAdminUser?.id || null;
      const reviewerName = approvedByUser?.fullName || approvedByUser?.name || superAdminUser?.fullName || 'Gym Admin';
      request.gymApproval = {
        status: 'APPROVED',
        reviewedBy: reviewerId,
        reviewerName,
        reviewedAt: new Date(),
        remarks: remarks || 'Approved and executed by Gym Admin',
      };
      request.superAdminApproval = {
        status: 'APPROVED',
        reviewedBy: reviewerId,
        reviewerName,
        reviewedAt: new Date(),
        remarks: remarks || 'Approved and executed',
      };
      await request.save({ session });

      await session.commitTransaction();
      session.endSession();

      return {
        success: true,
        request,
        previousMembership: currentMembership,
        newMembership,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}

export default ProrationEngine;
