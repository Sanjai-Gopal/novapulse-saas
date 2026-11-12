// Serverless Function: /api/razorpay/create-order.js
// Runs server-side on Vercel to protect RAZORPAY_KEY_SECRET.

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return res.status(500).json({
      error: 'Razorpay credentials not configured on the server. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.',
      fallback_link: process.env.VITE_RAZORPAY_PAYMENT_LINK || 'https://razorpay.me/@sanjai6676'
    });
  }

  try {
    const { plan = 'growth', billing_cycle = 'monthly' } = req.body || {};
    
    // Amount in smallest currency unit (INR paise or USD cents)
    // Defaulting to Growth plan: $29/mo or $23/mo (annual)
    const isAnnual = billing_cycle === 'annual';
    const amountInINR = isAnnual ? 229900 : 289900; // ~₹2,299 or ₹2,899

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        amount: amountInINR,
        currency: 'INR',
        receipt: `receipt_np_${Date.now()}`,
        notes: {
          plan,
          billing_cycle,
          product: 'NovaPulse SaaS'
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.description || 'Failed to create Razorpay order');
    }

    return res.status(200).json({
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      keyId: keyId
    });
  } catch (err) {
    console.error('Razorpay order creation error:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error creating order',
      fallback_link: 'https://razorpay.me/@sanjai6676'
    });
  }
}
