// Wallet Routes - Send money to any account
import express from 'express';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ===== Ensure wallet tables exist =====
async function ensureWalletTables() {
    const db = getDatabase();
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS wallet_balances (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                currency TEXT NOT NULL DEFAULT 'USD',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS wallet_transactions (
                id SERIAL PRIMARY KEY,
                sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                receiver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                type TEXT NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                fee DECIMAL(12,2) DEFAULT 0.00,
                note TEXT,
                status TEXT NOT NULL DEFAULT 'completed',
                reference_id TEXT UNIQUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (err) {
        console.error('Wallet table init error:', err.message);
    }
}

// Run on import
ensureWalletTables();

// Helper: get or create wallet for a user
async function getOrCreateWallet(db, userId) {
    let result = await db.query('SELECT * FROM wallet_balances WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
        result = await db.query(
            'INSERT INTO wallet_balances (user_id, balance) VALUES ($1, 0.00) RETURNING *',
            [userId]
        );
    }
    return result.rows[0];
}

// ===== GET /api/wallet/balance — Get own wallet balance =====
router.get('/balance', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const wallet = await getOrCreateWallet(db, req.user.userId);

        res.json({
            balance: parseFloat(wallet.balance),
            currency: wallet.currency,
            updatedAt: wallet.updated_at
        });
    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({ error: 'Failed to get balance' });
    }
});

// ===== POST /api/wallet/deposit — Add funds to own wallet =====
router.post('/deposit', authenticateToken, async (req, res) => {
    try {
        const { amount, cardLast4, cardBrand } = req.body;
        const depositAmount = parseFloat(amount);

        if (!depositAmount || depositAmount <= 0 || depositAmount > 10000) {
            return res.status(400).json({ error: 'Invalid deposit amount. Must be between $0.01 and $10,000.' });
        }

        const db = getDatabase();
        const wallet = await getOrCreateWallet(db, req.user.userId);

        const newBalance = parseFloat(wallet.balance) + depositAmount;
        const referenceId = `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

        // Update balance
        await db.query(
            'UPDATE wallet_balances SET balance = $1, updated_at = NOW() WHERE user_id = $2',
            [newBalance, req.user.userId]
        );

        // Record transaction
        await db.query(
            `INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
             VALUES (NULL, $1, 'deposit', $2, $3, 'completed', $4)`,
            [req.user.userId, depositAmount, `Deposit via ${cardBrand || 'Card'} ending ${cardLast4 || '****'}`, referenceId]
        );

        res.json({
            success: true,
            message: `$${depositAmount.toFixed(2)} deposited successfully`,
            balance: newBalance,
            referenceId
        });
    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({ error: 'Failed to process deposit' });
    }
});

// ===== POST /api/wallet/transfer — Send money to any user =====
router.post('/transfer', authenticateToken, async (req, res) => {
    try {
        const { recipientUsername, amount, note } = req.body;
        const transferAmount = parseFloat(amount);

        if (!recipientUsername || !recipientUsername.trim()) {
            return res.status(400).json({ error: 'Recipient username is required' });
        }

        if (!transferAmount || transferAmount <= 0) {
            return res.status(400).json({ error: 'Transfer amount must be greater than $0.00' });
        }

        if (transferAmount > 5000) {
            return res.status(400).json({ error: 'Maximum transfer amount is $5,000' });
        }

        const db = getDatabase();
        const senderId = req.user.userId;

        // Find recipient
        const recipientResult = await db.query(
            'SELECT id, username, display_name, profile_picture FROM users WHERE LOWER(username) = LOWER($1)',
            [recipientUsername.trim()]
        );

        if (recipientResult.rows.length === 0) {
            return res.status(404).json({ error: 'Recipient account not found' });
        }

        const recipient = recipientResult.rows[0];

        if (recipient.id === senderId) {
            return res.status(400).json({ error: 'You cannot send money to yourself' });
        }

        // Check sender balance
        const senderWallet = await getOrCreateWallet(db, senderId);
        if (parseFloat(senderWallet.balance) < transferAmount) {
            return res.status(400).json({ 
                error: 'Insufficient funds',
                balance: parseFloat(senderWallet.balance)
            });
        }

        // Get or create recipient wallet
        const recipientWallet = await getOrCreateWallet(db, recipient.id);

        const referenceId = `TRF-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const senderNewBalance = parseFloat(senderWallet.balance) - transferAmount;
        const recipientNewBalance = parseFloat(recipientWallet.balance) + transferAmount;

        // Begin pseudo-transaction (update sender, update recipient, record)
        await db.query(
            'UPDATE wallet_balances SET balance = $1, updated_at = NOW() WHERE user_id = $2',
            [senderNewBalance, senderId]
        );

        await db.query(
            'UPDATE wallet_balances SET balance = $1, updated_at = NOW() WHERE user_id = $2',
            [recipientNewBalance, recipient.id]
        );

        // Record transaction
        await db.query(
            `INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
             VALUES ($1, $2, 'transfer', $3, $4, 'completed', $5)`,
            [senderId, recipient.id, transferAmount, note || `Transfer to @${recipient.username}`, referenceId]
        );

        res.json({
            success: true,
            message: `$${transferAmount.toFixed(2)} sent to @${recipient.username}`,
            balance: senderNewBalance,
            referenceId,
            recipient: {
                username: recipient.username,
                displayName: recipient.display_name,
                pic: recipient.profile_picture
            }
        });
    } catch (error) {
        console.error('Transfer error:', error);
        res.status(500).json({ error: 'Failed to process transfer' });
    }
});

// ===== GET /api/wallet/transactions — Get transaction history =====
router.get('/transactions', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const userId = req.user.userId;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        const result = await db.query(`
            SELECT 
                wt.*,
                su.username as sender_username,
                su.display_name as sender_name,
                su.profile_picture as sender_pic,
                ru.username as receiver_username,
                ru.display_name as receiver_name,
                ru.profile_picture as receiver_pic
            FROM wallet_transactions wt
            LEFT JOIN users su ON wt.sender_id = su.id
            LEFT JOIN users ru ON wt.receiver_id = ru.id
            WHERE wt.sender_id = $1 OR wt.receiver_id = $1
            ORDER BY wt.created_at DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        const transactions = result.rows.map(tx => ({
            id: tx.id,
            type: tx.type,
            amount: parseFloat(tx.amount),
            fee: parseFloat(tx.fee || 0),
            note: tx.note,
            status: tx.status,
            referenceId: tx.reference_id,
            createdAt: tx.created_at,
            direction: tx.sender_id === userId ? 'sent' : 'received',
            sender: tx.sender_id ? {
                username: tx.sender_username,
                name: tx.sender_name,
                pic: tx.sender_pic
            } : null,
            receiver: tx.receiver_id ? {
                username: tx.receiver_username,
                name: tx.receiver_name,
                pic: tx.receiver_pic
            } : null
        }));

        res.json(transactions);
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Failed to get transactions' });
    }
});

// ===== POST /api/wallet/purchase — Purchase subscription or recipe using wallet =====
router.post('/purchase', authenticateToken, async (req, res) => {
    try {
        const { type, planId, recipeId, amount } = req.body;
        const purchaseAmount = parseFloat(amount);

        if (!purchaseAmount || purchaseAmount <= 0) {
            return res.status(400).json({ error: 'Invalid purchase amount' });
        }

        const db = getDatabase();
        const userId = req.user.userId;

        // Check user balance
        const wallet = await getOrCreateWallet(db, userId);
        if (parseFloat(wallet.balance) < purchaseAmount) {
            return res.status(400).json({ 
                error: 'Insufficient funds in wallet',
                balance: parseFloat(wallet.balance)
            });
        }

        // 1. Deduct from balance
        const newBalance = parseFloat(wallet.balance) - purchaseAmount;
        await db.query(
            'UPDATE wallet_balances SET balance = $1, updated_at = NOW() WHERE user_id = $2',
            [newBalance, userId]
        );

        const referenceId = `WLT-PUR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

        // 2. Record wallet transaction
        let note = '';
        if (type === 'subscription') {
            note = `Premium Subscription: ${planId}`;
        } else if (type === 'recipe') {
            note = `Recipe Purchase: #${recipeId}`;
        }

        await db.query(
            `INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
             VALUES ($1, NULL, 'purchase', $2, $3, 'completed', $4)`,
            [userId, purchaseAmount, note, referenceId]
        );

        // 3. Fulfill the order
        if (type === 'subscription') {
            // Find plan details (duplicated from subscriptions.js for simplicity, or we could import them)
            const PLANS = {
                monthly: { durationDays: 30 },
                yearly: { durationDays: 365 }
            };
            const plan = PLANS[planId];
            if (!plan) throw new Error('Invalid plan ID');

            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + (planId === 'lifetime' ? 36500 : plan.durationDays));

            // Check for existing subscription
            const existingSubResult = await db.query('SELECT id FROM subscriptions WHERE user_id = $1', [userId]);
            const existingSub = existingSubResult.rows[0];

            if (existingSub) {
                await db.query(`
                    UPDATE subscriptions SET
                        plan = $1, status = 'active', start_date = $2, end_date = $3,
                        auto_renew = $4, updated_at = NOW(), granted_by_admin = 0,
                        cancelled_at = NULL, stripe_session_id = NULL
                    WHERE user_id = $5
                `, [planId, startDate.toISOString(), endDate.toISOString(), planId !== 'lifetime' ? 1 : 0, userId]);
            } else {
                await db.query(`
                    INSERT INTO subscriptions (user_id, plan, status, start_date, end_date, auto_renew)
                    VALUES ($1, $2, 'active', $3, $4, $5)
                `, [userId, planId, startDate.toISOString(), endDate.toISOString(), planId !== 'lifetime' ? 1 : 0]);
            }

            // Also add to transactions table for unified history
            await db.query(`
                INSERT INTO transactions (user_id, transaction_id, type, plan, amount, status)
                VALUES ($1, $2, 'subscription', $3, $4, 'completed')
            `, [userId, `TXN-WLT-${Date.now()}`, planId, purchaseAmount]);

        } else if (type === 'recipe') {
            // Record purchase
            await db.query(`
                INSERT INTO store_purchases (buyer_id, store_recipe_id, price_paid)
                VALUES ($1, $2, $3)
            `, [userId, recipeId, purchaseAmount]);

            // Also add to transactions table
            await db.query(`
                INSERT INTO transactions (user_id, transaction_id, type, plan, amount, status)
                VALUES ($1, $2, 'recipe_purchase', $3, $4, 'completed')
            `, [userId, `TXN-RECIPE-WLT-${Date.now()}`, `Recipe #${recipeId}`, purchaseAmount]);
        }

        res.json({
            success: true,
            balance: newBalance,
            referenceId,
            message: 'Purchase completed successfully using wallet balance'
        });

    } catch (error) {
        console.error('Wallet purchase error:', error);
        res.status(500).json({ error: 'Failed to process wallet purchase' });
    }
});

// ===== GET /api/wallet/search-users — Search users for transfer =====
router.get('/search-users', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json([]);
        }

        const db = getDatabase();
        const result = await db.query(`
            SELECT id, username, display_name, profile_picture
            FROM users
            WHERE (LOWER(username) LIKE $1 OR LOWER(display_name) LIKE $1)
            AND id != $2
            AND is_admin != 1
            ORDER BY username ASC
            LIMIT 10
        `, [`%${q.toLowerCase()}%`, req.user.userId]);

        res.json(result.rows.map(u => ({
            id: u.id,
            username: u.username,
            displayName: u.display_name,
            pic: u.profile_picture
        })));
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

export default router;
