
// User Routes
import express from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ===== Get User Profile =====
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT id, username, display_name, email, phone, birthday, is_admin, created_at, profile_picture, gallery, cv_file
            FROM users WHERE id = $1
        `, [req.user.userId]);

        const user = result.rows[0];

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
            profilePicture: user.profile_picture,
            gallery: user.gallery || [],
            cvFile: user.cv_file,
            createdAt: user.created_at
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// ===== Update User Profile =====
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { displayName, email, phone, phoneNumber, password, newUsername, profilePicture, gallery, cvFile } = req.body;
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

            if (displayName) {
                cvUpdateFields.push(`full_name = $${cvParamIndex++}`);
                cvParams.push(displayName);
            }
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
            SELECT id, username, display_name, email, phone, birthday, is_admin, created_at, profile_picture, gallery, cv_file
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

export default router;
