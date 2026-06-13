
// Authentication Routes
import express from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDatabase } from '../database/db.js';
import { generateToken, generateRefreshToken, authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../utils/validators.js';

import jwt from 'jsonwebtoken';

const router = express.Router();

async function ensureAuthTables() {
    const db = getDatabase();
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token TEXT NOT NULL UNIQUE,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

            CREATE TABLE IF NOT EXISTS token_blacklist (
                id SERIAL PRIMARY KEY,
                token TEXT NOT NULL UNIQUE,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token);
        `);
    } catch (err) {
        console.error('Auth table init error:', err.message);
    }
}
ensureAuthTables();

// ===== Register =====
router.post('/register', validate(registerSchema), async (req, res) => {
    try {
        const { username, email, phone, birthday, password } = req.body;
        const db = getDatabase();

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

        // Check if phone exists (Optimized check in DB)
        if (phone) {
            const normalizedPhone = phone.replace(/[\s\-\(\)\.]/g, '');
            const phoneCheck = await db.query(`
                SELECT id FROM users 
                WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') = $1
            `, [normalizedPhone]);
            
            if (phoneCheck.rows.length > 0) {
                return res.status(400).json({ error: 'Phone number already registered' });
            }
        }


        // Hash password and create user
        const passwordHash = await bcrypt.hash(password, 10);

        const insertResult = await db.query(`
            INSERT INTO users (username, display_name, email, phone, birthday, password_hash, is_admin)
            VALUES ($1, $2, $3, $4, $5, $6, false)
            RETURNING id
        `, [
            username.toLowerCase(),
            username,
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
router.post('/login', validate(loginSchema), async (req, res) => {
    try {
        const { username, password } = req.body;
        const db = getDatabase();

        // Find user
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username.toLowerCase()]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Verify password (OAuth users may not have a password_hash)
        if (!user.password_hash) {
            const provider = user.auth_provider || 'OAuth';
            return res.status(401).json({ error: `This account uses ${provider} sign-in. Please use the ${provider} button to log in.` });
        }
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Generate token
        const token = generateToken(user.id, user.username, !!user.is_admin);
        const refreshToken = generateRefreshToken(user.id);
        
        // Save refresh token to DB
        await db.query(`
            INSERT INTO refresh_tokens (user_id, token, expires_at)
            VALUES ($1, $2, NOW() + INTERVAL '7 days')
        `, [user.id, refreshToken]);

        // Set refresh token in HttpOnly cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                email: user.email,
                isAdmin: !!user.is_admin
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
            isAdmin: !!user.is_admin,
            createdAt: user.created_at
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user data' });
    }
});

// تم تعديل الجزء الحساس في مسار forgot-password داخل ملف server/routes/auth.js لحماية الرموز
router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
    try {
        const { username, contactValue, method = 'email' } = req.body;
        const db = getDatabase();

        const result = await db.query('SELECT * FROM users WHERE username = $1', [username.toLowerCase()]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // التحقق من صحة جهة الاتصال المُدخلة
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

        // توليد رمز التعيين عشوائياً بشكل آمن تشفيرياً
        const code = crypto.randomInt(100000, 1000000).toString();
        const expiry = Date.now() + (10 * 60 * 1000); // صلاحية لمدة 10 دقائق

        // تحديث البيانات في قاعدة البيانات
        await db.query(`
            UPDATE users SET reset_code = $1, reset_code_expiry = $2, reset_method = $3
            WHERE id = $4
        `, [code, expiry, method, user.id]);

        // قناع إخفاء البيانات لحماية الخصوصية قبل الإرجاع للواجهة
        let maskedContact = '';
        if (method === 'email') {
            const [localPart, domain] = contactValue.split('@');
            maskedContact = localPart.slice(0, 2) + '***@' + domain;
        } else {
            maskedContact = contactValue.slice(0, 3) + '****' + contactValue.slice(-3);
        }

        if (process.env.NODE_ENV === 'development') {
            console.log(`[RESET CODE] User: ${username}, Code: ${code}, Method: ${method}`);
        } else {
            // TODO: Add real email or SMS sending logic here for production environment
        }

        // ملاحظة: هنا يتم استدعاء دالة الإرسال الحقيقية عبر البريد الإلكتروني أو الرسائل النصية الموثقة
        res.json({
            success: true,
            maskedContact,
            method
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to send reset code' });
    }
});

// ===== Reset Password with Code =====
router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
    try {
        const { username, code, newPassword } = req.body;
        const db = getDatabase();

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

// ===== Logout =====
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const cookieHeader = req.headers?.cookie || '';
        const cookies = cookieHeader ? Object.fromEntries(cookieHeader.split(';').map(c => {
            const parts = c.split('=');
            return [parts[0].trim(), parts.slice(1).join('=').trim()];
        })) : {};
        const refreshToken = cookies.refreshToken;

        if (refreshToken) {
            await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
        }

        // Add the current access token to the blacklist to fully revoke it
        if (req.token) {
            let expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default fallback: 24h
            try {
                const decoded = jwt.decode(req.token);
                if (decoded && decoded.exp) {
                    expiresAt = new Date(decoded.exp * 1000);
                }
            } catch (decodeErr) {
                console.error('Error decoding token expiration:', decodeErr);
            }

            await db.query(`
                INSERT INTO token_blacklist (token, expires_at)
                VALUES ($1, $2)
                ON CONFLICT (token) DO NOTHING
            `, [req.token, expiresAt]);
        }

        res.clearCookie('refreshToken');
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// ===== Refresh Token =====
router.post('/refresh-token', async (req, res) => {
    try {
        const db = getDatabase();
        const cookieHeader = req.headers?.cookie || '';
        const cookies = cookieHeader ? Object.fromEntries(cookieHeader.split(';').map(c => {
            const parts = c.split('=');
            return [parts[0].trim(), parts.slice(1).join('=').trim()];
        })) : {};
        const refreshToken = cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }

        const result = await db.query('SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()', [refreshToken]);
        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Invalid or expired refresh token' });
        }

        const { default: jwt } = await import('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'pastry-secret-key';
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, JWT_SECRET);
        } catch (err) {
            return res.status(403).json({ error: 'Invalid refresh token signature' });
        }

        const userResult = await db.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
        const user = userResult.rows[0];
        
        if (!user) {
            return res.status(403).json({ error: 'User no longer exists' });
        }

        const newAccessToken = generateToken(user.id, user.username, !!user.is_admin);

        res.json({
            success: true,
            token: newAccessToken
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

export default router;
