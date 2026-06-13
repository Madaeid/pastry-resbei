// Wallet Routes - Send money to any account
import express from 'express';
import crypto from 'crypto';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { fulfillSubscription } from '../utils/subscriptionHelper.js';
import currencyUtils from '../utils/currency.js';
import { validate } from '../middleware/validate.js';
import { depositSchema, transferSchema, changeCurrencySchema } from '../utils/validators.js';

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
async function getOrCreateWallet(db, userId, forUpdate = false) {
    const lockClause = forUpdate ? ' FOR UPDATE' : '';
    let result = await db.query(`SELECT * FROM wallet_balances WHERE user_id = $1${lockClause}`, [userId]);
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
router.post('/deposit', validate(depositSchema), authenticateToken, async (req, res) => {
    try {
        const { amount, cardLast4, cardBrand } = req.body;
        const depositAmount = parseFloat(amount);
        const referenceId = `DEP-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

        const db = getDatabase();
        const client = await db.connect();
        
        try {
            await client.query('BEGIN');
            const wallet = await getOrCreateWallet(client, req.user.userId, true);

            // Update balance atomically using DB calculation
            const updateResult = await client.query(
                'UPDATE wallet_balances SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2 RETURNING balance',
                [depositAmount, req.user.userId]
            );
            const newBalance = parseFloat(updateResult.rows[0].balance);

            // Record transaction
            await client.query(
                `INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
                 VALUES (NULL, $1, 'deposit', $2, $3, 'completed', $4)`,
                [req.user.userId, depositAmount, `Deposit via ${cardBrand || 'Card'} ending ${cardLast4 || '****'}`, referenceId]
            );

            await client.query('COMMIT');
            res.json({
                success: true,
                message: `$${depositAmount.toFixed(2)} deposited successfully`,
                balance: newBalance,
                referenceId
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({ error: 'Failed to process deposit' });
    }
});

// ===== POST /api/wallet/transfer — Send money to any user =====
router.post('/transfer', validate(transferSchema), authenticateToken, async (req, res) => {
    try {
        const { recipientUsername, amount, note } = req.body;
        const transferAmount = parseFloat(amount);

        const db = getDatabase();
        const senderId = req.user.userId;

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // Find recipient
            const recipientResult = await client.query(
                'SELECT id, username, display_name, profile_picture FROM users WHERE LOWER(username) = LOWER($1)',
                [recipientUsername.trim()]
            );

            if (recipientResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Recipient account not found' });
            }

            const recipient = recipientResult.rows[0];

            if (recipient.id === senderId) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'You cannot send money to yourself' });
            }

            // Check sender balance - with FOR UPDATE lock
            const senderWallet = await getOrCreateWallet(client, senderId, true);
            if (parseFloat(senderWallet.balance) < transferAmount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: 'Insufficient funds',
                    balance: parseFloat(senderWallet.balance)
                });
            }

            // Get or create recipient wallet - with FOR UPDATE lock
            const recipientWallet = await getOrCreateWallet(client, recipient.id, true);

            const referenceId = `TRF-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
            
            // Handle currency conversion
            const recipientAmount = await currencyUtils.convertCurrency(
                transferAmount, 
                senderWallet.currency, 
                recipientWallet.currency
            );

            let finalNote = note || `Transfer to @${recipient.username}`;
            if (senderWallet.currency !== recipientWallet.currency) {
                finalNote += ` (Converted from ${transferAmount.toFixed(2)} ${senderWallet.currency} to ${recipientAmount.toFixed(2)} ${recipientWallet.currency})`;
            }

            // Update sender atomically
            const senderUpdateRes = await client.query(
                'UPDATE wallet_balances SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2 RETURNING balance',
                [transferAmount, senderId]
            );
            const senderNewBalance = parseFloat(senderUpdateRes.rows[0].balance);

            // Update recipient atomically
            await client.query(
                'UPDATE wallet_balances SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
                [recipientAmount, recipient.id]
            );

            // Record transaction
            await client.query(
                `INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
                 VALUES ($1, $2, 'transfer', $3, $4, 'completed', $5)`,
                [senderId, recipient.id, transferAmount, finalNote, referenceId]
            );

            await client.query('COMMIT');

            res.json({
                success: true,
                message: `${transferAmount.toFixed(2)} ${senderWallet.currency} sent to @${recipient.username}`,
                balance: senderNewBalance,
                currency: senderWallet.currency,
                referenceId,
                recipient: {
                    username: recipient.username,
                    displayName: recipient.display_name,
                    pic: recipient.profile_picture
                }
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
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
        const client = await db.connect();

        try {
            await client.query('BEGIN');

            // Check user balance - with FOR UPDATE lock
            const wallet = await getOrCreateWallet(client, userId, true);
            if (parseFloat(wallet.balance) < purchaseAmount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: 'Insufficient funds in wallet',
                    balance: parseFloat(wallet.balance)
                });
            }

            // Prevent double-purchasing recipes
            if (type === 'recipe') {
                const existingPurchase = await client.query(
                    'SELECT id FROM store_purchases WHERE buyer_id = $1 AND store_recipe_id = $2',
                    [userId, recipeId]
                );
                if (existingPurchase.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'You have already purchased this recipe' });
                }
            }

            // 1. Deduct from balance atomically
            const updateResult = await client.query(
                'UPDATE wallet_balances SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2 RETURNING balance',
                [purchaseAmount, userId]
            );
            const newBalance = parseFloat(updateResult.rows[0].balance);

            const referenceId = `WLT-PUR-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

            // 2. Record wallet transaction
            let note = '';
            if (type === 'subscription') {
                note = `Premium Subscription: ${planId}`;
            } else if (type === 'recipe') {
                note = `Recipe Purchase: #${recipeId}`;
            }

            await client.query(
                `INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
                 VALUES ($1, NULL, 'purchase', $2, $3, 'completed', $4)`,
                [userId, purchaseAmount, note, referenceId]
            );

            // 3. Fulfill the order
            if (type === 'subscription') {
                // fulfillSubscription uses its own queries, we should pass the client if possible to keep it atomic.
                // However, fulfillSubscription is an external util. For true atomicity, it should accept a client.
                await fulfillSubscription(userId, planId, purchaseAmount, 'wallet', null, null, client);
            } else if (type === 'recipe') {
                // Record purchase in store_purchases
                await client.query(`
                    INSERT INTO store_purchases (buyer_id, store_recipe_id, price_paid)
                    VALUES ($1, $2, $3)
                `, [userId, recipeId, purchaseAmount]);

                // Also add to transactions table for unified history
                await client.query(`
                    INSERT INTO transactions (user_id, transaction_id, type, plan, amount, status)
                    VALUES ($1, $2, 'recipe_purchase', $3, $4, 'completed')
                `, [userId, `TXN-RECIPE-WLT-${Date.now()}`, `Recipe #${recipeId}`, purchaseAmount]);
                
                // Note: Revenue split (80/20) should ideally be handled here too if not already.
                // But for now, we'll maintain the existing logic structure.
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                balance: newBalance,
                referenceId,
                message: 'Purchase completed successfully using wallet balance'
            });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
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
            AND is_admin = false
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

// ===== POST /api/wallet/settings/currency — Change base currency =====
router.post('/settings/currency', validate(changeCurrencySchema), authenticateToken, async (req, res) => {
    try {
        const { newCurrency } = req.body;
        
        const targetCurrency = newCurrency.toUpperCase();
        const db = getDatabase();
        const client = await db.connect();
        
        try {
            await client.query('BEGIN');
            const wallet = await getOrCreateWallet(client, req.user.userId, true);
            
            if (wallet.currency === targetCurrency) {
                await client.query('ROLLBACK');
                return res.json({ success: true, message: 'Currency already set to ' + targetCurrency });
            }
            
            // Convert current balance
            const newBalance = await currencyUtils.convertCurrency(
                parseFloat(wallet.balance), 
                wallet.currency, 
                targetCurrency
            );
            
            await client.query(
                'UPDATE wallet_balances SET balance = $1, currency = $2, updated_at = NOW() WHERE user_id = $3',
                [newBalance, targetCurrency, req.user.userId]
            );
            
            await client.query('COMMIT');
            
            res.json({ 
                success: true, 
                message: 'Currency updated successfully', 
                balance: newBalance, 
                currency: targetCurrency 
            });
            
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('Change currency error:', error);
        res.status(500).json({ error: 'Failed to change currency' });
    }
});

export default router;
