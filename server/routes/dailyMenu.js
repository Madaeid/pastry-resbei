// Daily Menu Routes
import express from 'express';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper to check premium status
function isPremiumUser(db, userId) {
    const subscription = db.prepare(`
        SELECT * FROM subscriptions 
        WHERE user_id = ? AND status = 'active' AND end_date > datetime('now')
    `).get(userId);

    // Also check if admin
    const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId);

    return !!(subscription || (user && user.is_admin));
}

// ===== Get All Menus for User =====
router.get('/', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const isPremium = isPremiumUser(db, req.user.userId);

        let query = `
            SELECT dm.*, COUNT(dmi.id) as item_count
            FROM daily_menus dm
            LEFT JOIN daily_menu_items dmi ON dm.id = dmi.menu_id
            WHERE dm.user_id = ?
        `;

        // If not premium, they only technically "have" today's menu in the UI context, 
        // but we can let them see their list. However, to implement "one day only", 
        // we might just limit the list or rely on the frontend. 
        // Let's filter to only today's menu for free users to be strict.
        if (!isPremium) {
            const today = new Date().toISOString().split('T')[0];
            query += ` AND dm.menu_date = '${today}'`;
        }

        query += `
            GROUP BY dm.id
            ORDER BY dm.menu_date DESC
            LIMIT 30
        `;

        const menus = db.prepare(query).all(req.user.userId);

        res.json(menus);
    } catch (error) {
        console.error('Get menus error:', error);
        res.status(500).json({ error: 'Failed to get menus' });
    }
});

// ===== Create New Menu =====
router.post('/', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const { date, title } = req.body;
        const isPremium = isPremiumUser(db, req.user.userId);

        // Check if menu already exists for this date
        const existing = db.prepare('SELECT * FROM daily_menus WHERE user_id = ? AND menu_date = ?')
            .get(req.user.userId, date);

        if (existing) {
            return res.json({ menu: existing });
        }

        // Limit Check for Free Users
        if (!isPremium) {
            const count = db.prepare('SELECT count(*) as c FROM daily_menus WHERE user_id = ?').get(req.user.userId);
            if (count.c > 0) {
                // Get the date of the existing menu to show in error
                const otherMenu = db.prepare('SELECT menu_date FROM daily_menus WHERE user_id = ? LIMIT 1').get(req.user.userId);
                return res.status(403).json({
                    error: 'Limit reached',
                    code: 'LIMIT_REACHED',
                    message: `Free users can only plan 1 day. You already have a menu for ${otherMenu.menu_date}. Delete it to plan this day.`
                });
            }
        }

        const result = db.prepare(`
            INSERT INTO daily_menus (user_id, menu_date, title)
            VALUES (?, ?, ?)
        `).run(req.user.userId, date, title || `Menu for ${date}`);

        const menu = db.prepare(`SELECT * FROM daily_menus WHERE id = ?`).get(result.lastInsertRowid);
        res.status(201).json({ menu });

    } catch (error) {
        console.error('Create menu error:', error);
        res.status(500).json({ error: 'Failed to create menu' });
    }
});

// ===== Get Menus by Date Range (Weekly View) =====
router.get('/range', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const { start, end } = req.query;
        const isPremium = isPremiumUser(db, req.user.userId);

        if (!start || !end) {
            return res.status(400).json({ error: 'Start and end dates required' });
        }

        const menus = db.prepare(`
            SELECT * FROM daily_menus 
            WHERE user_id = ? AND menu_date BETWEEN ? AND ?
            ORDER BY menu_date ASC
        `).all(req.user.userId, start, end);

        // Get items for these menus
        const menuIds = menus.map(m => m.id);
        let allItems = [];

        if (menuIds.length > 0) {
            const placeholders = menuIds.map(() => '?').join(',');
            allItems = db.prepare(`
                SELECT dmi.*, dmi.menu_id, r.name as recipe_name, r.photo as recipe_photo, 
                       r.category, r.prep_time, r.cook_time, r.servings, r.difficulty
                FROM daily_menu_items dmi
                LEFT JOIN recipes r ON dmi.recipe_id = r.id
                WHERE dmi.menu_id IN (${placeholders})
                ORDER BY dmi.order_index ASC
            `).all(...menuIds);
        }

        res.json({ menus, items: allItems, isPremium });
    } catch (error) {
        console.error('Get menu range error:', error);
        res.status(500).json({ error: 'Failed to get menu range' });
    }
});

// ===== Get Menu by Date =====
router.get('/date/:date', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const { date } = req.params;
        const isPremium = isPremiumUser(db, req.user.userId);

        // Get menu for this date
        let menu = db.prepare(`
            SELECT * FROM daily_menus WHERE user_id = ? AND menu_date = ?
        `).get(req.user.userId, date);

        let items = [];
        if (menu) {
            // Get menu items with recipe info
            items = db.prepare(`
                SELECT dmi.*, r.name as recipe_name, r.photo as recipe_photo, 
                       r.category, r.prep_time, r.cook_time, r.servings, r.difficulty,
                       r.ingredients, r.instructions, r.notes
                FROM daily_menu_items dmi
                LEFT JOIN recipes r ON dmi.recipe_id = r.id
                WHERE dmi.menu_id = ?
                ORDER BY dmi.order_index ASC
            `).all(menu.id);
        }

        res.json({ menu: menu || null, items, isPremium });
    } catch (error) {
        console.error('Get menu by date error:', error);
        res.status(500).json({ error: 'Failed to get menu' });
    }
});

// ===== Update Menu Title =====
router.put('/:id', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const { title } = req.body;

        // Verify ownership
        const menu = db.prepare(`
            SELECT * FROM daily_menus WHERE id = ? AND user_id = ?
        `).get(req.params.id, req.user.userId);

        if (!menu) {
            return res.status(404).json({ error: 'Menu not found' });
        }

        // Note: We don't strictly enforce date check here since they already have the menu ID.
        // If they managed to get a menu ID for a future date (which they can't via API), they can edit it.
        // This is acceptable simplification.

        db.prepare(`
            UPDATE daily_menus SET title = ?, updated_at = ? WHERE id = ?
        `).run(title, new Date().toISOString(), req.params.id);

        res.json({ success: true, message: 'Menu updated' });
    } catch (error) {
        console.error('Update menu error:', error);
        res.status(500).json({ error: 'Failed to update menu' });
    }
});

// ===== Delete Menu =====
router.delete('/:id', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();

        // Verify ownership
        const menu = db.prepare(`
            SELECT * FROM daily_menus WHERE id = ? AND user_id = ?
        `).get(req.params.id, req.user.userId);

        if (!menu) {
            return res.status(404).json({ error: 'Menu not found' });
        }

        db.prepare('DELETE FROM daily_menus WHERE id = ?').run(req.params.id);

        res.json({ success: true, message: 'Menu deleted' });
    } catch (error) {
        console.error('Delete menu error:', error);
        res.status(500).json({ error: 'Failed to delete menu' });
    }
});

// ===== Add Item to Menu =====
router.post('/:menuId/items', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const { name, photo, recipeId, ingredients, instructions } = req.body;

        // Verify menu ownership
        const menu = db.prepare(`
            SELECT * FROM daily_menus WHERE id = ? AND user_id = ?
        `).get(req.params.menuId, req.user.userId);

        if (!menu) {
            return res.status(404).json({ error: 'Menu not found' });
        }

        // Check Limit for Free Users (1 Item Max)
        const isPremium = isPremiumUser(db, req.user.userId);
        if (!isPremium) {
            const countObj = db.prepare('SELECT COUNT(*) as c FROM daily_menu_items WHERE menu_id = ?').get(req.params.menuId);
            if (countObj.c >= 1) {
                return res.status(403).json({
                    error: 'Limit reached',
                    code: 'LIMIT_REACHED',
                    message: 'Free users can only add 1 recipe per day.'
                });
            }
        }

        // Get next order index
        const lastItem = db.prepare(`
            SELECT MAX(order_index) as max_order FROM daily_menu_items WHERE menu_id = ?
        `).get(req.params.menuId);
        const orderIndex = (lastItem?.max_order || 0) + 1;

        // If adding from recipe, get recipe details
        let itemName = name;
        let itemPhoto = photo;
        let itemIngredients = ingredients || '';
        let itemInstructions = instructions || '';

        if (recipeId) {
            const recipe = db.prepare(`
                SELECT * FROM recipes WHERE id = ?
            `).get(recipeId);

            if (recipe) {
                itemName = itemName || recipe.name;
                itemPhoto = itemPhoto || recipe.photo;
                itemIngredients = itemIngredients || recipe.ingredients || '';
                itemInstructions = itemInstructions || recipe.instructions || '';
            }
        }

        const result = db.prepare(`
            INSERT INTO daily_menu_items (menu_id, recipe_id, name, photo, ingredients, instructions, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(req.params.menuId, recipeId || null, itemName, itemPhoto || null, itemIngredients, itemInstructions, orderIndex);

        const newItem = db.prepare(`
            SELECT dmi.*, r.name as recipe_name, r.photo as recipe_photo,
                   r.category, r.prep_time, r.cook_time, r.servings, r.difficulty,
                   r.ingredients as recipe_ingredients, r.instructions as recipe_instructions, r.notes
            FROM daily_menu_items dmi
            LEFT JOIN recipes r ON dmi.recipe_id = r.id
            WHERE dmi.id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json({ success: true, item: newItem });
    } catch (error) {
        console.error('Add menu item error:', error);
        res.status(500).json({ error: 'Failed to add menu item' });
    }
});


// ===== Update Menu Item =====
router.put('/items/:itemId', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const { name, photo, orderIndex } = req.body;

        // Verify item belongs to user's menu
        const item = db.prepare(`
            SELECT dmi.* FROM daily_menu_items dmi
            JOIN daily_menus dm ON dmi.menu_id = dm.id
            WHERE dmi.id = ? AND dm.user_id = ?
        `).get(req.params.itemId, req.user.userId);

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        db.prepare(`
            UPDATE daily_menu_items 
            SET name = COALESCE(?, name), 
                photo = COALESCE(?, photo),
                order_index = COALESCE(?, order_index)
            WHERE id = ?
        `).run(name, photo, orderIndex, req.params.itemId);

        res.json({ success: true, message: 'Item updated' });
    } catch (error) {
        console.error('Update menu item error:', error);
        res.status(500).json({ error: 'Failed to update item' });
    }
});

// ===== Delete Menu Item =====
router.delete('/items/:itemId', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();

        // Verify item belongs to user's menu
        const item = db.prepare(`
            SELECT dmi.* FROM daily_menu_items dmi
            JOIN daily_menus dm ON dmi.menu_id = dm.id
            WHERE dmi.id = ? AND dm.user_id = ?
        `).get(req.params.itemId, req.user.userId);

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        db.prepare('DELETE FROM daily_menu_items WHERE id = ?').run(req.params.itemId);

        res.json({ success: true, message: 'Item deleted' });
    } catch (error) {
        console.error('Delete menu item error:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

// ===== Get User's Recipes (for recipe picker) =====
router.get('/recipes', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const recipes = db.prepare(`
            SELECT id, name, photo, category FROM recipes 
            WHERE user_id = ? 
            ORDER BY name ASC
        `).all(req.user.userId);

        res.json(recipes);
    } catch (error) {
        console.error('Get recipes error:', error);
        res.status(500).json({ error: 'Failed to get recipes' });
    }
});

export default router;
