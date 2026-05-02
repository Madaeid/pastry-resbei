
// JWT Authentication Middleware
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'pastry-secret-key';

// Verify JWT token (Required)
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired' });
            }
            return res.status(403).json({ error: 'Invalid token' });
        }
        
        req.user = user;
        
        // Validate that userId is a valid number if needed
        if (isNaN(parseInt(req.user.userId))) {
            console.error('Invalid userId in token payload:', req.user.userId);
            return res.status(403).json({ error: 'Invalid token payload' });
        }
        
        next();
    });
}

// Optional Authentication Middleware
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
        // If token exists but is invalid, we still treat as non-authenticated
        next();
    }
}

// Check if user is admin
export async function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const db = getDatabase();
        const result = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
        const user = result.rows[0];

        if (!user || user.is_admin !== 1) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Check if user has premium subscription
export async function requirePremium(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const db = getDatabase();

        // Check for active subscription
        // Postgres: Use NOW() or CURRENT_TIMESTAMP
        const subResult = await db.query(`
            SELECT * FROM subscriptions 
            WHERE user_id = $1 AND status = 'active' AND end_date > NOW()
        `, [req.user.userId]);
        const subscription = subResult.rows[0];

        // Also check if user is admin (admins have access to everything)
        const userResult = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
        const user = userResult.rows[0];

        if (!subscription && (!user || user.is_admin !== 1)) {
            return res.status(403).json({ error: 'Premium subscription required' });
        }

        next();
    } catch (error) {
        console.error('Premium check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Generate JWT token
export function generateToken(userId, username, isAdmin = false) {
    return jwt.sign(
        {
            userId,
            username,
            isAdmin
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

// Generate refresh token
export function generateRefreshToken(userId) {
    return jwt.sign(
        { userId, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

export default {
    authenticateToken,
    optionalAuthenticateToken,
    requireAdmin,
    requirePremium,
    generateToken,
    generateRefreshToken
};
