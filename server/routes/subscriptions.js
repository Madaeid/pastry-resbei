// Subscription Routes
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ===== Subscription Plans =====
const PLANS = {
    monthly: {
        id: 'monthly',
        name: 'Monthly',
        price: 2.00,
        originalPrice: 5.00,
        discount: 60,
        period: 'month',
        durationDays: 30,
        displayPrice: '$2.00/month'
    },
    yearly: {
        id: 'yearly',
        name: 'Yearly',
        price: 39.99,
        period: 'year',
        durationDays: 365,
        displayPrice: '$39.99/year'
    },
    lifetime: {
        id: 'lifetime',
        name: 'Lifetime',
        price: 5.00,
        originalPrice: 100.00,
        discount: 95,
        period: 'lifetime',
        durationDays: 36500, // ~100 years
        displayPrice: '$5.00 one-time'
    }
};

// ===== Get Plans =====
router.get('/plans', (req, res) => {
    res.json(PLANS);
});

// ===== Check Premium Status =====
router.get('/status', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();

        // Check if user is admin
        const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.userId);
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
        const subscription = db.prepare(`
            SELECT * FROM subscriptions WHERE user_id = ?
        `).get(req.user.userId);

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
            autoRenew: subscription.auto_renew === 1,
            message: `Premium ${PLANS[subscription.plan]?.name || 'Plan'}`
        });

    } catch (error) {
        console.error('Get subscription status error:', error);
        res.status(500).json({ error: 'Failed to get subscription status' });
    }
});

// ===== Get Subscription Details =====
router.get('/details', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const subscription = db.prepare(`
            SELECT * FROM subscriptions WHERE user_id = ?
        `).get(req.user.userId);

        if (!subscription) {
            return res.json(null);
        }

        res.json({
            plan: subscription.plan,
            status: subscription.status,
            startDate: subscription.start_date,
            endDate: subscription.end_date,
            autoRenew: subscription.auto_renew === 1,
            grantedByAdmin: subscription.granted_by_admin === 1,
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
        const existingSub = db.prepare('SELECT id FROM subscriptions WHERE user_id = ?').get(req.user.userId);

        if (existingSub) {
            // Update existing
            db.prepare(`
                UPDATE subscriptions SET
                    plan = ?,
                    status = 'active',
                    start_date = ?,
                    end_date = ?,
                    payment_last4 = ?,
                    payment_brand = ?,
                    payment_expiry = ?,
                    auto_renew = ?,
                    granted_by_admin = 0,
                    cancelled_at = NULL,
                    updated_at = ?
                WHERE user_id = ?
            `).run(
                plan,
                startDate.toISOString(),
                endDate.toISOString(),
                cardNumber.slice(-4),
                getCardBrand(cardNumber),
                cardData.cardExpiry,
                plan !== 'lifetime' ? 1 : 0,
                new Date().toISOString(),
                req.user.userId
            );
        } else {
            // Create new
            db.prepare(`
                INSERT INTO subscriptions (user_id, plan, status, start_date, end_date, payment_last4, payment_brand, payment_expiry, auto_renew)
                VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?)
            `).run(
                req.user.userId,
                plan,
                startDate.toISOString(),
                endDate.toISOString(),
                cardNumber.slice(-4),
                getCardBrand(cardNumber),
                cardData.cardExpiry,
                plan !== 'lifetime' ? 1 : 0
            );
        }

        // Add transaction
        db.prepare(`
            INSERT INTO transactions (user_id, transaction_id, type, plan, amount, status, payment_last4, payment_brand)
            VALUES (?, ?, 'subscription', ?, ?, 'completed', ?, ?)
        `).run(
            req.user.userId,
            `TXN-${Date.now()}`,
            plan,
            PLANS[plan].price,
            cardNumber.slice(-4),
            getCardBrand(cardNumber)
        );

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
router.post('/cancel', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();

        const subscription = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.user.userId);
        if (!subscription) {
            return res.status(400).json({ error: 'No active subscription' });
        }

        db.prepare(`
            UPDATE subscriptions SET
                status = 'cancelled',
                auto_renew = 0,
                cancelled_at = ?,
                updated_at = ?
            WHERE user_id = ?
        `).run(
            new Date().toISOString(),
            new Date().toISOString(),
            req.user.userId
        );

        // Add transaction
        db.prepare(`
            INSERT INTO transactions (user_id, transaction_id, type, plan, amount, status)
            VALUES (?, ?, 'cancellation', ?, 0, 'completed')
        `).run(
            req.user.userId,
            `TXN-${Date.now()}`,
            subscription.plan
        );

        res.json({ success: true, message: 'Subscription cancelled' });

    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
});

// ===== Get Transaction History =====
router.get('/transactions', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const transactions = db.prepare(`
            SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
        `).all(req.user.userId);

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

export default router;
