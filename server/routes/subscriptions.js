
// Subscription Routes
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { PLANS as STRIPE_PLANS, createCheckoutSession, verifyCheckoutSession, createPortalSession, constructWebhookEvent } from '../config/stripe.js';
import { fulfillSubscription, PLANS as HELPER_PLANS } from '../utils/subscriptionHelper.js';

const router = express.Router();

// ===== Subscription Plans =====
const PLANS = {
    monthly: {
        id: 'monthly',
        name: 'Monthly',
        price: 2.00,
        originalPrice: 4.00,
        discount: 50,
        period: 'month',
        durationDays: 30,
        displayPrice: '$2.00/month'
    },
    yearly: {
        id: 'yearly',
        name: 'Yearly',
        price: 20.00,
        originalPrice: 40.00,
        discount: 50,
        period: 'year',
        durationDays: 365,
        displayPrice: '$20.00/year'
    },
    lifetime: {
        id: 'lifetime',
        name: 'Lifetime',
        price: 50.00,
        originalPrice: 100.00,
        discount: 50,
        period: 'lifetime',
        durationDays: 36500,
        displayPrice: '$50.00 once'
    }
};

// ===== Get Plans =====
router.get('/plans', (req, res) => {
    res.json(PLANS);
});

// ===== Check Premium Status =====
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();

        // Check if user is admin
        const userResult = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
        const user = userResult.rows[0];

        if (user?.is_admin === 1) {
            return res.json({
                isPremium: true,
                plan: 'lifetime',
                status: 'admin',
                message: 'Premium Lifetime (Admin Privilege)',
                isAdminPrivilege: true
            });
        }

        // Get subscription
        const subResult = await db.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.user.userId]);
        const subscription = subResult.rows[0];

        if (!subscription) {
            return res.json({
                isPremium: false,
                plan: 'free',
                status: 'none',
                message: 'Free Plan - Limited features'
            });
        }

        const endDate = new Date(subscription.end_date);
        const now = new Date();

        if (subscription.status === 'cancelled') {
            if (endDate > now) {
                return res.json({
                    isPremium: true,
                    plan: subscription.plan,
                    status: 'cancelled',
                    endDate: subscription.end_date,
                    message: `Premium active until ${formatDate(endDate)}`
                });
            } else {
                return res.json({
                    isPremium: false,
                    plan: 'free',
                    status: 'expired',
                    message: 'Subscription expired'
                });
            }
        }

        if (endDate <= now) {
            return res.json({
                isPremium: false,
                plan: 'free',
                status: 'expired',
                message: 'Subscription expired'
            });
        }

        res.json({
            isPremium: true,
            plan: subscription.plan,
            status: 'active',
            endDate: subscription.end_date,
            autoRenew: !!subscription.auto_renew,
            message: `Premium ${PLANS[subscription.plan]?.name || 'Plan'}`
        });

    } catch (error) {
        console.error('Get subscription status error:', error);
        res.status(500).json({ error: 'Failed to get subscription status' });
    }
});

// ===== Get Subscription Details =====
router.get('/details', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const subResult = await db.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.user.userId]);
        const subscription = subResult.rows[0];

        if (!subscription) {
            return res.json(null);
        }

        res.json({
            plan: subscription.plan,
            status: subscription.status,
            startDate: subscription.start_date,
            endDate: subscription.end_date,
            autoRenew: !!subscription.auto_renew,
            grantedByAdmin: !!subscription.granted_by_admin,
            paymentMethod: subscription.payment_last4 ? {
                last4: subscription.payment_last4,
                brand: subscription.payment_brand,
                expiryDate: subscription.payment_expiry
            } : null
        });

    } catch (error) {
        console.error('Get subscription details error:', error);
        res.status(500).json({ error: 'Failed to get subscription details' });
    }
});

// ===== Process Payment =====
router.post('/subscribe', authenticateToken, async (req, res) => {
    try {
        const { plan, cardData } = req.body;
        const db = getDatabase();

        if (!PLANS[plan]) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

        // Validate card (basic validation)
        const cardNumber = cardData.cardNumber.replace(/\s/g, '');
        if (cardNumber.length < 15 || cardNumber.length > 16) {
            return res.status(400).json({ error: 'Invalid card number' });
        }

        // Decline test cards
        if (cardNumber === '4000000000000002') {
            return res.status(400).json({ error: 'Card declined. Please try a different card.' });
        }

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Calculate dates
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + PLANS[plan].durationDays);

        // Get card brand
        const getCardBrand = (num) => {
            if (num.startsWith('4')) return 'Visa';
            if (num.startsWith('5')) return 'Mastercard';
            if (num.startsWith('3')) return 'Amex';
            return 'Card';
        };

        // Check for existing subscription
        const existingSubResult = await db.query('SELECT id FROM subscriptions WHERE user_id = $1', [req.user.userId]);
        const existingSub = existingSubResult.rows[0];

        if (existingSub) {
            // Update existing
            await db.query(`
                UPDATE subscriptions SET
                    plan = $1,
                    status = 'active',
                    start_date = $2,
                    end_date = $3,
                    payment_last4 = $4,
                    payment_brand = $5,
                    payment_expiry = $6,
                    auto_renew = $7,
                    granted_by_admin = 0,
                    cancelled_at = NULL,
                    updated_at = $8
                WHERE user_id = $9
            `, [
                plan,
                startDate.toISOString(),
                endDate.toISOString(),
                cardNumber.slice(-4),
                getCardBrand(cardNumber),
                cardData.cardExpiry,
                plan !== 'lifetime' ? 1 : 0,
                new Date().toISOString(),
                req.user.userId
            ]);
        } else {
            // Create new
            await db.query(`
                INSERT INTO subscriptions (user_id, plan, status, start_date, end_date, payment_last4, payment_brand, payment_expiry, auto_renew)
                VALUES ($1, $2, 'active', $3, $4, $5, $6, $7, $8)
            `, [
                req.user.userId,
                plan,
                startDate.toISOString(),
                endDate.toISOString(),
                cardNumber.slice(-4),
                getCardBrand(cardNumber),
                cardData.cardExpiry,
                plan !== 'lifetime' ? 1 : 0
            ]);
        }

        // Add transaction
        await db.query(`
            INSERT INTO transactions (user_id, transaction_id, type, plan, amount, status, payment_last4, payment_brand)
            VALUES ($1, $2, 'subscription', $3, $4, 'completed', $5, $6)
        `, [
            req.user.userId,
            `TXN-${Date.now()}`,
            plan,
            PLANS[plan].price,
            cardNumber.slice(-4),
            getCardBrand(cardNumber)
        ]);

        res.json({
            success: true,
            subscription: {
                plan,
                status: 'active',
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            }
        });

    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ error: 'Payment processing failed' });
    }
});

// ===== Cancel Subscription =====
router.post('/cancel', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();

        const subResult = await db.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.user.userId]);
        const subscription = subResult.rows[0];

        if (!subscription) {
            return res.status(400).json({ error: 'No active subscription' });
        }

        await db.query(`
            UPDATE subscriptions SET
                status = 'cancelled',
                auto_renew = FALSE,
                cancelled_at = $1,
                updated_at = $2
            WHERE user_id = $3
        `, [
            new Date().toISOString(),
            new Date().toISOString(),
            req.user.userId
        ]);

        // Add transaction
        await db.query(`
            INSERT INTO transactions (user_id, transaction_id, type, plan, amount, status)
            VALUES ($1, $2, 'cancellation', $3, 0, 'completed')
        `, [
            req.user.userId,
            `TXN-${Date.now()}`,
            subscription.plan
        ]);

        res.json({ success: true, message: 'Subscription cancelled' });

    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
});

// ===== Get Transaction History =====
router.get('/transactions', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50
        `, [req.user.userId]);

        const transactions = result.rows;

        res.json(transactions.map(tx => ({
            id: tx.transaction_id,
            type: tx.type,
            plan: tx.plan,
            amount: tx.amount,
            status: tx.status,
            date: tx.created_at,
            paymentMethod: tx.payment_last4 ? {
                last4: tx.payment_last4,
                brand: tx.payment_brand
            } : null
        })));

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Failed to get transactions' });
    }
});

// Helper function
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ===== STRIPE INTEGRATION =====

// Create Stripe Checkout Session
router.post('/create-checkout-session', authenticateToken, async (req, res) => {
    try {
        const { planId, successUrl, cancelUrl } = req.body;
        const db = getDatabase();

        if (!PLANS[planId]) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

        // Get user email
        const userResult = await db.query('SELECT email FROM users WHERE id = $1', [req.user.userId]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create Stripe checkout session
        const session = await createCheckoutSession(
            req.user.userId,
            user.email,
            planId,
            successUrl || `${process.env.FRONTEND_URL}/payment-success.html`,
            cancelUrl || `${process.env.FRONTEND_URL}/payment.html`
        );

        res.json({
            sessionId: session.id,
            url: session.url
        });

    } catch (error) {
        console.error('Create checkout session error:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// Verify Stripe Checkout Session (called after successful payment redirect)
router.get('/verify-session/:sessionId', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const db = getDatabase();

        // Verify the session with Stripe
        const session = await verifyCheckoutSession(sessionId);

        if (session.payment_status !== 'paid') {
            return res.status(400).json({
                success: false,
                error: 'Payment not completed'
            });
        }

        // Check if this session's user matches the authenticated user
        if (String(session.metadata.userId) !== String(req.user.userId)) {
            return res.status(403).json({ error: 'Session does not belong to this user' });
        }

        const planId = session.metadata?.planId;

        if (!planId) {
            console.error('Missing planId in session metadata for sessionId:', sessionId);
            return res.status(400).json({
                error: 'Invalid session metadata: planId missing. If you were purchasing a recipe, please use the correct verification endpoint.'
            });
        }

        const plan = PLANS[planId];

        if (!plan) {
            console.error('Invalid planId in session metadata:', planId);
            return res.status(400).json({ error: 'Invalid plan configuration' });
        }

        // Check if subscription already created via webhook
        const existingSubResult = await db.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.user.userId]);
        const existingSub = existingSubResult.rows[0];

        if (existingSub && existingSub.stripe_session_id === sessionId) {
            return res.json({
                success: true,
                alreadyProcessed: true,
                subscription: {
                    plan: existingSub.plan,
                    status: existingSub.status,
                    endDate: existingSub.end_date
                }
            });
        }

        const result = await fulfillSubscription(
            req.user.userId,
            planId,
            plan.price,
            'stripe',
            sessionId,
            session.customer || null
        );

        res.json({
            success: true,
            subscription: {
                plan: planId,
                status: 'active',
                startDate: new Date().toISOString(),
                endDate: result.endDate
            }
        });

    } catch (error) {
        console.error('Verify session error:', error);
        res.status(500).json({ error: 'Failed to verify session' });
    }
});

// Create Customer Portal Session (for managing subscription/payment methods)
router.post('/create-portal-session', authenticateToken, async (req, res) => {
    try {
        const { returnUrl } = req.body;
        const db = getDatabase();

        // Get subscription to find Stripe Customer ID
        const subResult = await db.query('SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1', [req.user.userId]);
        const subscription = subResult.rows[0];

        if (!subscription || !subscription.stripe_customer_id) {
            return res.status(404).json({ error: 'No active subscription or customer ID found' });
        }

        const session = await createPortalSession(
            subscription.stripe_customer_id,
            returnUrl || `${process.env.FRONTEND_URL}/payment.html`
        );

        res.json({ url: session.url });

    } catch (error) {
        console.error('Create portal session error:', error);
        res.status(500).json({ error: 'Failed to create portal session' });
    }
});

// Stripe Webhook Handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = constructWebhookEvent(req.body, sig);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const userId = session.metadata.userId;
            const type = session.metadata.type;

            if (!userId) {
                console.error('Missing metadata in webhook:', session.id);
                break;
            }

            try {
                const db = getDatabase();
                const client = await db.connect();
                try {
                    await client.query('BEGIN');

                if (type === 'recipe_purchase') {
                    const recipeId = session.metadata.recipeId;

                    // Check if already processed
                    const existing = await client.query(
                        'SELECT id FROM store_purchases WHERE stripe_session_id = $1',
                        [session.id]
                    );

                    if (existing.rows.length === 0) {
                        const recipeResult = await client.query('SELECT seller_id, price, name FROM store_recipes WHERE id = $1', [recipeId]);
                        const recipe = recipeResult.rows[0];
                        const pricePaid = recipe?.price || 0;
                        const sellerId = recipe?.seller_id;

                        await client.query(`
                            INSERT INTO store_purchases (buyer_id, store_recipe_id, price_paid, stripe_session_id)
                            VALUES ($1, $2, $3, $4)
                        `, [userId, recipeId, pricePaid, session.id]);

                        await client.query(`
                            INSERT INTO transactions (user_id, transaction_id, type, plan, amount, status, stripe_session_id)
                            VALUES ($1, $2, 'recipe_purchase', $3, $4, 'completed', $5)
                        `, [
                            userId,
                            `TXN-RECIPE-${Date.now()}`,
                            `Recipe: ${recipe?.name || recipeId}`,
                            pricePaid,
                            session.id
                        ]);

                        if (sellerId) {
                            const sellerCut = pricePaid * 0.8;
                            const adminCut = pricePaid - sellerCut;
                            
                            // Credit seller wallet (80%)
                            await client.query('INSERT INTO wallet_balances (user_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [sellerId]);
                            await client.query('UPDATE wallet_balances SET balance = balance + $1 WHERE user_id = $2', [sellerCut, sellerId]);
                            
                            // Record seller side transaction
                            await client.query(`
                                INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
                                VALUES ($1, $2, 'recipe_purchase', $3, $4, 'completed', $5)
                            `, [null, sellerId, sellerCut, `Stripe Sale (Seller Cut): "${recipe?.name || recipeId}"`, `STRIPE-REC-S-${session.id}`]);

                            // Credit admin wallet (20%)
                            const adminResult = await client.query('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
                            const adminId = adminResult.rows[0]?.id;
                            if (adminId) {
                                await client.query('INSERT INTO wallet_balances (user_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [adminId]);
                                await client.query('UPDATE wallet_balances SET balance = balance + $1 WHERE user_id = $2', [adminCut, adminId]);
                                
                                await client.query(`
                                    INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
                                    VALUES ($1, $2, 'recipe_purchase', $3, $4, 'completed', $5)
                                `, [null, adminId, adminCut, `Stripe Sale (Platform Fee): "${recipe?.name || recipeId}"`, `STRIPE-REC-A-${session.id}`]);
                            }
                        }

                        console.log(`Recipe purchase fulfilled via webhook. Buyer: ${userId}, Seller: ${sellerId}, Recipe: ${recipeId}`);
                    }
                } else if (type === 'book_purchase') {
                    const bookId = session.metadata.bookId;

                    // Check if already processed
                    const existing = await client.query(
                        'SELECT id FROM book_purchases WHERE stripe_session_id = $1',
                        [session.id]
                    );

                    if (existing.rows.length === 0) {
                        const bookResult = await client.query('SELECT user_id, price, title FROM books WHERE id = $1', [bookId]);
                        const book = bookResult.rows[0];
                        const pricePaid = book?.price || 0;
                        const sellerId = book?.user_id;

                        await client.query(`
                            INSERT INTO book_purchases (buyer_id, book_id, price_paid, stripe_session_id)
                            VALUES ($1, $2, $3, $4)
                        `, [userId, bookId, pricePaid, session.id]);

                        await client.query(`
                            INSERT INTO transactions (user_id, transaction_id, type, plan, amount, status, stripe_session_id)
                            VALUES ($1, $2, 'book_purchase', $3, $4, 'completed', $5)
                        `, [
                            userId,
                            `TXN-BOOK-${Date.now()}`,
                            `Book: ${book?.title || bookId}`,
                            pricePaid,
                            session.id
                        ]);

                        if (sellerId) {
                            const sellerCut = pricePaid * 0.8;
                            const adminCut = pricePaid - sellerCut;
                            
                            // Credit seller wallet (80%)
                            await client.query('INSERT INTO wallet_balances (user_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [sellerId]);
                            await client.query('UPDATE wallet_balances SET balance = balance + $1 WHERE user_id = $2', [sellerCut, sellerId]);
                            
                            // Record seller side transaction
                            await client.query(`
                                INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
                                VALUES ($1, $2, 'book_purchase', $3, $4, 'completed', $5)
                            `, [null, sellerId, sellerCut, `Stripe Sale (Seller Cut): "${book?.title || bookId}"`, `STRIPE-BOOK-S-${session.id}`]);

                            // Credit admin wallet (20%)
                            const adminResult = await client.query('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
                            const adminId = adminResult.rows[0]?.id;
                            if (adminId) {
                                await client.query('INSERT INTO wallet_balances (user_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [adminId]);
                                await client.query('UPDATE wallet_balances SET balance = balance + $1 WHERE user_id = $2', [adminCut, adminId]);
                                
                                await client.query(`
                                    INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
                                    VALUES ($1, $2, 'book_purchase', $3, $4, 'completed', $5)
                                `, [null, adminId, adminCut, `Stripe Sale (Platform Fee): "${book?.title || bookId}"`, `STRIPE-BOOK-A-${session.id}`]);
                            }
                        }

                        console.log(`Book purchase fulfilled via webhook. Buyer: ${userId}, Seller: ${sellerId}, Book: ${bookId}`);
                    }
                } else {
                    const planId = session.metadata.planId;
                    if (!planId) break;

                    // Fulfill subscription using helper
                    await fulfillSubscription(
                        userId,
                        planId,
                        PLANS[planId].price,
                        'stripe',
                        session.id,
                        session.customer || null,
                        client
                    );
                    
                    console.log(`Subscription created/updated via webhook for user ${userId} - Plan: ${planId}`);
                }
                
                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        } catch (dbError) {
            console.error('Database error in webhook:', dbError);
        }
        break;
        }


        case 'customer.subscription.deleted': {
            // Handle subscription cancellation from Stripe
            const subscription = event.data.object;
            console.log('Subscription cancelled:', subscription.id);
            // Optional: Update subscription status in database
            break;
        }

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
});

// Get Stripe publishable key (for frontend)
router.get('/stripe-key', (req, res) => {
    res.json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });
});

export default router;
