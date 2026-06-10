// Main Express Server for Chef Book
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// التحقق الإلزامي من وجود المفتاح السري قبل تشغيل السيرفر لضمان عدم الاختراق
if (!process.env.JWT_SECRET) {
    console.error('❌ FATAL ERROR: JWT_SECRET is not defined in environment variables.');
    process.exit(1);
}

// Import routes
import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import userRoutes from './routes/users.js';
import recipeRoutes from './routes/recipes.js';
import subscriptionRoutes from './routes/subscriptions.js';
import adminRoutes from './routes/admin.js';
import dailyMenuRoutes from './routes/dailyMenu.js';
import cvRoutes from './routes/cv.js';
import storeRoutes from './routes/store.js';
import walletRoutes from './routes/wallet.js';
import booksRoutes from './routes/books.js';

import { getDatabase } from './database/db.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ===== Database Migrations =====
async function runMigrations() {
    try {
        const db = getDatabase();
        
        // التأكد أولاً من وجود جدول المستخدمين لتجنب توقف السيرفر عند أول تشغيل
        const tableCheck = await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            console.log('ℹ️ Users table does not exist yet. Skipping migrations until tables are initialized.');
            return;
        }

        // Migration: Convert is_public from BOOLEAN to TEXT
        const colCheck = await db.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'is_public'
        `);
        
        if (colCheck.rows.length > 0 && colCheck.rows[0].data_type === 'boolean') {
            console.log('🔄 Migrating is_public from BOOLEAN to TEXT...');
            await db.query(`
                ALTER TABLE users 
                ALTER COLUMN is_public TYPE TEXT USING CASE WHEN is_public = true THEN 'all' WHEN is_public = false THEN 'private' ELSE 'all' END
            `);
            await db.query(`ALTER TABLE users ALTER COLUMN is_public SET DEFAULT 'all'`);
            console.log('✅ is_public column migrated to TEXT');
        }
        
        // Add allowed_viewers column
        const viewersCheck = await db.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'allowed_viewers'
        `);
        if (viewersCheck.rows.length === 0) {
            await db.query(`ALTER TABLE users ADD COLUMN allowed_viewers JSON DEFAULT '[]'`);
            console.log('✅ allowed_viewers column added');
        }

        // Add reset_method column
        const resetMethodCheck = await db.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'reset_method'
        `);
        if (resetMethodCheck.rows.length === 0) {
            await db.query(`ALTER TABLE users ADD COLUMN reset_method TEXT`);
            console.log('✅ reset_method column added');
        }

        // Add sharing columns to recipes
        const recipeTableCheck = await db.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'recipes');`);
        if (recipeTableCheck.rows[0].exists) {
            const fromIdCheck = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'shared_from_id'`);
            if (fromIdCheck.rows.length === 0) {
                await db.query(`ALTER TABLE recipes ADD COLUMN shared_from_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL`);
            }
        }

        // Fix reset_code_expiry type
        const expiryTypeCheck = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reset_code_expiry'`);
        if (expiryTypeCheck.rows.length > 0) {
            const typeCheck = await db.query(`SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reset_code_expiry'`);
            if (typeCheck.rows[0].data_type !== 'bigint') {
                await db.query(`ALTER TABLE users ALTER COLUMN reset_code_expiry TYPE BIGINT USING EXTRACT(EPOCH FROM reset_code_expiry)::BIGINT * 1000`);
                console.log('✅ reset_code_expiry column converted to BIGINT');
            }
        }

    } catch (err) {
        console.error('Migration error:', err.message);
    }
}

runMigrations();

// ===== Middleware =====
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' })); // تقليل الحد لتجنب هجمات الحرمان من الخدمة DOS
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many authentication attempts, please try again later.' }
});
app.use('/api/auth', authLimiter);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ===== Routes =====
app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/daily-menu', dailyMenuRoutes);
app.use('/api/cv', cvRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/books', booksRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Chef Book API is running', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

const server = app.listen(PORT, () => {
    console.log(`👨🍳 Server running on: http://localhost:${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Exiting...`);
        process.exit(1); // الخروج الآمن لمنع كراش اللوب والسماح لـ PM2 أو Docker بإعادة التشغيل
    }
});

export default app;
