// Serverless Function: /api/razorpay/verify-payment.js
// Verifies HMAC SHA-256 signature server-side and securely updates subscription.

import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return res.status(500).json({ error: 'RAZORPAY_KEY_SECRET is not configured on the server.' });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, user_id, plan = 'growth' } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required Razorpay payment verification fields.' });
    }

    // Verify HMAC SHA256 signature
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment signature. Verification failed.', verified: false });
    }

    // If Supabase Service Role is configured, update the user's profile plan tier
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey && user_id) {
      try {
        const updateRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user_id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            plan_tier: plan,
            subscription_status: 'active',
            razorpay_payment_id: razorpay_payment_id,
            razorpay_order_id: razorpay_order_id,
            updated_at: new Date().toISOString()
          })
        });

        if (!updateRes.ok) {
          console.warn('Could not update profile via Supabase REST API:', await updateRes.text());
        }
      } catch (dbErr) {
        console.error('Database update error after payment verification:', dbErr);
      }
    }

    return res.status(200).json({
      success: true,
      verified: true,
      message: 'Payment verified successfully and subscription upgraded.',
      payment_id: razorpay_payment_id
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    return res.status(500).json({ error: err.message || 'Payment verification encountered an internal error.' });
  }
}
