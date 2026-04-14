
// Admin Routes
import express from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All admin routes require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// ===== Get Dashboard Stats =====
router.get('/stats', async (req, res) => {
    try {
        const db = getDatabase();

        const totalUsersResult = await db.query('SELECT COUNT(*) as count FROM users');
        const totalUsers = parseInt(totalUsersResult.rows[0].count);

        const totalAdminsResult = await db.query('SELECT COUNT(*) as count FROM users WHERE is_admin = 1');
        const totalAdmins = parseInt(totalAdminsResult.rows[0].count);

        const totalRecipesResult = await db.query('SELECT COUNT(*) as count FROM recipes');
        const totalRecipes = parseInt(totalRecipesResult.rows[0].count);

        // Fixed: Use sub-try-catch for subscriptions in case the table doesn't exist or has issues
        let totalSubscriptions = 0;
        try {
            const totalSubsResult = await db.query(`SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active' AND end_date > NOW()`);
            totalSubscriptions = parseInt(totalSubsResult.rows[0].count || 0);
        } catch (err) {
            console.warn('Subscriptions table query failed, defaulting to 0:', err.message);
        }

        res.json({
            totalUsers,
            totalAdmins,
            totalRecipes,
            totalSubscriptions
        });

    } catch (error) {
        console.error('SERVER ERROR [GET /api/admin/stats]:', error.message);
        console.error(error.stack);
        res.status(500).json({ error: 'Failed to get stats', details: error.message });
    }
});

// ===== Get All Users =====
router.get('/users', async (req, res) => {
    try {
        const db = getDatabase();
        const usersResult = await db.query(`
            SELECT u.*, 
                   s.plan as subscription_plan,
                   s.status as subscription_status,
                   s.end_date as subscription_end_date,
                   (SELECT COUNT(*) FROM recipes WHERE user_id = u.id) as recipe_count
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.user_id
            ORDER BY u.created_at DESC
        `);
        const users = usersResult.rows;

        const formattedUsers = users.map(user => {
            // Check if premium
            let isPremium = false;
            if (user.is_admin === 1) {
                isPremium = true;
            } else if (user.subscription_status === 'active' && new Date(user.subscription_end_date) > new Date()) {
                isPremium = true;
            }

            return {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                email: user.email,
                phone: user.phone,
                birthday: user.birthday,
                isAdmin: user.is_admin === 1,
                isPremium,
                subscriptionPlan: user.subscription_plan,
                subscriptionStatus: user.subscription_status,
                subscriptionEndDate: user.subscription_end_date,
                recipeCount: parseInt(user.recipe_count || 0),
                createdAt: user.created_at
            };
        });

        res.json(formattedUsers);

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// ===== Get Single User =====
router.get('/users/:id', async (req, res) => {
    try {
        const db = getDatabase();
        const userResult = await db.query(`
            SELECT u.*, 
                   s.plan as subscription_plan,
                   s.status as subscription_status,
                   s.end_date as subscription_end_date
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.user_id
            WHERE u.id = $1
        `, [req.params.id]);

        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user.id,
            username: user.username,
            displayName: user.display_name,
            email: user.email,
            phone: user.phone,
            birthday: user.birthday,
            isAdmin: user.is_admin === 1,
            subscriptionPlan: user.subscription_plan,
            subscriptionStatus: user.subscription_status,
            subscriptionEndDate: user.subscription_end_date,
            createdAt: user.created_at
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// ===== Update User =====
router.put('/users/:id', async (req, res) => {
    try {
        const { displayName, email, phone, password, isAdmin } = req.body;
        const db = getDatabase();
        const userId = parseInt(req.params.id);

        const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent modifying main admin if trying to remove admin status
        if (user.username === 'admin' && isAdmin === false) {
            return res.status(400).json({ error: 'Cannot remove admin status from main admin' });
        }

        let updates = [];
        let params = [];
        let paramIndex = 1;

        if (displayName) {
            updates.push(`display_name = $${paramIndex++}`);
            params.push(displayName);
        }

        if (email && email.toLowerCase() !== user.email) {
            const existingEmailResult = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase(), userId]);
            if (existingEmailResult.rows.length > 0) {
                return res.status(400).json({ error: 'Email already registered' });
            }
            updates.push(`email = $${paramIndex++}`);
            params.push(email.toLowerCase());
        }

        if (phone !== undefined) {
            updates.push(`phone = $${paramIndex++}`);
            params.push(phone || null);
        }

        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            updates.push(`password_hash = $${paramIndex++}`);
            params.push(passwordHash);
        }

        if (isAdmin !== undefined && user.username !== 'admin') {
            updates.push(`is_admin = $${paramIndex++}`);
            params.push(isAdmin ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        updates.push(`updated_at = NOW()`);

        // Add userId for WHERE clause
        params.push(userId);
        const whereIndex = paramIndex;

        await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${whereIndex}`, params);

        res.json({ success: true, message: 'User updated successfully' });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// ===== Delete User =====
router.delete('/users/:id', async (req, res) => {
    try {
        const db = getDatabase();
        const userId = parseInt(req.params.id);

        const userResult = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.username === 'admin') {
            return res.status(400).json({ error: 'Cannot delete main admin user' });
        }

        // Delete will cascade to recipes and subscriptions
        await db.query('DELETE FROM users WHERE id = $1', [userId]);

        res.json({ success: true, message: 'User deleted successfully' });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// ===== Toggle Admin Status =====
router.patch('/users/:id/toggle-admin', async (req, res) => {
    try {
        const db = getDatabase();
        const userId = parseInt(req.params.id);

        const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.username === 'admin') {
            return res.status(400).json({ error: 'Cannot modify main admin user' });
        }

        const newAdminStatus = user.is_admin === 1 ? 0 : 1;
        await db.query('UPDATE users SET is_admin = $1, updated_at = NOW() WHERE id = $2', [newAdminStatus, userId]);

        res.json({
            success: true,
            isAdmin: newAdminStatus === 1,
            message: `User is now ${newAdminStatus === 1 ? 'an admin' : 'a regular user'}`
        });

    } catch (error) {
        console.error('Toggle admin error:', error);
        res.status(500).json({ error: 'Failed to toggle admin status' });
    }
});

// ===== Grant Premium to User =====
router.post('/users/:id/grant-premium', async (req, res) => {
    try {
        const { plan = 'lifetime' } = req.body;
        const db = getDatabase();
        const userId = parseInt(req.params.id);

        const userResult = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const startDate = new Date();
        const endDate = new Date();

        const durationDays = {
            monthly: 30,
            yearly: 365,
            lifetime: 36500
        };

        endDate.setDate(endDate.getDate() + (durationDays[plan] || 36500));

        const existingSubResult = await db.query('SELECT id FROM subscriptions WHERE user_id = $1', [userId]);
        const existingSub = existingSubResult.rows[0];

        if (existingSub) {
            await db.query(`
                UPDATE subscriptions SET
                    plan = $1,
                    status = 'active',
                    start_date = $2,
                    end_date = $3,
                    granted_by_admin = 1,
                    auto_renew = 0,
                    cancelled_at = NULL,
                    updated_at = NOW()
                WHERE user_id = $4
            `, [plan, startDate.toISOString(), endDate.toISOString(), userId]);
        } else {
            await db.query(`
                INSERT INTO subscriptions (user_id, plan, status, start_date, end_date, granted_by_admin, auto_renew)
                VALUES ($1, $2, 'active', $3, $4, 1, 0)
            `, [userId, plan, startDate.toISOString(), endDate.toISOString()]);
        }

        res.json({ success: true, message: `Premium ${plan} granted to user` });

    } catch (error) {
        console.error('Grant premium error:', error);
        res.status(500).json({ error: 'Failed to grant premium' });
    }
});

// ===== Revoke Premium from User =====
router.post('/users/:id/revoke-premium', async (req, res) => {
    try {
        const db = getDatabase();
        const userId = parseInt(req.params.id);

        const subResult = await db.query('SELECT id FROM subscriptions WHERE user_id = $1', [userId]);
        if (subResult.rows.length === 0) {
            return res.status(400).json({ error: 'User has no subscription' });
        }

        await db.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);

        res.json({ success: true, message: 'Premium revoked from user' });

    } catch (error) {
        console.error('Revoke premium error:', error);
        res.status(500).json({ error: 'Failed to revoke premium' });
    }
});

// ===== Get All Recipes (Admin) =====
router.get('/recipes', async (req, res) => {
    try {
        const db = getDatabase();
        const recipesResult = await db.query(`
            SELECT r.*, u.username, u.display_name as user_display_name
            FROM recipes r
            JOIN users u ON r.user_id = u.id
            ORDER BY r.created_at DESC
        `);
        const recipes = recipesResult.rows;

        res.json(recipes.map(r => ({
            id: r.id,
            name: r.name,
            category: r.category,
            difficulty: r.difficulty,
            username: r.username,
            userDisplayName: r.user_display_name,
            createdAt: r.created_at
        })));

    } catch (error) {
        console.error('Get all recipes error:', error);
        res.status(500).json({ error: 'Failed to get recipes' });
    }
});

// ===== Export All Data =====
router.get('/export', async (req, res) => {
    try {
        const db = getDatabase();

        const usersResult = await db.query('SELECT id, username, display_name, email, is_admin, created_at FROM users');
        const recipesResult = await db.query('SELECT * FROM recipes');
        const subsResult = await db.query('SELECT * FROM subscriptions');
        const transResult = await db.query('SELECT * FROM transactions');

        res.json({
            exportDate: new Date().toISOString(),
            data: {
                users: usersResult.rows,
                recipes: recipesResult.rows,
                subscriptions: subsResult.rows,
                transactions: transResult.rows
            }
        });

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

export default router;
