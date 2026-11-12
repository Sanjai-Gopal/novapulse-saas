// Serverless Function: /api/razorpay/webhook.js
// Handles Razorpay webhooks (e.g., payment.captured) with signature verification.

import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false // Allows reading raw buffer for accurate signature validation
  }
};

async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).json({ error: 'RAZORPAY_WEBHOOK_SECRET is not configured.' });
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['x-razorpay-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    console.log(`Razorpay webhook received: ${event.event}`);

    // Process event types
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      console.log(`Payment captured: ${payment.id} for amount ${payment.amount}`);
      // Application can trigger internal notification or sync
    }

    return res.status(200).json({ status: 'ok', received: true });
  } catch (err) {
    console.error('Razorpay webhook processing error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
