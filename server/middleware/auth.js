// JWT Authentication Middleware - المصحح والمؤمن بالكامل
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'pastry-secret-key';

// التحقق من صلاحية الجلسة والتوكن الأساسي
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
        
        // حماية إضافية: التحقق من أن معرف المستخدم رقم صحيح وقابل للتحليل
        if (!req.user || isNaN(parseInt(req.user.userId, 10))) {
            console.error('Invalid userId in token payload:', req.user?.userId);
            return res.status(403).json({ error: 'Invalid token payload data structure' });
        }
        
        next();
    });
}

// التحقق الاختياري من التوكن
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
        next(); // الاستمرار كمستخدم مجهول في حال تلف التوكن
    }
}

// التحقق الصارم من صلاحيات المشرفين (Admin) لمنع اختراق الصلاحيات
export async function requireAdmin(req, res, next) {
    if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const db = getDatabase();
        const userIdSanitized = parseInt(req.user.userId, 10);

        // جلب الحالة من قاعدة البيانات مباشرة بدلاً من الاعتماد الكلي على التوكن
        const result = await db.query('SELECT is_admin FROM users WHERE id = $1', [userIdSanitized]);
        const user = result.rows[0];

        // التأكد من التطابق التام مع القيمة الرقمية الموحدة في مشروعك وهي (1) للمشرف
        if (!user || parseInt(user.is_admin, 10) !== 1) {
            return res.status(403).json({ error: 'Access denied. Admin access required.' });
        }

        next();
    } catch (error) {
        console.error('Admin security check error:', error);
        res.status(500).json({ error: 'Internal server error during authorization check' });
    }
}

// التحقق من صلاحيات الاشتراكات المميزة (Premium)
export async function requirePremium(req, res, next) {
    if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const db = getDatabase();
        const userIdSanitized = parseInt(req.user.userId, 10);

        // فحص حالة الاشتراك النشط وتاريخ الصلاحية
        const subResult = await db.query(`
            SELECT * FROM subscriptions 
            WHERE user_id = $1 AND status = 'active' AND end_date > NOW()
        `, [userIdSanitized]);
        const subscription = subResult.rows[0];

        // جلب حالة المشرف (لأن المشرف يمتلك صلاحية الوصول لكل شيء تلقائياً)
        const userResult = await db.query('SELECT is_admin FROM users WHERE id = $1', [userIdSanitized]);
        const user = userResult.rows[0];

        if (!subscription && (!user || parseInt(user.is_admin, 10) !== 1)) {
            return res.status(403).json({ error: 'Premium subscription required to access this feature' });
        }

        next();
    } catch (error) {
        console.error('Premium security check error:', error);
        res.status(500).json({ error: 'Internal server error during subscription check' });
    }
}

// توليد التوكن
export function generateToken(userId, username, isAdmin = false) {
    return jwt.sign(
        { userId, username, isAdmin },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

// توليد توكن التحديث
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
