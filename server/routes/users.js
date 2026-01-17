// User Routes
import express from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ===== Get User Profile =====
router.get('/profile', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const user = db.prepare(`
            SELECT id, username, display_name, email, phone, birthday, is_admin, created_at, profile_picture
            FROM users WHERE id = ?
        `).get(req.user.userId);

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
        const { displayName, email, phone, phoneNumber, password, newUsername, profilePicture } = req.body;
        const db = getDatabase();
        const userId = req.user.userId;

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let updates = [];
        let params = [];

        // Update display name
        if (displayName) {
            updates.push('display_name = ?');
            params.push(displayName);
        }

        // Update email
        if (email && email.toLowerCase() !== user.email) {
            const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), userId);
            if (existingEmail) {
                return res.status(400).json({ error: 'Email already registered by another user' });
            }
            updates.push('email = ?');
            params.push(email.toLowerCase());
        }

        // Update phone (support both 'phone' and 'phoneNumber' field names)
        const phoneValue = phone || phoneNumber;
        if (phoneValue !== undefined) {
            updates.push('phone = ?');
            params.push(phoneValue || null);
        }

        // Update profile picture
        if (profilePicture !== undefined) {
            updates.push('profile_picture = ?');
            params.push(profilePicture);
        }

        // Update password
        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            updates.push('password_hash = ?');
            params.push(passwordHash);
        }

        // Update username (complex - requires data migration)
        if (newUsername && newUsername.toLowerCase() !== user.username) {
            if (newUsername.length < 3) {
                return res.status(400).json({ error: 'Username must be at least 3 characters' });
            }
            const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(newUsername.toLowerCase());
            if (existingUsername) {
                return res.status(400).json({ error: 'Username already taken' });
            }
            updates.push('username = ?');
            params.push(newUsername.toLowerCase());
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        // Add updated_at
        updates.push('updated_at = ?');
        params.push(new Date().toISOString());

        // Add userId for WHERE clause
        params.push(userId);

        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

        // Get updated user
        const updatedUser = db.prepare(`
            SELECT id, username, display_name, email, phone, birthday, is_admin, created_at, profile_picture
            FROM users WHERE id = ?
        `).get(userId);

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
                profilePicture: updatedUser.profile_picture
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

export default router;
