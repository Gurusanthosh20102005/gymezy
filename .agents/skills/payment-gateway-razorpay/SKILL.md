---
name: payment-gateway-razorpay
description: Secure Razorpay payment, refund, webhook, and Route payout standards for backend and mobile/web clients. Use whenever creating payment orders, verifying Razorpay signatures, handling webhooks, issuing refunds, or transferring partner settlements.
---

# Razorpay Payment & Settlement Guardrails

1. **Server-Authoritative Pricing**: Never trust `amount`, `discount`, or `payableAmount` from the client. Always compute `amountPaise` (`Math.round(rupees * 100)`) on the server from database records (`Plan`, `Section`, `SwitchQuote`).
2. **No Mock Fallbacks**: Never generate `mock_*` payment IDs or auto-confirm paid orders when gateway keys are absent. Use `rzp_test_*` keys in local/dev and `rzp_live_*` keys in production, and fail fast if missing.
3. **Timing-Safe HMAC Verification**: Verify `razorpay_order_id + "|" + razorpay_payment_id` against `RAZORPAY_KEY_SECRET` using `crypto.timingSafeEqual` before fulfilling any membership, booking, or wallet credit.
4. **Raw-Body Webhook Verification**: Mount `express.raw({ type: 'application/json' })` on `/payments/webhook` before `express.json()` so `x-razorpay-signature` is verified against the exact raw bytes.
5. **Idempotent Fulfillment**: Guard fulfillment with a `PaymentTransaction` status transition (`CREATED -> PAID`) so concurrent `/verify` and `/webhook` calls never double-create memberships, bookings, or wallet credits.
6. **Settlement-Gated Partner Transfers**: Capture 100% of funds into the platform account first and trigger Razorpay Route transfers only after settlement approval in Super Admin.
