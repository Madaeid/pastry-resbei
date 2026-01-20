// Stripe Configuration
import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Initialize Stripe with secret key
if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('WARNING: STRIPE_SECRET_KEY is missing from environment variables!');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16'
});

// Stripe Price IDs (these need to be created in your Stripe Dashboard)
// For now, we'll use dynamic pricing with checkout sessions
const STRIPE_PRICES = {
    monthly: process.env.STRIPE_PRICE_MONTHLY || null,
    yearly: process.env.STRIPE_PRICE_YEARLY || null,
    lifetime: process.env.STRIPE_PRICE_LIFETIME || null
};

// Plan configurations with Stripe details
const PLANS = {
    monthly: {
        id: 'monthly',
        name: 'Monthly',
        price: 3.00,
        originalPrice: 5.00,
        discount: 40,
        period: 'month',
        durationDays: 30,
        displayPrice: '$3.00/month',
        stripeMode: 'subscription',
        stripePriceId: STRIPE_PRICES.monthly
    },
    yearly: {
        id: 'yearly',
        name: 'Yearly',
        price: 39.99,
        period: 'year',
        durationDays: 365,
        displayPrice: '$39.99/year',
        stripeMode: 'subscription',
        stripePriceId: STRIPE_PRICES.yearly
    },
    lifetime: {
        id: 'lifetime',
        name: 'Lifetime',
        price: 20.00,
        originalPrice: 100.00,
        discount: 80,
        period: 'lifetime',
        durationDays: 36500,
        displayPrice: '$20.00 one-time',
        stripeMode: 'payment', // One-time payment
        stripePriceId: STRIPE_PRICES.lifetime
    }
};

// Create a Stripe Checkout session
async function createCheckoutSession(userId, userEmail, planId, successUrl, cancelUrl) {
    const plan = PLANS[planId];
    if (!plan) {
        throw new Error('Invalid plan');
    }

    const sessionConfig = {
        payment_method_types: ['card'],
        customer_email: userEmail,
        mode: plan.stripeMode,
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        metadata: {
            userId: userId,
            planId: planId
        }
    };

    // If we have a pre-configured price ID, use it
    if (plan.stripePriceId) {
        sessionConfig.line_items = [{
            price: plan.stripePriceId,
            quantity: 1
        }];
    } else {
        // Create dynamic pricing (for development/testing)
        sessionConfig.line_items = [{
            price_data: {
                currency: 'usd',
                product_data: {
                    name: `Pastry Recipe Book - ${plan.name} Plan`,
                    description: plan.stripeMode === 'payment'
                        ? 'Lifetime access to all premium features'
                        : `${plan.name} subscription to premium features`
                },
                unit_amount: Math.round(plan.price * 100), // Stripe uses cents
                ...(plan.stripeMode === 'subscription' && {
                    recurring: {
                        interval: plan.period === 'year' ? 'year' : 'month'
                    }
                })
            },
            quantity: 1
        }];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return session;
}

// Verify a checkout session
async function verifyCheckoutSession(sessionId) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
}

// Construct webhook event
function constructWebhookEvent(payload, signature) {
    return stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
    );
}

export {
    stripe,
    PLANS,
    createCheckoutSession,
    verifyCheckoutSession,
    constructWebhookEvent
};
