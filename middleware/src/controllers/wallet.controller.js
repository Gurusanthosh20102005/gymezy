import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { Wallet } from '../models/wallet.model.js';
import Gym from '../models/gym.model.js';
import User from '../models/user.model.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Get logged-in user's consolidated wallet summary & transactions
 * Supports optional ?gymId= filter for gym-scoped queries
 * GET /api/v1/wallet/my
 */
export const getMyWallet = async (req, res, next) => {
  try {
    const rawUserId = req.user?.userId || req.user?.id || req.user?._id || req.query?.userId;
    const filterGymId = req.query?.gymId;

    if (!rawUserId) {
      return res.status(200).json(
        ApiResponse.success(
          {
            totalBalancePaise: 0,
            totalBalanceINR: 0,
            totalCreditedINR: 0,
            totalDebitedINR: 0,
            walletsCount: 0,
            wallets: [],
            transactions: [],
          },
          'Wallet summary retrieved successfully.'
        )
      );
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(rawUserId);
    const userQuery = isObjectId ? { userId: new mongoose.Types.ObjectId(rawUserId) } : { userId: rawUserId };

    if (filterGymId) {
      const isGymObjectId = mongoose.Types.ObjectId.isValid(filterGymId);
      const gym = await Gym.findOne(
        isGymObjectId ? { $or: [{ _id: filterGymId }, { partnerId: filterGymId }] } : { partnerId: filterGymId }
      ).select('_id').lean();
      if (gym) {
        userQuery.gymId = gym._id;
      }
    }

    const userWallets = await Wallet.find(userQuery)
      .populate('gymId', 'name partnerId address location logo coverPhoto image images phone area city')
      .lean();

    let totalBalancePaise = 0;
    let totalCreditedPaise = 0;
    let totalDebitedPaise = 0;
    const allTransactions = [];

    const formattedWallets = (userWallets || []).map((w) => {
      totalBalancePaise += w.balancePaise || 0;

      const gymLogo =
        (typeof w.gymId?.logo === 'string' && w.gymId.logo.trim()) ||
        w.gymId?.logo?.fileData ||
        w.gymId?.coverPhoto?.fileData ||
        w.gymId?.image ||
        (Array.isArray(w.gymId?.images) && w.gymId.images[0]) ||
        null;

      const history = w.history || [];
      history.forEach((tx) => {
        const txAmountPaise = Number(tx.amountPaise) || 0;
        if (tx.type === 'CREDIT') {
          totalCreditedPaise += txAmountPaise;
        } else if (tx.type === 'DEBIT') {
          totalDebitedPaise += txAmountPaise;
        }

        allTransactions.push({
          id: tx._id ? String(tx._id) : tx.transactionId,
          transactionId: tx.transactionId,
          type: tx.type,
          source: tx.source,
          amountPaise: txAmountPaise,
          amountINR: txAmountPaise / 100,
          balanceAfterPaise: tx.balanceAfterPaise || 0,
          balanceAfterINR: (tx.balanceAfterPaise || 0) / 100,
          description: tx.description,
          createdAt: tx.createdAt,
          gymId: w.gymId?._id || w.gymId,
          gymName: w.gymId?.name || 'GYMEZY Partner Gym',
          gymLogo,
          referenceRequestId: tx.referenceRequestId || null,
        });
      });

      let gymLocationStr = 'Verified GYMEZY Partner';
      if (typeof w.gymId?.area === 'string' && w.gymId.area.trim()) {
        gymLocationStr = w.gymId.city ? `${w.gymId.area.trim()}, ${w.gymId.city.trim()}` : w.gymId.area.trim();
      } else if (typeof w.gymId?.city === 'string' && w.gymId.city.trim()) {
        gymLocationStr = w.gymId.city.trim();
      } else if (typeof w.gymId?.address === 'string' && w.gymId.address.trim()) {
        gymLocationStr = w.gymId.address.trim();
      } else if (typeof w.gymId?.location === 'string' && w.gymId.location.trim()) {
        gymLocationStr = w.gymId.location.trim();
      }

      return {
        id: String(w._id),
        gymId: w.gymId?._id || w.gymId,
        gymName: w.gymId?.name || 'GYMEZY Partner Gym',
        gymLocation: gymLocationStr,
        gymLogo,
        balancePaise: w.balancePaise || 0,
        balanceINR: (w.balancePaise || 0) / 100,
        currency: w.currency || 'INR',
        transactionsCount: history.length,
        updatedAt: w.updatedAt,
      };
    });

    // Sort all transactions newest first
    allTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const responseData = {
      totalBalancePaise,
      totalBalanceINR: totalBalancePaise / 100,
      totalCreditedINR: totalCreditedPaise / 100,
      totalDebitedINR: totalDebitedPaise / 100,
      walletsCount: formattedWallets.length,
      wallets: formattedWallets,
      transactions: allTransactions,
    };

    return res.status(200).json(ApiResponse.success(responseData, 'Wallet summary retrieved successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's wallet for a specific gym
 * GET /api/v1/wallet/gym/:gymId
 */
export const getGymWallet = async (req, res, next) => {
  try {
    const rawUserId = req.user?.userId || req.user?.id || req.user?._id || req.query?.userId;
    const { gymId } = req.params;

    if (!rawUserId) {
      throw ApiError.unauthorized('User must be logged in to view wallet.');
    }
    if (!gymId) {
      throw ApiError.badRequest('Gym ID parameter is required.');
    }

    const isGymObjectId = mongoose.Types.ObjectId.isValid(gymId);
    const gym = await Gym.findOne(
      isGymObjectId ? { $or: [{ _id: gymId }, { partnerId: gymId }] } : { partnerId: gymId }
    ).select('name partnerId address location logo coverPhoto image images phone area city').lean();

    if (!gym) {
      throw ApiError.notFound('Gym not found.');
    }

    const isUserObjectId = mongoose.Types.ObjectId.isValid(rawUserId);
    const userQuery = isUserObjectId ? { userId: new mongoose.Types.ObjectId(rawUserId) } : { userId: rawUserId };

    const wallet = await Wallet.findOne({ ...userQuery, gymId: gym._id }).lean();

    const gymLogo =
      (typeof gym.logo === 'string' && gym.logo.trim()) ||
      gym.logo?.fileData ||
      gym.coverPhoto?.fileData ||
      gym.image ||
      (Array.isArray(gym.images) && gym.images[0]) ||
      null;

    let gymLocationStr = 'Verified GYMEZY Partner';
    if (typeof gym.area === 'string' && gym.area.trim()) {
      gymLocationStr = gym.city ? `${gym.area.trim()}, ${gym.city.trim()}` : gym.area.trim();
    } else if (typeof gym.city === 'string' && gym.city.trim()) {
      gymLocationStr = gym.city.trim();
    } else if (typeof gym.address === 'string' && gym.address.trim()) {
      gymLocationStr = gym.address.trim();
    } else if (typeof gym.location === 'string' && gym.location.trim()) {
      gymLocationStr = gym.location.trim();
    }

    const balancePaise = wallet?.balancePaise || 0;
    const history = (wallet?.history || [])
      .map((tx) => ({
        id: tx._id ? String(tx._id) : tx.transactionId,
        transactionId: tx.transactionId,
        type: tx.type,
        source: tx.source,
        amountPaise: tx.amountPaise,
        amountINR: (tx.amountPaise || 0) / 100,
        balanceAfterPaise: tx.balanceAfterPaise || 0,
        balanceAfterINR: (tx.balanceAfterPaise || 0) / 100,
        description: tx.description,
        createdAt: tx.createdAt,
        referenceRequestId: tx.referenceRequestId || null,
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const responseData = {
      gymId: gym._id,
      gymName: gym.name,
      gymLocation: gymLocationStr,
      gymLogo,
      balancePaise,
      balanceINR: balancePaise / 100,
      currency: wallet?.currency || 'INR',
      exists: Boolean(wallet),
      transactionsCount: history.length,
      transactions: history,
      updatedAt: wallet?.updatedAt || null,
    };

    return res.status(200).json(
      ApiResponse.success(responseData, `Wallet details for ${gym.name} retrieved successfully.`)
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Top Up / Add money to gym-specific wallet
 * POST /api/v1/wallet/top-up
 */
export const topUpWallet = async (req, res, next) => {
  try {
    const rawUserId = req.user?.userId || req.user?.id || req.user?._id || req.body?.userId;
    const { gymId, amount, paymentMethod = 'UPI', transactionId } = req.body;

    if (!rawUserId) {
      throw ApiError.unauthorized('User must be logged in to top up wallet.');
    }
    const numAmount = Number(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      throw ApiError.badRequest('Please specify a valid top-up amount greater than 0.');
    }

    if (!gymId) {
      throw ApiError.badRequest('Gym ID is required. Funds must be deposited into a specific gym wallet.');
    }

    const isGymObjectId = mongoose.Types.ObjectId.isValid(gymId);
    const gym = await Gym.findOne(
      isGymObjectId ? { $or: [{ _id: gymId }, { partnerId: gymId }] } : { partnerId: gymId }
    ).select('_id name').lean();

    if (!gym) {
      throw ApiError.notFound('Gym not found for wallet association.');
    }

    const amountPaise = Math.round(numAmount * 100);
    const txnId = transactionId || `WAL_TOP_${Date.now()}_${crypto.randomInt(100, 999)}`;

    let userWallet = await Wallet.findOne({ userId: rawUserId, gymId: gym._id });
    if (!userWallet) {
      userWallet = new Wallet({
        userId: rawUserId,
        gymId: gym._id,
        balancePaise: 0,
        currency: 'INR',
        history: [],
      });
    }

    const newBalancePaise = userWallet.balancePaise + amountPaise;
    userWallet.balancePaise = newBalancePaise;
    userWallet.history.push({
      transactionId: txnId,
      type: 'CREDIT',
      source: 'TOP_UP',
      amountPaise,
      balanceAfterPaise: newBalancePaise,
      description: `Wallet top-up for ${gym.name} via ${paymentMethod}`,
      createdAt: new Date(),
    });

    await userWallet.save();

    return res.status(200).json(
      ApiResponse.success(
        {
          transactionId: txnId,
          gymId: gym._id,
          gymName: gym.name,
          amountINR: numAmount,
          newBalanceINR: newBalancePaise / 100,
          wallet: userWallet,
        },
        `Successfully added ₹${numAmount.toLocaleString('en-IN')} to ${gym.name} wallet.`
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Request balance withdrawal / refund from gym-specific wallet
 * POST /api/v1/wallet/withdraw
 */
export const withdrawWallet = async (req, res, next) => {
  try {
    const rawUserId = req.user?.userId || req.user?.id || req.user?._id || req.body?.userId;
    const { gymId, amount, upiId, accountDetails, reason } = req.body;

    if (!rawUserId) {
      throw ApiError.unauthorized('User must be logged in to withdraw.');
    }
    const numAmount = Number(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      throw ApiError.badRequest('Please enter a valid withdrawal amount.');
    }

    if (!gymId) {
      throw ApiError.badRequest('Gym ID is required. Withdrawal requests must specify the issuing gym wallet.');
    }

    const isGymObjectId = mongoose.Types.ObjectId.isValid(gymId);
    const gym = await Gym.findOne(
      isGymObjectId ? { $or: [{ _id: gymId }, { partnerId: gymId }] } : { partnerId: gymId }
    ).select('_id name').lean();

    if (!gym) {
      throw ApiError.notFound('Gym not found for withdrawal.');
    }

    const amountPaise = Math.round(numAmount * 100);

    const userWallet = await Wallet.findOne({ userId: rawUserId, gymId: gym._id });

    if (!userWallet || userWallet.balancePaise < amountPaise) {
      const availINR = ((userWallet?.balancePaise || 0) / 100).toFixed(2);
      throw ApiError.badRequest(
        `Insufficient wallet balance at ${gym.name}. Requested: ₹${numAmount}, Available: ₹${availINR}.`
      );
    }

    const txnId = `WAL_WTH_${Date.now()}_${crypto.randomInt(100, 999)}`;
    const newBalancePaise = userWallet.balancePaise - amountPaise;
    userWallet.balancePaise = newBalancePaise;

    const destination = upiId
      ? `UPI (${upiId})`
      : accountDetails?.accountNumber
      ? `Bank Account (•••${accountDetails.accountNumber.slice(-4)})`
      : 'Primary Account';

    userWallet.history.push({
      transactionId: txnId,
      type: 'DEBIT',
      source: 'WALLET_WITHDRAWAL',
      amountPaise,
      balanceAfterPaise: newBalancePaise,
      description: `Withdrawal from ${gym.name} to ${destination}${reason ? ` - ${reason}` : ''}`,
      createdAt: new Date(),
    });

    await userWallet.save();

    return res.status(200).json(
      ApiResponse.success(
        {
          transactionId: txnId,
          gymId: gym._id,
          gymName: gym.name,
          amountINR: numAmount,
          newBalanceINR: newBalancePaise / 100,
          destination,
        },
        `Withdrawal request of ₹${numAmount} from ${gym.name} submitted successfully.`
      )
    );
  } catch (error) {
    next(error);
  }
};
