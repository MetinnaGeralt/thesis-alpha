// app/api/stripe/webhook/route.js
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('[Stripe Webhook] Event:', event.type);

  try {
    switch (event.type) {
      // ── New subscription created ──
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        const subscriptionId = session.subscription;
        const customerId = session.customer;

        if (userId && subscriptionId) {
          // Fetch subscription details to get period end
          const sub = await stripe.subscriptions.retrieve(subscriptionId);

          await supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan: 'pro',
            status: 'active',
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

          console.log('[Stripe Webhook] Activated pro plan for user:', userId);
        }
        break;
      }

      // ── Subscription renewed / updated ──
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.supabase_user_id;

        if (userId) {
          const isActive = sub.status === 'active' || sub.status === 'trialing';
          await supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_subscription_id: sub.id,
            plan: isActive ? 'pro' : 'free',
            status: sub.status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

          console.log('[Stripe Webhook] Updated subscription for user:', userId, '→', sub.status);
        }
        break;
      }

      // ── Subscription cancelled or expired ──
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.supabase_user_id;

        if (userId) {
          await supabase.from('subscriptions').upsert({
            user_id: userId,
            plan: 'free',
            status: 'cancelled',
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

          console.log('[Stripe Webhook] Cancelled subscription for user:', userId);
        }
        break;
      }

      // ── Payment failed ──
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const userId = sub.metadata?.supabase_user_id;
          if (userId) {
            await supabase.from('subscriptions').update({
              status: 'past_due',
              updated_at: new Date().toISOString()
            }).eq('user_id', userId);

            console.log('[Stripe Webhook] Payment failed for user:', userId);
          }
        }
        break;
      }

      default:
        console.log('[Stripe Webhook] Unhandled event type:', event.type);
    }
  } catch (err) {
    console.error('[Stripe Webhook] Processing error:', err);
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return Response.json({ received: true });
}
