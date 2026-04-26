
// User Routes
import express from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/db.js';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ===== Get Public Chef Profiles =====
router.get('/public', optionalAuthenticateToken, async (req, res) => {
    try {
        const db = getDatabase();

        // Check if requesting user is admin
        let isRequestingAdmin = false;
        if (req.user) {
            const adminCheck = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
            isRequestingAdmin = adminCheck.rows[0]?.is_admin === 1;
        }

        let result;
        if (isRequestingAdmin) {
            // Admin can see ALL users including private profiles
            result = await db.query(`
                SELECT username, display_name, profile_picture, gallery, cv_file, created_at, is_admin, is_public
                FROM users 
                ORDER BY created_at DESC
            `);
        } else {
            // Return users whose profile is visible (not 'private' or false)
            result = await db.query(`
                SELECT username, display_name, profile_picture, gallery, cv_file, created_at, is_admin, is_public
                FROM users 
                WHERE is_public IS NOT NULL AND is_public != 'private' AND is_public != 'false'
                ORDER BY created_at DESC
            `);
        }

        // Filter out admins from the list and format
        const chefs = result.rows
            .filter(user => {
                if (user.username === 'admin' || user.is_admin === 1) return false;
                // For non-admin requesters, also filter private
                if (!isRequestingAdmin && (user.is_public === false || user.is_public === 'private')) return false;
                return true;
            })
            .map(user => ({
                username: user.username,
                displayName: user.display_name,
                profilePicture: user.profile_picture,
                isPublic: user.is_public || 'all',
                gallery: user.gallery || [],
                cvFile: user.cv_file,
                createdAt: user.created_at
            }));

        res.json(chefs);
    } catch (error) {
        console.error('Get public profiles error:', error);
        res.status(500).json({ error: 'Failed to get public profiles' });
    }
});

// ===== Get Specific Public Chef Profile =====
router.get('/public/:username', optionalAuthenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        const db = getDatabase();

        // Check if requesting user is admin
        let isRequestingAdmin = false;
        if (req.user) {
            const adminCheck = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
            isRequestingAdmin = adminCheck.rows[0]?.is_admin === 1;
        }

        let result;
        if (isRequestingAdmin) {
            // Admin bypass: fetch user regardless of visibility
            result = await db.query(`
                SELECT id, username, display_name, profile_picture, gallery, created_at, is_public, allowed_viewers
                FROM users 
                WHERE username = $1
                LIMIT 1
            `, [username]);
        } else {
            result = await db.query(`
                SELECT id, username, display_name, profile_picture, gallery, created_at, is_public, allowed_viewers
                FROM users 
                WHERE username = $1 AND is_public IS NOT NULL AND is_public != 'private' AND is_public != 'false'
                LIMIT 1
            `, [username]);
        }

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Chef not found or profile is private' });
        }

        const user = result.rows[0];

        // Also get some stats (like count, share count for their recipes)
        const statsResult = await db.query(`
            SELECT 
                (SELECT COUNT(id) FROM recipes WHERE user_id = $1 AND visibility = 'public') as post_count,
                (SELECT COUNT(id) FROM follows WHERE following_id = $1) as followers_count,
                (SELECT COUNT(id) FROM follows WHERE follower_id = $1) as following_count,
                (SELECT SUM((SELECT COUNT(*) FROM recipe_likes WHERE recipe_id = recipes.id)) FROM recipes WHERE user_id = $1) as total_likes
        `, [user.id]);

        const stats = statsResult.rows[0];

        res.json({
            id: user.id,
            username: user.username,
            displayName: user.display_name,
            profilePicture: user.profile_picture,
            gallery: user.gallery || [],
            createdAt: user.created_at,
            isPrivate: user.is_public === 'private' || user.is_public === 'false',
            stats: {
                posts: parseInt(stats.post_count) || 0,
                likes: parseInt(stats.total_likes) || 0,
                followers: parseInt(stats.followers_count) || 0,
                following: parseInt(stats.following_count) || 0
            }
        });
    } catch (error) {
        console.error('Get specific public profile error:', error);
        res.status(500).json({ error: 'Failed to get chef profile' });
    }
});

// ===== Get User Profile =====
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT id, username, display_name, email, phone, birthday, is_admin, created_at, profile_picture, gallery, cv_file, is_public, allowed_viewers
            FROM users WHERE id = $1
        `, [req.user.userId]);

        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const statsResult = await db.query(`
            SELECT 
                (SELECT COUNT(id) FROM recipes WHERE user_id = $1) as post_count,
                (SELECT COUNT(id) FROM follows WHERE following_id = $1) as followers_count,
                (SELECT COUNT(id) FROM follows WHERE follower_id = $1) as following_count,
                (SELECT SUM((SELECT COUNT(*) FROM recipe_likes WHERE recipe_id = recipes.id)) FROM recipes WHERE user_id = $1) as total_likes
        `, [user.id]);
        const stats = statsResult.rows[0];

        res.json({
            id: user.id,
            username: user.username,
            displayName: user.display_name,
            email: user.email,
            phone: user.phone,
            birthday: user.birthday,
            isAdmin: user.is_admin === 1,
            isPublic: user.is_public || 'all',
            allowedViewers: user.allowed_viewers || [],
            profilePicture: user.profile_picture,
            gallery: user.gallery || [],
            cvFile: user.cv_file,
            createdAt: user.created_at,
            stats: {
                posts: parseInt(stats.post_count) || 0,
                likes: parseInt(stats.total_likes) || 0,
                followers: parseInt(stats.followers_count) || 0,
                following: parseInt(stats.following_count) || 0
            }
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// ===== Update User Profile =====
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { displayName, email, phone, phoneNumber, password, newUsername, profilePicture, gallery, cvFile, isPublic, allowedViewers } = req.body;
        const db = getDatabase();
        const userId = req.user.userId;

        const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let updates = [];
        let params = [];
        let paramIndex = 1;

        // Update display name
        if (displayName) {
            updates.push(`display_name = $${paramIndex++}`);
            params.push(displayName);
        }

        // Update email
        if (email && email.toLowerCase() !== user.email) {
            const existingEmailResult = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase(), userId]);
            if (existingEmailResult.rows.length > 0) {
                return res.status(400).json({ error: 'Email already registered by another user' });
            }
            updates.push(`email = $${paramIndex++}`);
            params.push(email.toLowerCase());
        }

        // Update phone (support both 'phone' and 'phoneNumber' field names)
        const phoneValue = phone || phoneNumber;
        if (phoneValue !== undefined) {
            updates.push(`phone = $${paramIndex++}`);
            params.push(phoneValue || null);
        }

        // Update profile picture
        if (profilePicture !== undefined) {
            updates.push(`profile_picture = $${paramIndex++}`);
            params.push(profilePicture);
        }

        // Update CV file
        if (cvFile !== undefined) {
            updates.push(`cv_file = $${paramIndex++}`);
            params.push(cvFile);
        }

        // Update visibility
        if (isPublic !== undefined) {
            // isPublic can be false, 'all', 'followers', or 'specific'
            const visibilityValue = isPublic === false ? 'private' : (isPublic === true ? 'all' : isPublic);
            updates.push(`is_public = $${paramIndex++}`);
            params.push(visibilityValue);
        }

        // Update allowed viewers
        if (allowedViewers !== undefined) {
            updates.push(`allowed_viewers = $${paramIndex++}`);
            params.push(JSON.stringify(allowedViewers));
        }

        // Update gallery
        if (gallery !== undefined) {
            updates.push(`gallery = $${paramIndex++}`);
            params.push(JSON.stringify(gallery));
        }

        // Update password
        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            updates.push(`password_hash = $${paramIndex++}`);
            params.push(passwordHash);
        }

        // Update username (complex - requires data migration if username changes logic specific to app, but here simple info update)
        if (newUsername && newUsername.toLowerCase() !== user.username) {
            if (newUsername.length < 3) {
                return res.status(400).json({ error: 'Username must be at least 3 characters' });
            }
            const existingUsernameResult = await db.query('SELECT id FROM users WHERE username = $1', [newUsername.toLowerCase()]);
            if (existingUsernameResult.rows.length > 0) {
                return res.status(400).json({ error: 'Username already taken' });
            }
            updates.push(`username = $${paramIndex++}`);
            params.push(newUsername.toLowerCase());
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        // Add updated_at
        updates.push(`updated_at = NOW()`);

        // Add userId for WHERE clause
        params.push(userId);
        const whereIndex = paramIndex;

        await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${whereIndex}`, params);

        // Also sync matching fields to CV if CV exists
        try {
            const cvUpdateFields = [];
            const cvParams = [];
            let cvParamIndex = 1;

            if (phoneValue !== undefined) {
                cvUpdateFields.push(`phone = $${cvParamIndex++}`);
                cvParams.push(phoneValue || null);
            }
            if (email && email.toLowerCase() !== user.email) {
                cvUpdateFields.push(`email = $${cvParamIndex++}`);
                cvParams.push(email.toLowerCase());
            }
            if (profilePicture !== undefined) {
                cvUpdateFields.push(`photo = $${cvParamIndex++}`);
                cvParams.push(profilePicture);
            }

            if (cvUpdateFields.length > 0) {
                cvUpdateFields.push(`updated_at = NOW()`);
                cvParams.push(userId);
                await db.query(
                    `UPDATE cvs SET ${cvUpdateFields.join(', ')} WHERE user_id = $${cvParamIndex}`,
                    cvParams
                );
            }
        } catch (cvErr) {
            // CV might not exist yet, ignore error
            console.log('CV sync skipped (CV may not exist yet)');
        }

        // Get updated user
        const updatedUserResult = await db.query(`
            SELECT id, username, display_name, email, phone, birthday, is_admin, created_at, profile_picture, gallery, cv_file, is_public, allowed_viewers
            FROM users WHERE id = $1
        `, [userId]);
        const updatedUser = updatedUserResult.rows[0];

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                displayName: updatedUser.display_name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                birthday: updatedUser.birthday,
                isAdmin: updatedUser.is_admin === 1,
                isPublic: updatedUser.is_public || 'all',
                allowedViewers: updatedUser.allowed_viewers || [],
                profilePicture: updatedUser.profile_picture,
                gallery: updatedUser.gallery || [],
                cvFile: updatedUser.cv_file
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Toggle Follow a user
router.post('/:id/follow', authenticateToken, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const followerId = req.user.userId;

        if (parseInt(targetUserId) === parseInt(followerId)) {
            return res.status(400).json({ error: 'You cannot follow yourself' });
        }

        const db = getDatabase();
        
        // Check if already following
        const checkResult = await db.query(
            'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
            [followerId, targetUserId]
        );

        if (checkResult.rows.length > 0) {
            // Unfollow
            await db.query(
                'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
                [followerId, targetUserId]
            );
            return res.json({ success: true, following: false });
        } else {
            // Follow
            await db.query(
                'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
                [followerId, targetUserId]
            );
            return res.json({ success: true, following: true });
        }
    } catch (error) {
        console.error('Follow error:', error);
        res.status(500).json({ error: 'Failed to toggle follow' });
    }
});

// Check if following
router.get('/:id/is-following', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(
            'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
            [req.user.userId, req.params.id]
        );
        res.json({ following: result.rows.length > 0 });
    } catch (error) {
        res.status(500).json({ error: 'Error checking follow status' });
    }
});

// Get Followers
router.get('/:id/followers', async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT u.id, u.username, u.display_name, u.profile_picture 
            FROM follows f
            JOIN users u ON f.follower_id = u.id
            WHERE f.following_id = $1
            ORDER BY f.created_at DESC
        `, [req.params.id]);
        
        res.json(result.rows.map(row => ({
            id: row.id,
            username: row.username,
            name: row.display_name,
            pic: row.profile_picture
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to get followers' });
    }
});

// Get Following
router.get('/:id/following', async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT u.id, u.username, u.display_name, u.profile_picture 
            FROM follows f
            JOIN users u ON f.following_id = u.id
            WHERE f.follower_id = $1
            ORDER BY f.created_at DESC
        `, [req.params.id]);
        
        res.json(result.rows.map(row => ({
            id: row.id,
            username: row.username,
            name: row.display_name,
            pic: row.profile_picture
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to get following list' });
    }
});

export default router;
