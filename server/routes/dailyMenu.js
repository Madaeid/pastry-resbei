
// Daily Menu Routes
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

    // Also check if admin
    const userResult = await db.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    return !!(subscription || (user && user.is_admin === 1));
}

// ===== Get All Menus for User =====
router.get('/', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const isPremium = await isPremiumUser(db, req.user.userId);

        let query = `
            SELECT dm.*, COUNT(dmi.id) as item_count
            FROM daily_menus dm
            LEFT JOIN daily_menu_items dmi ON dm.id = dmi.menu_id
            WHERE dm.user_id = $1
        `;
        let params = [req.user.userId];

        // If not premium, filter to only today's menu
        if (!isPremium) {
            const today = new Date().toISOString().split('T')[0];
            query += ` AND dm.menu_date = $2`;
            params.push(today);
        }

        query += `
            GROUP BY dm.id
            ORDER BY dm.menu_date DESC
            LIMIT 30
        `;

        const result = await db.query(query, params);
        const menus = result.rows;

        // Convert counts to integers (Postgres COUNT returns string)
        const menusWithIntCount = menus.map(m => ({
            ...m,
            item_count: parseInt(m.item_count)
        }));

        res.json(menusWithIntCount);
    } catch (error) {
        console.error('Get menus error:', error);
        res.status(500).json({ error: 'Failed to get menus' });
    }
});

// ===== Create New Menu =====
router.post('/', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const { date, title } = req.body;
        const isPremium = await isPremiumUser(db, req.user.userId);

        // Check if menu already exists for this date
        const existingResult = await db.query('SELECT * FROM daily_menus WHERE user_id = $1 AND menu_date = $2', [req.user.userId, date]);
        const existing = existingResult.rows[0];

        if (existing) {
            return res.json({ menu: existing });
        }

        // Limit Check for Free Users
        if (!isPremium) {
            const countResult = await db.query('SELECT count(*) as c FROM daily_menus WHERE user_id = $1', [req.user.userId]);
            const count = parseInt(countResult.rows[0].c);

            if (count > 0) {
                // Get the date of the existing menu to show in error
                const otherMenuResult = await db.query('SELECT menu_date FROM daily_menus WHERE user_id = $1 LIMIT 1', [req.user.userId]);
                const otherMenu = otherMenuResult.rows[0];
                return res.status(403).json({
                    error: 'Limit reached',
                    code: 'LIMIT_REACHED',
                    message: `Free users can only plan 1 day. You already have a menu for ${otherMenu.menu_date}. Delete it to plan this day.`
                });
            }
        }

        const insertResult = await db.query(`
            INSERT INTO daily_menus (user_id, menu_date, title)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [req.user.userId, date, title || `Menu for ${date}`]);

        const menu = insertResult.rows[0];
        res.status(201).json({ menu });

    } catch (error) {
        console.error('Create menu error:', error);
        res.status(500).json({ error: 'Failed to create menu' });
    }
});

// ===== Get Menus by Date Range (Weekly View) =====
router.get('/range', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const { start, end } = req.query;
        const isPremium = await isPremiumUser(db, req.user.userId);

        if (!start || !end) {
            return res.status(400).json({ error: 'Start and end dates required' });
        }

        const menuResult = await db.query(`
            SELECT * FROM daily_menus 
            WHERE user_id = $1 AND menu_date BETWEEN $2 AND $3
            ORDER BY menu_date ASC
        `, [req.user.userId, start, end]);
        const menus = menuResult.rows;

        // Get items for these menus
        const menuIds = menus.map(m => m.id);
        let allItems = [];

        if (menuIds.length > 0) {
            // Generate placeholders $1, $2, etc. starting after initial params
            // But we can use ANY($1) with array
            const itemsResult = await db.query(`
                SELECT dmi.*, dmi.menu_id, r.name as recipe_name, r.photo as recipe_photo, 
                       r.category, r.prep_time, r.cook_time, r.servings, r.difficulty
                FROM daily_menu_items dmi
                LEFT JOIN recipes r ON dmi.recipe_id = r.id
                WHERE dmi.menu_id = ANY($1)
                ORDER BY dmi.order_index ASC
            `, [menuIds]);
            allItems = itemsResult.rows;
        }

        res.json({ menus, items: allItems, isPremium });
    } catch (error) {
        console.error('Get menu range error:', error);
        res.status(500).json({ error: 'Failed to get menu range' });
    }
});

// ===== Get Menu by Date =====
router.get('/date/:date', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const { date } = req.params;
        const isPremium = await isPremiumUser(db, req.user.userId);

        // Get menu for this date
        const menuResult = await db.query(`
            SELECT * FROM daily_menus WHERE user_id = $1 AND menu_date = $2
        `, [req.user.userId, date]);
        const menu = menuResult.rows[0];

        let items = [];
        if (menu) {
            // Get menu items with recipe info
            const itemsResult = await db.query(`
                SELECT dmi.*, r.name as recipe_name, r.photo as recipe_photo, 
                       r.category, r.prep_time, r.cook_time, r.servings, r.difficulty,
                       r.ingredients, r.instructions, r.notes
                FROM daily_menu_items dmi
                LEFT JOIN recipes r ON dmi.recipe_id = r.id
                WHERE dmi.menu_id = $1
                ORDER BY dmi.order_index ASC
            `, [menu.id]);
            items = itemsResult.rows;
        }

        res.json({ menu: menu || null, items, isPremium });
    } catch (error) {
        console.error('Get menu by date error:', error);
        res.status(500).json({ error: 'Failed to get menu' });
    }
});

// ===== Update Menu Title =====
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const { title } = req.body;

        // Verify ownership
        const menuResult = await db.query(`
            SELECT * FROM daily_menus WHERE id = $1 AND user_id = $2
        `, [req.params.id, req.user.userId]);
        const menu = menuResult.rows[0];

        if (!menu) {
            return res.status(404).json({ error: 'Menu not found' });
        }

        await db.query(`
            UPDATE daily_menus SET title = $1, updated_at = $2 WHERE id = $3
        `, [title, new Date().toISOString(), req.params.id]);

        res.json({ success: true, message: 'Menu updated' });
    } catch (error) {
        console.error('Update menu error:', error);
        res.status(500).json({ error: 'Failed to update menu' });
    }
});

// ===== Delete Menu =====
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();

        // Verify ownership
        const menuResult = await db.query(`
            SELECT * FROM daily_menus WHERE id = $1 AND user_id = $2
        `, [req.params.id, req.user.userId]);
        const menu = menuResult.rows[0];

        if (!menu) {
            return res.status(404).json({ error: 'Menu not found' });
        }

        await db.query('DELETE FROM daily_menus WHERE id = $1', [req.params.id]);

        res.json({ success: true, message: 'Menu deleted' });
    } catch (error) {
        console.error('Delete menu error:', error);
        res.status(500).json({ error: 'Failed to delete menu' });
    }
});

// ===== Add Item to Menu =====
router.post('/:menuId/items', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const { name, photo, recipeId, ingredients, instructions } = req.body;

        // Verify menu ownership
        const menuResult = await db.query(`
            SELECT * FROM daily_menus WHERE id = $1 AND user_id = $2
        `, [req.params.menuId, req.user.userId]);
        const menu = menuResult.rows[0];

        if (!menu) {
            return res.status(404).json({ error: 'Menu not found' });
        }

        // Check Limit for Free Users (1 Item Max)
        const isPremium = await isPremiumUser(db, req.user.userId);
        if (!isPremium) {
            const countResult = await db.query('SELECT COUNT(*) as c FROM daily_menu_items WHERE menu_id = $1', [req.params.menuId]);
            const count = parseInt(countResult.rows[0].c);
            if (count >= 1) {
                return res.status(403).json({
                    error: 'Limit reached',
                    code: 'LIMIT_REACHED',
                    message: 'Free users can only add 1 recipe per day.'
                });
            }
        }

        // Get next order index
        const orderResult = await db.query(`
            SELECT MAX(order_index) as max_order FROM daily_menu_items WHERE menu_id = $1
        `, [req.params.menuId]);
        const orderIndex = (orderResult.rows[0]?.max_order || 0) + 1;

        // If adding from recipe, get recipe details
        let itemName = name;
        let itemPhoto = photo;
        let itemIngredients = ingredients || '';
        let itemInstructions = instructions || '';

        if (recipeId) {
            const recipeResult = await db.query(`
                SELECT * FROM recipes WHERE id = $1
            `, [recipeId]);
            const recipe = recipeResult.rows[0];

            if (recipe) {
                itemName = itemName || recipe.name;
                itemPhoto = itemPhoto || recipe.photo;
                itemIngredients = itemIngredients || recipe.ingredients || '';
                itemInstructions = itemInstructions || recipe.instructions || '';
            }
        }

        const insertResult = await db.query(`
            INSERT INTO daily_menu_items (menu_id, recipe_id, name, photo, ingredients, instructions, order_index)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [
            req.params.menuId,
            recipeId || null,
            itemName,
            itemPhoto || null,
            itemIngredients,
            itemInstructions,
            orderIndex
        ]);

        const newItemResult = await db.query(`
            SELECT dmi.*, r.name as recipe_name, r.photo as recipe_photo,
                   r.category, r.prep_time, r.cook_time, r.servings, r.difficulty,
                   r.ingredients as recipe_ingredients, r.instructions as recipe_instructions, r.notes
            FROM daily_menu_items dmi
            LEFT JOIN recipes r ON dmi.recipe_id = r.id
            WHERE dmi.id = $1
        `, [insertResult.rows[0].id]);

        const newItem = newItemResult.rows[0];

        res.status(201).json({ success: true, item: newItem });
    } catch (error) {
        console.error('Add menu item error:', error);
        res.status(500).json({ error: 'Failed to add menu item' });
    }
});


// ===== Update Menu Item =====
router.put('/items/:itemId', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const { name, photo, orderIndex } = req.body;

        // Verify item belongs to user's menu
        const itemResult = await db.query(`
            SELECT dmi.* FROM daily_menu_items dmi
            JOIN daily_menus dm ON dmi.menu_id = dm.id
            WHERE dmi.id = $1 AND dm.user_id = $2
        `, [req.params.itemId, req.user.userId]);
        const item = itemResult.rows[0];

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        await db.query(`
            UPDATE daily_menu_items 
            SET name = COALESCE($1, name), 
                photo = COALESCE($2, photo),
                order_index = COALESCE($3, order_index)
            WHERE id = $4
        `, [name || null, photo || null, orderIndex || null, req.params.itemId]);

        res.json({ success: true, message: 'Item updated' });
    } catch (error) {
        console.error('Update menu item error:', error);
        res.status(500).json({ error: 'Failed to update item' });
    }
});

// ===== Delete Menu Item =====
router.delete('/items/:itemId', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();

        // Verify item belongs to user's menu
        const itemResult = await db.query(`
            SELECT dmi.* FROM daily_menu_items dmi
            JOIN daily_menus dm ON dmi.menu_id = dm.id
            WHERE dmi.id = $1 AND dm.user_id = $2
        `, [req.params.itemId, req.user.userId]);
        const item = itemResult.rows[0];

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        await db.query('DELETE FROM daily_menu_items WHERE id = $1', [req.params.itemId]);

        res.json({ success: true, message: 'Item deleted' });
    } catch (error) {
        console.error('Delete menu item error:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

// ===== Get User's Recipes (for recipe picker) =====
router.get('/recipes', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT id, name, photo, category FROM recipes 
            WHERE user_id = $1 
            ORDER BY name ASC
        `, [req.user.userId]);
        const recipes = result.rows;

        res.json(recipes);
    } catch (error) {
        console.error('Get recipes error:', error);
        res.status(500).json({ error: 'Failed to get recipes' });
    }
});

export default router;
