import crypto from 'node:crypto';

export const calculateCancellationQuote = (membership, now = new Date()) => {
  const originalAmount = Number(membership.pricing?.totalAmount || 0);
  const start = new Date(membership.startDate).getTime();
  const end = new Date(membership.endDate).getTime();
  const durationMs = Math.max(end - start, 1);
  const elapsedMs = Math.min(Math.max(now.getTime() - start, 0), durationMs);
  const usedAmount = originalAmount * elapsedMs / durationMs;
  const maximumRefundAmount = Math.max(0, Math.round((originalAmount - usedAmount) * 100) / 100);

  return {
    originalAmount,
    usedAmount: Math.round(usedAmount * 100) / 100,
    maximumRefundAmount,
    daysUsed: Math.floor(elapsedMs / 86400000),
    daysRemaining: Math.max(0, Math.ceil((end - now.getTime()) / 86400000)),
  };
};

export const createCancellationRequestId = () =>
  `CAN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
