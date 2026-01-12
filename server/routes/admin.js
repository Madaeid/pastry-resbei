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
router.get('/stats', (req, res) => {
    try {
        const db = getDatabase();

        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const totalAdmins = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get().count;
        const totalRecipes = db.prepare('SELECT COUNT(*) as count FROM recipes').get().count;
        const totalSubscriptions = db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE status = "active" AND end_date > datetime("now")').get().count;

        res.json({
            totalUsers,
            totalAdmins,
            totalRecipes,
            totalSubscriptions
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// ===== Get All Users =====
router.get('/users', (req, res) => {
    try {
        const db = getDatabase();
        const users = db.prepare(`
            SELECT u.*, 
                   s.plan as subscription_plan,
                   s.status as subscription_status,
                   s.end_date as subscription_end_date,
                   (SELECT COUNT(*) FROM recipes WHERE user_id = u.id) as recipe_count
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.user_id
            ORDER BY u.created_at DESC
        `).all();

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
                recipeCount: user.recipe_count,
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
router.get('/users/:id', (req, res) => {
    try {
        const db = getDatabase();
        const user = db.prepare(`
            SELECT u.*, 
                   s.plan as subscription_plan,
                   s.status as subscription_status,
                   s.end_date as subscription_end_date
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.user_id
            WHERE u.id = ?
        `).get(req.params.id);

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

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent modifying main admin if trying to remove admin status
        if (user.username === 'admin' && isAdmin === false) {
            return res.status(400).json({ error: 'Cannot remove admin status from main admin' });
        }

        let updates = [];
        let params = [];

        if (displayName) {
            updates.push('display_name = ?');
            params.push(displayName);
        }

        if (email && email.toLowerCase() !== user.email) {
            const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), userId);
            if (existingEmail) {
                return res.status(400).json({ error: 'Email already registered' });
            }
            updates.push('email = ?');
            params.push(email.toLowerCase());
        }

        if (phone !== undefined) {
            updates.push('phone = ?');
            params.push(phone || null);
        }

        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            updates.push('password_hash = ?');
            params.push(passwordHash);
        }

        if (isAdmin !== undefined && user.username !== 'admin') {
            updates.push('is_admin = ?');
            params.push(isAdmin ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        updates.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(userId);

        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

        res.json({ success: true, message: 'User updated successfully' });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// ===== Delete User =====
router.delete('/users/:id', (req, res) => {
    try {
        const db = getDatabase();
        const userId = parseInt(req.params.id);

        const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.username === 'admin') {
            return res.status(400).json({ error: 'Cannot delete main admin user' });
        }

        // Delete will cascade to recipes and subscriptions
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);

        res.json({ success: true, message: 'User deleted successfully' });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// ===== Toggle Admin Status =====
router.patch('/users/:id/toggle-admin', (req, res) => {
    try {
        const db = getDatabase();
        const userId = parseInt(req.params.id);

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.username === 'admin') {
            return res.status(400).json({ error: 'Cannot modify main admin user' });
        }

        const newAdminStatus = user.is_admin === 1 ? 0 : 1;
        db.prepare('UPDATE users SET is_admin = ?, updated_at = ? WHERE id = ?')
            .run(newAdminStatus, new Date().toISOString(), userId);

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
router.post('/users/:id/grant-premium', (req, res) => {
    try {
        const { plan = 'lifetime' } = req.body;
        const db = getDatabase();
        const userId = parseInt(req.params.id);

        const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
        if (!user) {
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

        const existingSub = db.prepare('SELECT id FROM subscriptions WHERE user_id = ?').get(userId);

        if (existingSub) {
            db.prepare(`
                UPDATE subscriptions SET
                    plan = ?,
                    status = 'active',
                    start_date = ?,
                    end_date = ?,
                    granted_by_admin = 1,
                    auto_renew = 0,
                    cancelled_at = NULL,
                    updated_at = ?
                WHERE user_id = ?
            `).run(plan, startDate.toISOString(), endDate.toISOString(), new Date().toISOString(), userId);
        } else {
            db.prepare(`
                INSERT INTO subscriptions (user_id, plan, status, start_date, end_date, granted_by_admin, auto_renew)
                VALUES (?, ?, 'active', ?, ?, 1, 0)
            `).run(userId, plan, startDate.toISOString(), endDate.toISOString());
        }

        res.json({ success: true, message: `Premium ${plan} granted to user` });

    } catch (error) {
        console.error('Grant premium error:', error);
        res.status(500).json({ error: 'Failed to grant premium' });
    }
});

// ===== Revoke Premium from User =====
router.post('/users/:id/revoke-premium', (req, res) => {
    try {
        const db = getDatabase();
        const userId = parseInt(req.params.id);

        const subscription = db.prepare('SELECT id FROM subscriptions WHERE user_id = ?').get(userId);
        if (!subscription) {
            return res.status(400).json({ error: 'User has no subscription' });
        }

        db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(userId);

        res.json({ success: true, message: 'Premium revoked from user' });

    } catch (error) {
        console.error('Revoke premium error:', error);
        res.status(500).json({ error: 'Failed to revoke premium' });
    }
});

// ===== Get All Recipes (Admin) =====
router.get('/recipes', (req, res) => {
    try {
        const db = getDatabase();
        const recipes = db.prepare(`
            SELECT r.*, u.username, u.display_name as user_display_name
            FROM recipes r
            JOIN users u ON r.user_id = u.id
            ORDER BY r.created_at DESC
        `).all();

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
router.get('/export', (req, res) => {
    try {
        const db = getDatabase();

        const users = db.prepare('SELECT id, username, display_name, email, is_admin, created_at FROM users').all();
        const recipes = db.prepare('SELECT * FROM recipes').all();
        const subscriptions = db.prepare('SELECT * FROM subscriptions').all();
        const transactions = db.prepare('SELECT * FROM transactions').all();

        res.json({
            exportDate: new Date().toISOString(),
            data: {
                users,
                recipes,
                subscriptions,
                transactions
            }
        });

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

export default router;
