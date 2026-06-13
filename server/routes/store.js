import { uploadMedia } from '../utils/cloudinary.js';
// Store Routes - Recipe Marketplace
import express from 'express';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import currencyUtils from '../utils/currency.js';
import { validate } from '../middleware/validate.js';
import { storeRecipeSchema, updateStoreRecipeSchema } from '../utils/validators.js';
import { createRecipeCheckoutSession, verifyCheckoutSession } from '../config/stripe.js';

const router = express.Router();

// ===== Get All Store Recipes (Public - Preview Only) =====
router.get('/', async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT sr.id, sr.name, sr.photo, sr.price, sr.category, sr.difficulty,
                   sr.prep_time, sr.cook_time, sr.created_at,
                   u.display_name as seller_name, u.profile_picture as seller_pic, u.username as seller_username
            FROM store_recipes sr
            JOIN users u ON sr.seller_id = u.id
            WHERE sr.is_active = TRUE
            ORDER BY sr.created_at DESC
        `);

        res.json(result.rows.map(r => ({
            id: r.id,
            name: r.name,
            photo: r.photo,
            price: parseFloat(r.price),
            category: r.category,
            difficulty: r.difficulty,
            prepTime: r.prep_time,
            cookTime: r.cook_time,
            createdAt: r.created_at,
            seller: {
                name: r.seller_name,
                pic: r.seller_pic,
                username: r.seller_username
            }
        })));
    } catch (error) {
        console.error('Get store recipes error:', error);
        res.status(500).json({ error: 'Failed to get store recipes' });
    }
});

// ===== Get Recipe Preview (Public) =====
router.get('/:id/preview', async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT sr.id, sr.name, sr.description, sr.photo, sr.price, sr.category, sr.difficulty,
                   sr.prep_time, sr.cook_time, sr.created_at,
                   u.display_name as seller_name, u.profile_picture as seller_pic, u.username as seller_username
            FROM store_recipes sr
            JOIN users u ON sr.seller_id = u.id
            WHERE sr.id = $1 AND sr.is_active = TRUE
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        const r = result.rows[0];
        res.json({
            id: r.id,
            name: r.name,
            description: r.description,
            photo: r.photo,
            price: parseFloat(r.price),
            category: r.category,
            difficulty: r.difficulty,
            prepTime: r.prep_time,
            cookTime: r.cook_time,
            createdAt: r.created_at,
            seller: {
                name: r.seller_name,
                pic: r.seller_pic,
                username: r.seller_username
            }
        });
    } catch (error) {
        console.error('Get recipe preview error:', error);
        res.status(500).json({ error: 'Failed to get recipe preview' });
    }
});

// ===== Get Full Recipe (Auth Required - Must be owner or purchaser) =====
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const recipeResult = await db.query(`
            SELECT sr.*, u.display_name as seller_name, u.profile_picture as seller_pic, u.username as seller_username
            FROM store_recipes sr
            JOIN users u ON sr.seller_id = u.id
            WHERE sr.id = $1
        `, [req.params.id]);

        if (recipeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        const recipe = recipeResult.rows[0];

        // Check if user is the seller
        const isSeller = Number(recipe.seller_id) === Number(req.user.userId);

        // Check if user has purchased
        let hasPurchased = false;
        if (!isSeller) {
            const purchaseCheck = await db.query(
                'SELECT id FROM store_purchases WHERE buyer_id = $1 AND store_recipe_id = $2',
                [req.user.userId, req.params.id]
            );
            hasPurchased = purchaseCheck.rows.length > 0;
        }

        if (!isSeller && !hasPurchased) {
            return res.status(403).json({
                error: 'Purchase required to view this recipe',
                preview: true,
                recipe: {
                    id: recipe.id,
                    name: recipe.name,
                    photo: recipe.photo,
                    price: parseFloat(recipe.price),
                    seller: {
                        name: recipe.seller_name,
                        pic: recipe.seller_pic,
                        username: recipe.seller_username
                    }
                }
            });
        }

        // Return full recipe
        res.json({
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            category: recipe.category,
            difficulty: recipe.difficulty,
            prepTime: recipe.prep_time,
            cookTime: recipe.cook_time,
            photo: recipe.photo,
            video: recipe.video,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            notes: recipe.notes,
            price: parseFloat(recipe.price),
            createdAt: recipe.created_at,
            isSeller: isSeller,
            seller: {
                name: recipe.seller_name,
                pic: recipe.seller_pic,
                username: recipe.seller_username
            }
        });
    } catch (error) {
        console.error('Get store recipe error:', error);
        res.status(500).json({ error: 'Failed to get recipe' });
    }
});

// ===== Create Store Recipe =====
router.post('/', validate(storeRecipeSchema), authenticateToken, async (req, res) => {
    try {
        let { name, description, category, difficulty, prepTime, cookTime, photo, video, ingredients, instructions, notes, price } = req.body;
        if (photo) photo = await uploadMedia(photo, 'store');
        if (video) video = await uploadMedia(video, 'store');

        const db = getDatabase();
        const result = await db.query(`
            INSERT INTO store_recipes (seller_id, name, description, category, difficulty, prep_time, cook_time, photo, video, ingredients, instructions, notes, price)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id
        `, [req.user.userId, name, description || '', category || 'Other', difficulty || 'Medium', prepTime || 0, cookTime || 0, photo || null, video || null, ingredients || '', instructions || '', notes || '', price]);

        res.status(201).json({ success: true, id: result.rows[0].id, message: 'Recipe listed in store!' });
    } catch (error) {
        console.error('Create store recipe error:', error);
        res.status(500).json({ error: 'Failed to list recipe' });
    }
});

// ===== Update Store Recipe =====
router.put('/:id', validate(updateStoreRecipeSchema), authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();

        // Verify ownership
        const check = await db.query('SELECT seller_id FROM store_recipes WHERE id = $1', [req.params.id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Recipe not found' });
        if (Number(check.rows[0].seller_id) !== Number(req.user.userId)) return res.status(403).json({ error: 'Unauthorized' });

        let { name, description, category, difficulty, prepTime, cookTime, photo, video, ingredients, instructions, notes, price } = req.body;
        if (photo) photo = await uploadMedia(photo, 'store');
        if (video) video = await uploadMedia(video, 'store');

        await db.query(`
            UPDATE store_recipes SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                category = COALESCE($3, category),
                difficulty = COALESCE($4, difficulty),
                prep_time = COALESCE($5, prep_time),
                cook_time = COALESCE($6, cook_time),
                photo = COALESCE($7, photo),
                video = COALESCE($8, video),
                ingredients = COALESCE($9, ingredients),
                instructions = COALESCE($10, instructions),
                notes = COALESCE($11, notes),
                price = COALESCE($12, price),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $13
        `, [name, description, category, difficulty, prepTime, cookTime, photo, video, ingredients, instructions, notes, price, req.params.id]);

        res.json({ success: true, message: 'Recipe updated!' });
    } catch (error) {
        console.error('Update store recipe error:', error);
        res.status(500).json({ error: 'Failed to update recipe' });
    }
});

// ===== Delete Store Recipe =====
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();

        // Verify ownership
        const check = await db.query('SELECT seller_id FROM store_recipes WHERE id = $1', [req.params.id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Recipe not found' });
        if (Number(check.rows[0].seller_id) !== Number(req.user.userId)) return res.status(403).json({ error: 'Unauthorized' });

        await db.query('DELETE FROM store_recipes WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Recipe removed from store' });
    } catch (error) {
        console.error('Delete store recipe error:', error);
        res.status(500).json({ error: 'Failed to delete recipe' });
    }
});

// ===== Purchase Recipe =====
router.post('/:id/purchase', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();

        // Get recipe info
        const recipeResult = await db.query('SELECT id, seller_id, price, name FROM store_recipes WHERE id = $1 AND is_active = TRUE', [req.params.id]);
        if (recipeResult.rows.length === 0) return res.status(404).json({ error: 'Recipe not found' });

        const recipe = recipeResult.rows[0];
        const recipePrice = parseFloat(recipe.price) || 0;

        // Can't buy your own recipe
        if (Number(recipe.seller_id) === Number(req.user.userId)) {
            return res.status(400).json({ error: 'You cannot purchase your own recipe' });
        }

        // If free, just record
        if (recipePrice <= 0) {
            // Check if already purchased
            const existingPurchase = await db.query(
                'SELECT id FROM store_purchases WHERE buyer_id = $1 AND store_recipe_id = $2',
                [req.user.userId, req.params.id]
            );
            if (existingPurchase.rows.length > 0) {
                return res.status(400).json({ error: 'You have already purchased this recipe' });
            }

            await db.query(
                'INSERT INTO store_purchases (buyer_id, store_recipe_id, price_paid) VALUES ($1, $2, 0)',
                [req.user.userId, req.params.id]
            );
            return res.json({ success: true, message: `Successfully added "${recipe.name}" to your collection!` });
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // Check buyer wallet balance - WITH FOR UPDATE lock
            const buyerWalletResult = await client.query('SELECT balance, currency FROM wallet_balances WHERE user_id = $1 FOR UPDATE', [req.user.userId]);
            
            // Check if already purchased (INSIDE transaction after lock to prevent race conditions)
            const existingPurchase = await client.query(
                'SELECT id FROM store_purchases WHERE buyer_id = $1 AND store_recipe_id = $2',
                [req.user.userId, req.params.id]
            );
            if (existingPurchase.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'You have already purchased this recipe' });
            }

            const buyerBalance = parseFloat(buyerWalletResult.rows[0]?.balance || 0);
            const buyerCurrency = buyerWalletResult.rows[0]?.currency || 'USD';

            // Get seller's currency
            const sellerWalletResult = await client.query('SELECT currency FROM wallet_balances WHERE user_id = $1 FOR UPDATE', [recipe.seller_id]);
            const sellerCurrency = sellerWalletResult.rows[0]?.currency || 'USD';

            // Convert recipe price to buyer's currency
            const priceInBuyerCurrency = await currencyUtils.convertCurrency(recipePrice, sellerCurrency, buyerCurrency);

            if (buyerBalance < priceInBuyerCurrency) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: `Insufficient wallet balance. Need ${priceInBuyerCurrency.toFixed(2)} ${buyerCurrency}` 
                });
            }

            // Deduct from buyer in their currency
            await client.query('UPDATE wallet_balances SET balance = balance - $1 WHERE user_id = $2', [priceInBuyerCurrency, req.user.userId]);

            // Credit seller (80%) in their currency
            const sellerCut = recipePrice * 0.8;
            const adminCut = recipePrice - sellerCut; // Remaining 20%
            
            await client.query('INSERT INTO wallet_balances (user_id, balance, currency) VALUES ($1, 0, $2) ON CONFLICT DO NOTHING', [recipe.seller_id, sellerCurrency]);
            await client.query('UPDATE wallet_balances SET balance = balance + $1 WHERE user_id = $2', [sellerCut, recipe.seller_id]);

            // Credit admin (20%) - assume admin ID 1 is main admin, get their currency
            const adminResult = await client.query('SELECT id FROM users WHERE is_admin = true ORDER BY id ASC LIMIT 1');
            const adminId = adminResult.rows[0]?.id;
            if (adminId) {
                const adminWalletResult = await client.query('SELECT currency FROM wallet_balances WHERE user_id = $1 FOR UPDATE', [adminId]);
                const adminCurrency = adminWalletResult.rows[0]?.currency || 'USD';
                const adminCutConverted = await currencyUtils.convertCurrency(adminCut, sellerCurrency, adminCurrency);
                
                await client.query('INSERT INTO wallet_balances (user_id, balance, currency) VALUES ($1, 0, $2) ON CONFLICT DO NOTHING', [adminId, adminCurrency]);
                await client.query('UPDATE wallet_balances SET balance = balance + $1 WHERE user_id = $2', [adminCutConverted, adminId]);
            }

            // Record purchase
            await client.query(
                'INSERT INTO store_purchases (buyer_id, store_recipe_id, price_paid) VALUES ($1, $2, $3)',
                [req.user.userId, req.params.id, recipePrice]
            );

            // Record transactions
            const refId = `REC-PUR-${Date.now()}`;
            await client.query(
                `INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
                 VALUES ($1, $2, 'purchase', $3, $4, 'completed', $5)`,
                [req.user.userId, recipe.seller_id, sellerCut, `Recipe Purchase (Seller Cut): "${recipe.name}"`, refId + '-S']
            );
            
            if (adminId) {
                await client.query(
                    `INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
                     VALUES ($1, $2, 'purchase', $3, $4, 'completed', $5)`,
                    [req.user.userId, adminId, adminCut, `Recipe Purchase (Platform Fee): "${recipe.name}"`, refId + '-A']
                );
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                message: `Successfully purchased "${recipe.name}"!`,
                recipeId: recipe.id
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Purchase recipe error:', error);
        res.status(500).json({ error: 'Failed to purchase recipe' });
    }
});

// ===== Get My Listings =====
router.get('/my/listings', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT sr.*,
                (SELECT COUNT(*) FROM store_purchases sp WHERE sp.store_recipe_id = sr.id) as sales_count
            FROM store_recipes sr
            WHERE sr.seller_id = $1
            ORDER BY sr.created_at DESC
        `, [req.user.userId]);

        res.json(result.rows.map(r => ({
            id: r.id,
            name: r.name,
            photo: r.photo,
            price: parseFloat(r.price),
            category: r.category,
            salesCount: parseInt(r.sales_count),
            isActive: r.is_active,
            createdAt: r.created_at
        })));
    } catch (error) {
        console.error('Get my listings error:', error);
        res.status(500).json({ error: 'Failed to get listings' });
    }
});

// ===== Get My Purchases =====
router.get('/my/purchases', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT sr.id, sr.name, sr.photo, sr.price, sr.category, sr.difficulty,
                   sp.price_paid, sp.purchased_at,
                   u.display_name as seller_name, u.profile_picture as seller_pic, u.username as seller_username
            FROM store_purchases sp
            JOIN store_recipes sr ON sp.store_recipe_id = sr.id
            JOIN users u ON sr.seller_id = u.id
            WHERE sp.buyer_id = $1
            ORDER BY sp.purchased_at DESC
        `, [req.user.userId]);

        res.json(result.rows.map(r => ({
            id: r.id,
            name: r.name,
            photo: r.photo,
            price: parseFloat(r.price),
            pricePaid: parseFloat(r.price_paid),
            category: r.category,
            difficulty: r.difficulty,
            purchasedAt: r.purchased_at,
            seller: {
                name: r.seller_name,
                pic: r.seller_pic,
                username: r.seller_username
            }
        })));
    } catch (error) {
        console.error('Get my purchases error:', error);
        res.status(500).json({ error: 'Failed to get purchases' });
    }
});

// Create Stripe Checkout Session for a Recipe
router.post('/create-checkout-session', authenticateToken, async (req, res) => {
    try {
        const { recipeId, successUrl, cancelUrl } = req.body;
        const db = getDatabase();

        // Get recipe info
        const recipeResult = await db.query(`
            SELECT sr.*, u.display_name as seller_name, u.profile_picture as seller_pic, u.username as seller_username
            FROM store_recipes sr
            JOIN users u ON sr.seller_id = u.id
            WHERE sr.id = $1 AND sr.is_active = TRUE
        `, [recipeId]);

        if (recipeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        const recipe = {
            ...recipeResult.rows[0],
            price: parseFloat(recipeResult.rows[0].price),
            seller: {
                name: recipeResult.rows[0].seller_name,
                pic: recipeResult.rows[0].seller_pic,
                username: recipeResult.rows[0].seller_username
            }
        };

        // Get user email
        const userResult = await db.query('SELECT email FROM users WHERE id = $1', [req.user.userId]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create Stripe checkout session
        const session = await createRecipeCheckoutSession(
            req.user.userId,
            user.email,
            recipe,
            successUrl || `${process.env.FRONTEND_URL}/payment-success.html?type=recipe`,
            cancelUrl || `${process.env.FRONTEND_URL}/payment.html`
        );

        res.json({
            sessionId: session.id,
            url: session.url
        });

    } catch (error) {
        console.error('Create recipe checkout session error:', error.message || error);
        if (error.type) console.error('Stripe error type:', error.type);
        if (error.raw) console.error('Stripe raw error:', error.raw?.message);
        res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
});

// Verify Recipe Purchase Session
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

        const recipeId = session.metadata?.recipeId;

        if (!recipeId) {
            console.error('Missing recipeId in session metadata for sessionId:', sessionId);
            return res.status(400).json({ error: 'Invalid session metadata: recipeId missing' });
        }

        // Check if purchase already recorded
        const existingPurchase = await db.query(
            'SELECT id FROM store_purchases WHERE buyer_id = $1 AND store_recipe_id = $2',
            [req.user.userId, recipeId]
        );

        if (existingPurchase.rows.length > 0) {
            return res.json({
                success: true,
                alreadyProcessed: true,
                recipeId: recipeId
            });
        }

        // Record purchase and credit wallets
        const recipeResult = await db.query('SELECT price, seller_id, name FROM store_recipes WHERE id = $1', [recipeId]);
        const recipe = recipeResult.rows[0];
        const pricePaid = parseFloat(recipe?.price || 0);

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            await client.query(`
                INSERT INTO store_purchases (buyer_id, store_recipe_id, price_paid, stripe_session_id)
                VALUES ($1, $2, $3, $4)
            `, [req.user.userId, recipeId, pricePaid, sessionId]);

            // Also add to transactions table for unified history
            await client.query(`
                INSERT INTO transactions (user_id, transaction_id, type, plan, amount, status, stripe_session_id)
                VALUES ($1, $2, 'recipe_purchase', $3, $4, 'completed', $5)
            `, [
                req.user.userId,
                `TXN-RECIPE-${Date.now()}`,
                `Recipe #${recipeId}`,
                pricePaid,
                sessionId
            ]);

            if (pricePaid > 0 && recipe.seller_id) {
                // Get seller's currency
                const sellerWalletResult = await client.query('SELECT currency FROM wallet_balances WHERE user_id = $1 FOR UPDATE', [recipe.seller_id]);
                const sellerCurrency = sellerWalletResult.rows[0]?.currency || 'USD';

                const sellerCut = pricePaid * 0.8;
                const adminCut = pricePaid - sellerCut;

                await client.query('INSERT INTO wallet_balances (user_id, balance, currency) VALUES ($1, 0, $2) ON CONFLICT DO NOTHING', [recipe.seller_id, sellerCurrency]);
                await client.query('UPDATE wallet_balances SET balance = balance + $1 WHERE user_id = $2', [sellerCut, recipe.seller_id]);

                const adminResult = await client.query('SELECT id FROM users WHERE is_admin = true ORDER BY id ASC LIMIT 1');
                const adminId = adminResult.rows[0]?.id;
                if (adminId) {
                    const adminWalletResult = await client.query('SELECT currency FROM wallet_balances WHERE user_id = $1 FOR UPDATE', [adminId]);
                    const adminCurrency = adminWalletResult.rows[0]?.currency || 'USD';
                    const adminCutConverted = await currencyUtils.convertCurrency(adminCut, sellerCurrency, adminCurrency);

                    await client.query('INSERT INTO wallet_balances (user_id, balance, currency) VALUES ($1, 0, $2) ON CONFLICT DO NOTHING', [adminId, adminCurrency]);
                    await client.query('UPDATE wallet_balances SET balance = balance + $1 WHERE user_id = $2', [adminCutConverted, adminId]);
                }

                // Record wallet transactions
                const refId = `REC-PUR-${Date.now()}`;
                await client.query(
                    `INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
                     VALUES ($1, $2, 'purchase', $3, $4, 'completed', $5)`,
                    [req.user.userId, recipe.seller_id, sellerCut, `Recipe Purchase (Seller Cut): "${recipe.name}"`, refId + '-S']
                );
                
                if (adminId) {
                    await client.query(
                        `INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
                         VALUES ($1, $2, 'purchase', $3, $4, 'completed', $5)`,
                        [req.user.userId, adminId, adminCut, `Recipe Purchase (Platform Fee): "${recipe.name}"`, refId + '-A']
                    );
                }
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        res.json({
            success: true,
            recipeId: recipeId
        });

    } catch (error) {
        console.error('Verify recipe session error:', error);
        res.status(500).json({ error: 'Failed to verify session' });
    }
});

export default router;

