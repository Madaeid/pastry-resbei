// JWT Authentication Middleware
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'pastry-secret-key';

// Verify JWT token
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(403).json({ error: 'Invalid token' });
    }
}

// Check if user is admin
export function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const db = getDatabase();
    const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.userId);

    if (!user || !user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    next();
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
    requireAdmin,
    generateToken,
    generateRefreshToken
};
