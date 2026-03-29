
// Authentication Routes
import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ===== Register =====
router.post('/register', async (req, res) => {
    try {
        const { username, email, phone, birthday, password } = req.body;
        const db = getDatabase();

        // Validation
        if (!username || username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Please enter a valid email address' });
        }

        const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
        if (phone && !phoneRegex.test(phone.replace(/\s/g, ''))) {
            return res.status(400).json({ error: 'Please enter a valid phone number' });
        }

        if (!password || password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters long' });
        }

        // Check password strength: must contain uppercase, lowercase, and number
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);

        if (!hasUppercase || !hasLowercase || !hasNumber) {
            return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
        }

        // Age validation
        if (birthday) {
            const birthDate = new Date(birthday);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            if (age < 13) {
                return res.status(400).json({ error: 'You must be at least 13 years old to register' });
            }
        }

        // Check if username exists
        const userCheck = await db.query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Check if email exists
        const emailCheck = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Check if phone exists (simplified check)
        if (phone) {
            const normalizedPhone = phone.replace(/[\s\-\(\)\.]/g, '');
            // Simple check - normalize and compare digits only
            // Note: In PG doing this in code is less efficient than SQL but needed for complex normalization
            const allPhonesResult = await db.query('SELECT id, phone FROM users WHERE phone IS NOT NULL');
            const phoneExists = allPhonesResult.rows.some(u => {
                const userPhone = (u.phone || '').replace(/[\s\-\(\)\.]/g, '');
                return userPhone === normalizedPhone;
            });
            if (phoneExists) {
                return res.status(400).json({ error: 'Phone number already registered' });
            }
        }


        // Hash password and create user
        const passwordHash = await bcrypt.hash(password, 10);

        const insertResult = await db.query(`
            INSERT INTO users (username, display_name, email, phone, birthday, password_hash, is_admin)
            VALUES ($1, $2, $3, $4, $5, $6, 0)
            RETURNING id
        `, [
            username.toLowerCase(),
            username, // Display name defaults to username
            email.toLowerCase(),
            phone || null,
            birthday || null,
            passwordHash
        ]);

        const userId = insertResult.rows[0].id;
        console.log(`✅ User registered in PostgreSQL - ID: ${userId}, Username: ${username}`);

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            userId: userId
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// ===== Login =====
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const db = getDatabase();

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Find user
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username.toLowerCase()]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Generate token
        const token = generateToken(user.id, user.username, user.is_admin === 1);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                email: user.email,
                isAdmin: user.is_admin === 1
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ===== Get Current User =====
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT id, username, display_name, email, phone, birthday, is_admin, created_at
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
            createdAt: user.created_at
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user data' });
    }
});

// ===== Send Reset Code =====
router.post('/forgot-password', async (req, res) => {
    try {
        const { username, contactValue, method = 'email' } = req.body;
        const db = getDatabase();

        const result = await db.query('SELECT * FROM users WHERE username = $1', [username.toLowerCase()]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify contact
        if (method === 'email') {
            if (!user.email || user.email.toLowerCase() !== contactValue.toLowerCase()) {
                return res.status(400).json({ error: 'Email does not match our records' });
            }
        } else if (method === 'phone') {
            const normalizePhone = (phone) => phone.replace(/[\s\-\(\)\.]/g, '');
            if (!user.phone || normalizePhone(user.phone) !== normalizePhone(contactValue)) {
                return res.status(400).json({ error: 'Phone number does not match our records' });
            }
        }

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = Date.now() + (10 * 60 * 1000); // 10 minutes

        // Save code to database
        await db.query(`
            UPDATE users SET reset_code = $1, reset_code_expiry = $2, reset_method = $3
            WHERE id = $4
        `, [code, expiry, method, user.id]);

        // Mask contact info
        let maskedContact = '';
        if (method === 'email') {
            const [localPart, domain] = contactValue.split('@');
            maskedContact = localPart.slice(0, 2) + '***@' + domain;
        } else {
            maskedContact = contactValue.slice(0, 3) + '****' + contactValue.slice(-3);
        }

        // In production, send actual email/SMS
        console.log(`[RESET CODE] User: ${username}, Code: ${code}, Method: ${method}`);

        res.json({
            success: true,
            maskedContact,
            method,
            // Only include code in development
            ...(process.env.NODE_ENV === 'development' && { code })
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to send reset code' });
    }
});

// ===== Reset Password with Code =====
router.post('/reset-password', async (req, res) => {
    try {
        const { username, code, newPassword } = req.body;
        const db = getDatabase();

        if (!newPassword || newPassword.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }

        // Check password strength: must contain uppercase, lowercase, and number
        const hasUppercase = /[A-Z]/.test(newPassword);
        const hasLowercase = /[a-z]/.test(newPassword);
        const hasNumber = /[0-9]/.test(newPassword);

        if (!hasUppercase || !hasLowercase || !hasNumber) {
            return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' });
        }

        const result = await db.query('SELECT * FROM users WHERE username = $1', [username.toLowerCase()]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify code
        if (!user.reset_code || user.reset_code !== code) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Verify expiry
        if (Date.now() > Number(user.reset_code_expiry)) {
            return res.status(400).json({ error: 'Verification code has expired' });
        }

        // Hash new password and save
        const passwordHash = await bcrypt.hash(newPassword, 10);

        await db.query(`
            UPDATE users 
            SET password_hash = $1, reset_code = NULL, reset_code_expiry = NULL, reset_method = NULL
            WHERE id = $2
        `, [passwordHash, user.id]);

        res.json({ success: true, message: 'Password reset successfully' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// ===== Logout (optional - client-side token removal is usually sufficient) =====
router.post('/logout', authenticateToken, (req, res) => {
    // In a production app, you might blacklist the token here
    res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
