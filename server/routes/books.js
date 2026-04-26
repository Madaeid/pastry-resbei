
// Books Routes — Chef Book Portfolio Feature
import express from 'express';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

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

    return !!(subscription || (user && user.is_admin === 1));
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
        const { title, description, cover_photo, theme } = req.body;
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
            INSERT INTO books (user_id, title, description, cover_photo, theme)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [
            req.user.userId,
            title || 'My Chef Book',
            description || '',
            cover_photo || null,
            theme || 'classic'
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
        const { title, description, cover_photo, theme } = req.body;

        // Verify ownership
        const bookResult = await db.query('SELECT * FROM books WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!bookResult.rows[0]) {
            return res.status(404).json({ error: 'Book not found' });
        }

        await db.query(`
            UPDATE books 
            SET title = COALESCE($1, title),
                description = COALESCE($2, description),
                cover_photo = COALESCE($3, cover_photo),
                theme = COALESCE($4, theme),
                updated_at = NOW()
            WHERE id = $5
        `, [title, description, cover_photo, theme, req.params.id]);

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

export default router;
