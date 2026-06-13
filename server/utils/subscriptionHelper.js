
import { getDatabase } from '../database/db.js';

export const PLANS = {
    monthly: {
        id: 'monthly',
        name: 'Monthly',
        price: 2.00,
        durationDays: 30
    },
    yearly: {
        id: 'yearly',
        name: 'Yearly',
        price: 20.00,
        durationDays: 365
    },
    lifetime: {
        id: 'lifetime',
        name: 'Lifetime',
        price: 50.00, // Example price for lifetime
        durationDays: 36500 // ~100 years
    }
};

/**
 * Fulfills a subscription purchase by updating the database and recording the transaction.
 * Works for both Stripe and Wallet payments.
 */
export async function fulfillSubscription(userId, planId, amount, paymentMethod = 'wallet', stripeSessionId = null, stripeCustomerId = null, client = null) {
    const db = client || getDatabase();
    const plan = PLANS[planId];
    
    if (!plan) {
        throw new Error(`Invalid plan ID: ${planId}`);
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.durationDays);

    // 1. Check for existing subscription
    const existingSubResult = await db.query('SELECT id FROM subscriptions WHERE user_id = $1', [userId]);
    const existingSub = existingSubResult.rows[0];

    if (existingSub) {
        await db.query(`
            UPDATE subscriptions SET
                plan = $1,
                status = 'active',
                start_date = $2,
                end_date = $3,
                auto_renew = $4,
                stripe_session_id = $5,
                stripe_customer_id = $6,
                granted_by_admin = FALSE,
                cancelled_at = NULL,
                updated_at = NOW()
            WHERE user_id = $7
        `, [
            planId, 
            startDate.toISOString(), 
            endDate.toISOString(), 
            (planId !== 'lifetime' && paymentMethod === 'stripe'), // Auto-renew only for Stripe subscriptions
            stripeSessionId, 
            stripeCustomerId, 
            userId
        ]);
    } else {
        await db.query(`
            INSERT INTO subscriptions (user_id, plan, status, start_date, end_date, auto_renew, stripe_session_id, stripe_customer_id)
            VALUES ($1, $2, 'active', $3, $4, $5, $6, $7)
        `, [
            userId, 
            planId, 
            startDate.toISOString(), 
            endDate.toISOString(), 
            (planId !== 'lifetime' && paymentMethod === 'stripe'),
            stripeSessionId,
            stripeCustomerId
        ]);
    }

    // 2. Add to unified transactions table
    const transactionId = `TXN-${paymentMethod.toUpperCase()}-${Date.now()}`;
    await db.query(`
        INSERT INTO transactions (user_id, transaction_id, type, plan, amount, status, stripe_session_id)
        VALUES ($1, $2, 'subscription', $3, $4, 'completed', $5)
    `, [userId, transactionId, planId, amount, stripeSessionId]);

    return {
        success: true,
        plan: planId,
        endDate: endDate.toISOString(),
        transactionId
    };
}
