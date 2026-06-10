import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/db.js';

// منع استخدام أي مفتاح افتراضي كودي سخت
const JWT_SECRET = process.env.JWT_SECRET;

export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired' });
            }
            return res.status(403).json({ error: 'Invalid token' });
        }
        
        req.user = user;
        if (isNaN(parseInt(req.user.userId))) {
            return res.status(403).json({ error: 'Invalid token payload' });
        }
        
        next();
    });
}

export function optionalAuthenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        next();
    }
}

export async function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const db = getDatabase();
        const result = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
        const user = result.rows[0];

        // التأكد من المقارنة الصارمة والآمنة للصلاحيات
        if (!user || parseInt(user.is_admin) !== 1) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function requirePremium(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const db = getDatabase();
        const subResult = await db.query(`
            SELECT 1 FROM subscriptions 
            WHERE user_id = $1 AND status = 'active' AND end_date > NOW()
            LIMIT 1
        `, [req.user.userId]);
        const hasSubscription = subResult.rows.length > 0;

        const userResult = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
        const user = userResult.rows[0];

        if (!hasSubscription && (!user || parseInt(user.is_admin) !== 1)) {
            return res.status(403).json({ error: 'Premium subscription required' });
        }

        next();
    } catch (error) {
        console.error('Premium check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export function generateToken(userId, username, isAdmin = false) {
    return jwt.sign({ userId, username, isAdmin }, JWT_SECRET, { expiresIn: '24h' });
}

export function generateRefreshToken(userId) {
    return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
}
