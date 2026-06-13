import { uploadMedia } from '../utils/cloudinary.js';
import crypto from 'crypto';

// Books Routes — Chef Book Portfolio Feature
import express from 'express';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createBookCheckoutSession, verifyCheckoutSession } from '../config/stripe.js';
import currencyUtils from '../utils/currency.js';

const router = express.Router();

// Helper to check premium status
async function isPremiumUser(db, userId) {
    const subResult = await db.query(`
        SELECT * FROM subscriptions 
        WHERE user_id = $1 AND status = 'active' AND end_date::timestamp > NOW()
    `, [userId]);
    const subscription = subResult.rows[0];

    const userResult = await db.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    return !!(subscription || (user && user.is_admin));
}

// ===== Get All Books for User =====
router.get('/', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT b.*, COUNT(br.id) as recipe_count
            FROM books b
            LEFT JOIN book_recipes br ON b.id = br.book_id
            WHERE b.user_id = $1
            GROUP BY b.id
            ORDER BY b.updated_at DESC
        `, [req.user.userId]);

        const books = result.rows.map(b => ({
            ...b,
            recipe_count: parseInt(b.recipe_count)
        }));

        const premium = await isPremiumUser(db, req.user.userId);
        res.json({ books, isPremium: premium });
    } catch (error) {
        console.error('Get books error:', error);
        res.status(500).json({ error: 'Failed to get books' });
    }
});

// ===== Create a New Book =====
router.post('/', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        let { title, description, cover_photo, theme, price } = req.body;
        if (cover_photo) cover_photo = await uploadMedia(cover_photo, 'books');
        const premium = await isPremiumUser(db, req.user.userId);

        // Free user limit: 1 book
        if (!premium) {
            const countResult = await db.query('SELECT COUNT(*) as c FROM books WHERE user_id = $1', [req.user.userId]);
            const count = parseInt(countResult.rows[0].c);
            if (count >= 1) {
                return res.status(403).json({
                    error: 'Limit reached',
                    code: 'LIMIT_REACHED',
                    message: 'Free users can create 1 book. Upgrade to Premium for unlimited books!'
                });
            }
        }

        const insertResult = await db.query(`
            INSERT INTO books (user_id, title, description, cover_photo, theme, price)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            req.user.userId,
            title || 'My Chef Book',
            description || '',
            cover_photo || null,
            theme || 'classic',
            parseFloat(price) >= 0 ? parseFloat(price) : 0
        ]);

        res.status(201).json({ book: insertResult.rows[0] });
    } catch (error) {
        console.error('Create book error:', error);
        res.status(500).json({ error: 'Failed to create book' });
    }
});

// ===== Get a Single Book with Recipes =====
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();

        // Get the book
        const bookResult = await db.query(`
            SELECT * FROM books WHERE id = $1 AND user_id = $2
        `, [req.params.id, req.user.userId]);
        const book = bookResult.rows[0];

        if (!book) {
            return res.status(404).json({ error: 'Book not found' });
        }

        // Get recipes in this book with full recipe details
        const recipesResult = await db.query(`
            SELECT br.id as book_recipe_id, br.order_index, br.section_title, br.notes as book_notes,
                   r.id, r.name, r.category, r.difficulty, r.prep_time, r.cook_time,
                   r.servings, r.photo, r.ingredients, r.instructions, r.notes,
                   r.visibility, r.created_at as recipe_created_at
            FROM book_recipes br
            JOIN recipes r ON br.recipe_id = r.id
            WHERE br.book_id = $1
            ORDER BY br.order_index ASC
        `, [req.params.id]);

        res.json({ book, recipes: recipesResult.rows });
    } catch (error) {
        console.error('Get book error:', error);
        res.status(500).json({ error: 'Failed to get book' });
    }
});

// ===== Update a Book =====
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        let { title, description, cover_photo, theme, price, is_public } = req.body;
        if (cover_photo) cover_photo = await uploadMedia(cover_photo, 'books');

        // Verify ownership
        const bookResult = await db.query('SELECT * FROM books WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!bookResult.rows[0]) {
            return res.status(404).json({ error: 'Book not found' });
        }

        const priceVal = price !== undefined && price !== null && price !== '' ? parseFloat(price) : null;
        const isPublicVal = is_public !== undefined ? is_public : null;
        await db.query(`
            UPDATE books 
            SET title = COALESCE($1, title),
                description = COALESCE($2, description),
                cover_photo = COALESCE($3, cover_photo),
                theme = COALESCE($4, theme),
                price = COALESCE($5, price),
                is_public = COALESCE($6, is_public),
                updated_at = NOW()
            WHERE id = $7
        `, [title, description, cover_photo, theme, priceVal, isPublicVal, req.params.id]);

        const updatedResult = await db.query('SELECT * FROM books WHERE id = $1', [req.params.id]);
        res.json({ book: updatedResult.rows[0] });
    } catch (error) {
        console.error('Update book error:', error);
        res.status(500).json({ error: 'Failed to update book' });
    }
});

// ===== Delete a Book =====
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();

        const bookResult = await db.query('SELECT * FROM books WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!bookResult.rows[0]) {
            return res.status(404).json({ error: 'Book not found' });
        }

        await db.query('DELETE FROM books WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Book deleted' });
    } catch (error) {
        console.error('Delete book error:', error);
        res.status(500).json({ error: 'Failed to delete book' });
    }
});

// ===== Add Recipes to a Book =====
router.post('/:id/recipes', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const { recipeIds } = req.body; // Array of recipe IDs

        // Verify book ownership
        const bookResult = await db.query('SELECT * FROM books WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!bookResult.rows[0]) {
            return res.status(404).json({ error: 'Book not found' });
        }

        if (!recipeIds || !Array.isArray(recipeIds) || recipeIds.length === 0) {
            return res.status(400).json({ error: 'recipeIds array is required' });
        }

        // Get current max order_index
        const orderResult = await db.query('SELECT MAX(order_index) as max_order FROM book_recipes WHERE book_id = $1', [req.params.id]);
        let nextOrder = (orderResult.rows[0]?.max_order || 0) + 1;

        let addedCount = 0;
        for (const recipeId of recipeIds) {
            // Verify recipe belongs to user
            const recipeCheck = await db.query('SELECT id FROM recipes WHERE id = $1 AND user_id = $2', [recipeId, req.user.userId]);
            if (!recipeCheck.rows[0]) continue;

            // Skip if already in book
            const existing = await db.query('SELECT id FROM book_recipes WHERE book_id = $1 AND recipe_id = $2', [req.params.id, recipeId]);
            if (existing.rows[0]) continue;

            await db.query(`
                INSERT INTO book_recipes (book_id, recipe_id, order_index)
                VALUES ($1, $2, $3)
            `, [req.params.id, recipeId, nextOrder++]);
            addedCount++;
        }

        // Update book timestamp
        await db.query('UPDATE books SET updated_at = NOW() WHERE id = $1', [req.params.id]);

        res.json({ success: true, added: addedCount });
    } catch (error) {
        console.error('Add book recipes error:', error);
        res.status(500).json({ error: 'Failed to add recipes to book' });
    }
});

// ===== Remove a Recipe from a Book =====
router.delete('/:id/recipes/:recipeId', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();

        // Verify book ownership
        const bookResult = await db.query('SELECT * FROM books WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!bookResult.rows[0]) {
            return res.status(404).json({ error: 'Book not found' });
        }

        await db.query('DELETE FROM book_recipes WHERE book_id = $1 AND recipe_id = $2', [req.params.id, req.params.recipeId]);
        await db.query('UPDATE books SET updated_at = NOW() WHERE id = $1', [req.params.id]);

        res.json({ success: true, message: 'Recipe removed from book' });
    } catch (error) {
        console.error('Remove book recipe error:', error);
        res.status(500).json({ error: 'Failed to remove recipe' });
    }
});

// ===== Reorder Recipes in a Book =====
router.put('/:id/reorder', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const { recipeOrder } = req.body; // Array of { recipeId, orderIndex }

        // Verify book ownership
        const bookResult = await db.query('SELECT * FROM books WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!bookResult.rows[0]) {
            return res.status(404).json({ error: 'Book not found' });
        }

        if (!recipeOrder || !Array.isArray(recipeOrder)) {
            return res.status(400).json({ error: 'recipeOrder array is required' });
        }

        for (const item of recipeOrder) {
            await db.query(`
                UPDATE book_recipes SET order_index = $1 
                WHERE book_id = $2 AND recipe_id = $3
            `, [item.orderIndex, req.params.id, item.recipeId]);
        }

        await db.query('UPDATE books SET updated_at = NOW() WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Order updated' });
    } catch (error) {
        console.error('Reorder book error:', error);
        res.status(500).json({ error: 'Failed to reorder recipes' });
    }
});

// ===== Get User's Recipes for Picker =====
router.get('/:id/available-recipes', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT r.id, r.name, r.category, r.photo, r.difficulty,
                   CASE WHEN br.id IS NOT NULL THEN true ELSE false END as in_book
            FROM recipes r
            LEFT JOIN book_recipes br ON r.id = br.recipe_id AND br.book_id = $1
            WHERE r.user_id = $2
            ORDER BY r.name ASC
        `, [req.params.id, req.user.userId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get available recipes error:', error);
        res.status(500).json({ error: 'Failed to get recipes' });
    }
});
// ===== BOOK MARKETPLACE ENDPOINTS =====

// ===== Browse Public Books =====
router.get('/public/browse', async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT b.id, b.title, b.description, b.cover_photo, b.theme, b.price,
                   b.created_at, b.updated_at,
                   u.id as author_id, u.display_name as author_name,
                   u.profile_picture as author_pic, u.username as author_username,
                   COUNT(br.id) as recipe_count
            FROM books b
            JOIN users u ON b.user_id = u.id
            LEFT JOIN book_recipes br ON b.id = br.book_id
            WHERE b.is_public = true
            GROUP BY b.id, u.id
            ORDER BY b.created_at DESC
        `);

        res.json(result.rows.map(b => ({
            id: b.id,
            title: b.title,
            description: b.description,
            coverPhoto: b.cover_photo,
            theme: b.theme,
            price: parseFloat(b.price) || 0,
            recipeCount: parseInt(b.recipe_count),
            createdAt: b.created_at,
            author: {
                id: b.author_id,
                name: b.author_name,
                pic: b.author_pic,
                username: b.author_username
            }
        })));
    } catch (error) {
        console.error('Browse public books error:', error);
        res.status(500).json({ error: 'Failed to browse books' });
    }
});

// ===== View a Public Book (preview or full if purchased) =====
router.get('/public/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const bookResult = await db.query(`
            SELECT b.*, u.display_name as author_name, u.profile_picture as author_pic,
                   u.username as author_username, u.id as author_id
            FROM books b
            JOIN users u ON b.user_id = u.id
            WHERE b.id = $1 AND b.is_public = true
        `, [req.params.id]);

        if (!bookResult.rows[0]) {
            return res.status(404).json({ error: 'Book not found' });
        }

        const book = bookResult.rows[0];
        const isOwner = book.user_id === req.user.userId;
        const bookPrice = parseFloat(book.price) || 0;

        // Check if user has purchased
        let hasPurchased = false;
        if (!isOwner) {
            const purchaseCheck = await db.query(
                'SELECT id FROM book_purchases WHERE buyer_id = $1 AND book_id = $2',
                [req.user.userId, req.params.id]
            );
            hasPurchased = purchaseCheck.rows.length > 0;
        }

        const canViewFull = isOwner || hasPurchased || bookPrice === 0;

        // Get recipe count
        const countResult = await db.query(
            'SELECT COUNT(*) as c FROM book_recipes WHERE book_id = $1',
            [req.params.id]
        );
        const recipeCount = parseInt(countResult.rows[0].c);

        const baseResponse = {
            id: book.id,
            title: book.title,
            description: book.description,
            coverPhoto: book.cover_photo,
            theme: book.theme,
            price: bookPrice,
            recipeCount,
            isOwner,
            hasPurchased,
            canViewFull,
            author: {
                id: book.author_id,
                name: book.author_name,
                pic: book.author_pic,
                username: book.author_username
            }
        };

        if (canViewFull) {
            // Get full recipes
            const recipesResult = await db.query(`
                SELECT br.order_index, br.section_title, br.notes as book_notes,
                       r.id, r.name, r.category, r.difficulty, r.prep_time, r.cook_time,
                       r.servings, r.photo, r.ingredients, r.instructions, r.notes
                FROM book_recipes br
                JOIN recipes r ON br.recipe_id = r.id
                WHERE br.book_id = $1
                ORDER BY br.order_index ASC
            `, [req.params.id]);

            baseResponse.recipes = recipesResult.rows;
        }

        res.json(baseResponse);
    } catch (error) {
        console.error('View public book error:', error);
        res.status(500).json({ error: 'Failed to view book' });
    }
});

// ===== Purchase a Book =====
router.post('/public/:id/purchase', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();

        // Get book info
        const bookResult = await db.query(
            'SELECT id, user_id, title, price FROM books WHERE id = $1 AND is_public = true',
            [req.params.id]
        );
        if (!bookResult.rows[0]) {
            return res.status(404).json({ error: 'Book not found' });
        }

        const book = bookResult.rows[0];
        const bookPrice = parseFloat(book.price) || 0;

        // Can't buy your own book
        if (book.user_id === req.user.userId) {
            return res.status(400).json({ error: 'You cannot purchase your own book' });
        }

        // If free book, just record purchase
        if (bookPrice === 0) {
            // Check if already purchased
            const existingPurchase = await db.query(
                'SELECT id FROM book_purchases WHERE buyer_id = $1 AND book_id = $2',
                [req.user.userId, req.params.id]
            );
            if (existingPurchase.rows.length > 0) {
                return res.status(400).json({ error: 'You have already purchased this book' });
            }

            await db.query(
                'INSERT INTO book_purchases (buyer_id, book_id, price_paid) VALUES ($1, $2, 0)',
                [req.user.userId, req.params.id]
            );
            return res.json({ success: true, message: `"${book.title}" added to your library!` });
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // 1. Get or Create Wallet and acquire FOR UPDATE lock to prevent race conditions
            let walletResult = await client.query(
                'SELECT balance FROM wallet_balances WHERE user_id = $1 FOR UPDATE',
                [req.user.userId]
            );
            
            if (!walletResult.rows[0]) {
                await client.query('INSERT INTO wallet_balances (user_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [req.user.userId]);
                walletResult = await client.query('SELECT balance FROM wallet_balances WHERE user_id = $1 FOR UPDATE', [req.user.userId]);
            }

            // 2. Check existing purchase INSIDE transaction
            const existingPurchase = await client.query(
                'SELECT id FROM book_purchases WHERE buyer_id = $1 AND book_id = $2',
                [req.user.userId, req.params.id]
            );
            if (existingPurchase.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'You have already purchased this book' });
            }

            const buyerBalance = parseFloat(walletResult.rows[0]?.balance || 0);
            if (buyerBalance < bookPrice) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    error: 'Insufficient funds',
                    balance: buyerBalance,
                    price: bookPrice,
                    message: `You need $${bookPrice.toFixed(2)} but only have $${buyerBalance.toFixed(2)}. Please deposit funds first.`
                });
            }

            // Deduct from buyer wallet
            await client.query(
                'UPDATE wallet_balances SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2',
                [bookPrice, req.user.userId]
            );

            // Credit seller wallet (80%)
            const sellerCut = bookPrice * 0.8;
            const adminCut = bookPrice - sellerCut; // Remaining 20%
            
            await client.query('INSERT INTO wallet_balances (user_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [book.user_id]);
            await client.query(
                'UPDATE wallet_balances SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
                [sellerCut, book.user_id]
            );

            // Credit admin wallet (20%)
            const adminResult = await client.query('SELECT id FROM users WHERE is_admin = true ORDER BY id ASC LIMIT 1');
            const adminId = adminResult.rows[0]?.id;
            if (adminId) {
                await client.query('INSERT INTO wallet_balances (user_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING', [adminId]);
                await client.query(
                    'UPDATE wallet_balances SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
                    [adminCut, adminId]
                );
            }

            // Record purchase
            await client.query(
                'INSERT INTO book_purchases (buyer_id, book_id, price_paid) VALUES ($1, $2, $3)',
                [req.user.userId, req.params.id, bookPrice]
            );

            // Record wallet transactions
            const refId = `BOOK-PUR-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
            await client.query(
                `INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
                 VALUES ($1, $2, 'book_purchase', $3, $4, 'completed', $5)`,
                [req.user.userId, book.user_id, sellerCut, `Book Purchase (Seller Cut): "${book.title}"`, refId + '-S']
            );
            
            if (adminId) {
                await client.query(
                    `INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
                     VALUES ($1, $2, 'book_purchase', $3, $4, 'completed', $5)`,
                    [req.user.userId, adminId, adminCut, `Book Purchase (Platform Fee): "${book.title}"`, refId + '-A']
                );
            }

            // Get updated balance
            const newBalResult = await client.query('SELECT balance FROM wallet_balances WHERE user_id = $1', [req.user.userId]);
            const newBalance = parseFloat(newBalResult.rows[0]?.balance || 0);

            await client.query('COMMIT');

            res.json({
                success: true,
                message: `Successfully purchased "${book.title}"!`,
                balance: newBalance
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Purchase book error:', error);
        res.status(500).json({ error: 'Failed to purchase book' });
    }
});

// ===== Get My Purchased Books =====
router.get('/purchased/my', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT b.id, b.title, b.description, b.cover_photo, b.theme, b.price,
                   bp.price_paid, bp.purchased_at,
                   u.display_name as author_name, u.profile_picture as author_pic,
                   u.username as author_username, u.id as author_id,
                   COUNT(br.id) as recipe_count
            FROM book_purchases bp
            JOIN books b ON bp.book_id = b.id
            JOIN users u ON b.user_id = u.id
            LEFT JOIN book_recipes br ON b.id = br.book_id
            WHERE bp.buyer_id = $1
            GROUP BY b.id, bp.price_paid, bp.purchased_at, u.id, u.display_name, u.profile_picture, u.username
            ORDER BY bp.purchased_at DESC
        `, [req.user.userId]);

        res.json(result.rows.map(b => ({
            id: b.id,
            title: b.title,
            description: b.description,
            coverPhoto: b.cover_photo,
            theme: b.theme,
            price: parseFloat(b.price) || 0,
            pricePaid: parseFloat(b.price_paid) || 0,
            purchasedAt: b.purchased_at,
            recipeCount: parseInt(b.recipe_count),
            author: {
                id: b.author_id,
                name: b.author_name,
                pic: b.author_pic,
                username: b.author_username
            }
        })));
    } catch (error) {
        console.error('Get purchased books error:', error);
        res.status(500).json({ error: 'Failed to get purchased books' });
    }
});

// ===== Create Stripe Checkout Session =====
router.post('/create-checkout-session', authenticateToken, async (req, res) => {
    try {
        const { bookId, successUrl, cancelUrl } = req.body;
        const db = getDatabase();

        // Get book info
        const bookResult = await db.query(`
            SELECT b.*, u.display_name as author_name, u.profile_picture as author_pic, u.username as author_username
            FROM books b
            JOIN users u ON b.user_id = u.id
            WHERE b.id = $1 AND b.is_public = true
        `, [bookId]);

        if (bookResult.rows.length === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }

        const book = {
            ...bookResult.rows[0],
            price: parseFloat(bookResult.rows[0].price),
            author: {
                name: bookResult.rows[0].author_name,
                pic: bookResult.rows[0].author_pic,
                username: bookResult.rows[0].author_username
            }
        };

        // Get user email
        const userResult = await db.query('SELECT email FROM users WHERE id = $1', [req.user.userId]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create Stripe checkout session
        const session = await createBookCheckoutSession(
            req.user.userId,
            user.email,
            book,
            successUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment-success.html?type=book`,
            cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment.html?bookId=${bookId}`
        );

        res.json({ url: session.url });
    } catch (error) {
        console.error('Book checkout session error:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// ===== Verify Stripe Session =====
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

        if (session.metadata.userId !== req.user.userId.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Session does not belong to this user'
            });
        }

        const bookId = session.metadata.bookId;

        if (!bookId) {
            return res.status(400).json({ error: 'Invalid session metadata: bookId missing' });
        }

        const existingPurchase = await db.query(
            'SELECT id FROM book_purchases WHERE buyer_id = $1 AND book_id = $2',
            [req.user.userId, bookId]
        );

        if (existingPurchase.rows.length > 0) {
            return res.json({
                success: true,
                alreadyProcessed: true,
                bookId: bookId
            });
        }

        const bookResult = await db.query('SELECT price, user_id, title FROM books WHERE id = $1', [bookId]);
        const book = bookResult.rows[0];
        const pricePaid = parseFloat(book?.price || 0);

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            await client.query(`
                INSERT INTO book_purchases (buyer_id, book_id, price_paid, stripe_session_id)
                VALUES ($1, $2, $3, $4)
            `, [req.user.userId, bookId, pricePaid, sessionId]);

            if (pricePaid > 0 && book.user_id) {
                const sellerWalletResult = await client.query('SELECT currency FROM wallet_balances WHERE user_id = $1 FOR UPDATE', [book.user_id]);
                const sellerCurrency = sellerWalletResult.rows[0]?.currency || 'USD';

                const sellerCut = pricePaid * 0.8;
                const adminCut = pricePaid - sellerCut;

                await client.query('INSERT INTO wallet_balances (user_id, balance, currency) VALUES ($1, 0, $2) ON CONFLICT DO NOTHING', [book.user_id, sellerCurrency]);
                await client.query('UPDATE wallet_balances SET balance = balance + $1 WHERE user_id = $2', [sellerCut, book.user_id]);

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
                const refId = `BOOK-PUR-STR-${Date.now()}`;
                await client.query(
                    `INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
                     VALUES ($1, $2, 'book_purchase', $3, $4, 'completed', $5)`,
                    [req.user.userId, book.user_id, sellerCut, `Book Purchase (Seller Cut): "${book.title}"`, refId + '-S']
                );
                
                if (adminId) {
                    await client.query(
                        `INSERT INTO wallet_transactions (sender_id, receiver_id, type, amount, note, status, reference_id)
                         VALUES ($1, $2, 'book_purchase', $3, $4, 'completed', $5)`,
                        [req.user.userId, adminId, adminCut, `Book Purchase (Platform Fee): "${book.title}"`, refId + '-A']
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

        return res.json({
            success: true,
            bookId: bookId
        });
    } catch (error) {
        console.error('Verify checkout session error:', error);
        res.status(500).json({ success: false, error: 'Failed to verify session' });
    }
});

export default router;
