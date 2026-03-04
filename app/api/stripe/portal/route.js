// app/api/stripe/portal/route.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const { customerId } = await request.json();

    if (!customerId) {
      return Response.json({ error: 'Missing customer ID' }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.NEXT_PUBLIC_APP_URL || 'https://thesisalpha.io'
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('[Stripe Portal]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
