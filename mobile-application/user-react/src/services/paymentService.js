import RazorpayCheckout from 'react-native-razorpay';
import { apiService } from './apiService';

class PaymentService {
  /**
   * Execute end-to-end Razorpay payment:
   * 1. Create authoritative order on backend
   * 2. Open native Razorpay Checkout SDK
   * 3. Verify HMAC signature & fulfill domain entity on backend
   */
  async payWithRazorpay({ flowType, payload, description = 'GYMEZY Payment', prefill = {} }) {
    const orderData = await apiService.createPaymentOrder({ flowType, payload });

    if (orderData?.walletSettled) {
      return orderData.data;
    }

    if (!orderData?.orderId || !orderData?.keyId) {
      throw new Error('Invalid payment order response from server.');
    }

    const options = {
      description,
      currency: orderData.currency || 'INR',
      key: orderData.keyId,
      amount: String(orderData.amountPaise),
      name: 'GYMEZY',
      order_id: orderData.orderId,
      prefill: {
        email: prefill.email || orderData.prefill?.email || '',
        contact: prefill.contact || orderData.prefill?.contact || '',
        name: prefill.name || orderData.prefill?.name || '',
      },
      theme: { color: '#003882' },
    };

    let rzpResponse;
    try {
      rzpResponse = await RazorpayCheckout.open(options);
    } catch (err) {
      const desc = err?.description || err?.error?.description || err?.message || 'Payment was cancelled.';
      throw new Error(desc);
    }

    const verified = await apiService.verifyPayment({
      razorpay_order_id: rzpResponse.razorpay_order_id || orderData.orderId,
      razorpay_payment_id: rzpResponse.razorpay_payment_id,
      razorpay_signature: rzpResponse.razorpay_signature,
    });

    return verified?.data || verified;
  }
}

export const paymentService = new PaymentService();
export default paymentService;
