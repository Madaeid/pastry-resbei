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

// Import routes
import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import userRoutes from './routes/users.js';
import recipeRoutes from './routes/recipes.js';
import subscriptionRoutes from './routes/subscriptions.js';
import adminRoutes from './routes/admin.js';
import dailyMenuRoutes from './routes/dailyMenu.js';
import cvRoutes from './routes/cv.js'; // CV routes
import storeRoutes from './routes/store.js'; // Store marketplace routes
import walletRoutes from './routes/wallet.js'; // Wallet & transfers
import booksRoutes from './routes/books.js'; // Chef Book portfolio

import { getDatabase } from './database/db.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ===== Database Migrations =====
async function runMigrations() {
    try {
        const db = getDatabase();
        
        // Migration: Convert is_public from BOOLEAN to TEXT and add allowed_viewers
        try {
            // Check if is_public is still boolean type
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
            
            // Add allowed_viewers column if it doesn't exist
            const viewersCheck = await db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'allowed_viewers'
            `);
            
            if (viewersCheck.rows.length === 0) {
                await db.query(`ALTER TABLE users ADD COLUMN allowed_viewers JSON DEFAULT '[]'`);
                console.log('✅ allowed_viewers column added');
            }

            // Add reset_method column if it doesn't exist
            const resetMethodCheck = await db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'reset_method'
            `);
            if (resetMethodCheck.rows.length === 0) {
                await db.query(`ALTER TABLE users ADD COLUMN reset_method TEXT`);
                console.log('✅ reset_method column added');
            }
        } catch (migErr) {
            // Migration may fail if already done or table doesn't exist yet
            console.log('Migration note:', migErr.message);
        }

        // Migration: Add shared_from_store_id column to recipes
        try {
            const storeIdCheck = await db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'recipes' AND column_name = 'shared_from_store_id'
            `);
            if (storeIdCheck.rows.length === 0) {
                await db.query(`ALTER TABLE recipes ADD COLUMN shared_from_store_id INTEGER REFERENCES store_recipes(id) ON DELETE SET NULL`);
                console.log('✅ shared_from_store_id column added to recipes');
            }
        } catch (migErr) {
            console.log('Migration note (shared_from_store_id):', migErr.message);
        }

        // Migration: Fix reset_code_expiry type from TIMESTAMP to BIGINT (stores epoch ms)
        try {
            const expiryTypeCheck = await db.query(`
                SELECT data_type FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'reset_code_expiry'
            `);
            if (expiryTypeCheck.rows.length > 0 && expiryTypeCheck.rows[0].data_type !== 'bigint') {
                await db.query(`ALTER TABLE users ALTER COLUMN reset_code_expiry TYPE BIGINT USING EXTRACT(EPOCH FROM reset_code_expiry)::BIGINT * 1000`);
                console.log('✅ reset_code_expiry column converted to BIGINT');
            }
        } catch (migErr) {
            console.log('Migration note (reset_code_expiry):', migErr.message);
        }

        // Migration: Make password_hash nullable for OAuth users
        try {
            const passNullCheck = await db.query(`
                SELECT is_nullable FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'password_hash'
            `);
            if (passNullCheck.rows.length > 0 && passNullCheck.rows[0].is_nullable === 'NO') {
                await db.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
                console.log('✅ password_hash made nullable for OAuth users');
            }
        } catch (migErr) {
            console.log('Migration note (password_hash):', migErr.message);
        }
    } catch (err) {
        console.error('Migration error:', err.message);
    }
}

// Run migrations on startup
runMigrations();

// ===== Middleware =====

// CORS Configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json({ limit: '10mb' })); // Allow large base64 images
app.use(express.urlencoded({ extended: true }));

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 auth requests per windowMs
    message: { error: 'Too many authentication attempts, please try again later.' }
});

// Apply authLimiter first so it takes precedence over the general limiter
app.use('/api/auth', authLimiter);

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ===== Routes =====
app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes); // OAuth routes (Google, Apple)
app.use('/api/users', userRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/daily-menu', dailyMenuRoutes);
app.use('/api/cv', cvRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/books', booksRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Chef Book API is running',
        timestamp: new Date().toISOString()
    });
});

// ===== Error Handling =====

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    console.error(err.stack);

    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'development'
            ? err.message
            : 'Internal server error'
    });
});

// ===== Start Server =====
const server = app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║          👨‍🍳 Chef Book API Server 👨‍🍳                    ║
╠════════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                  ║
║  Environment: ${process.env.NODE_ENV || 'development'}                           ║
║  Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}           ║
╚════════════════════════════════════════════════════════════╝
    `);
});

// Handle server errors (like EADDRINUSE)
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Retrying in 2 seconds...`);
        setTimeout(() => {
            server.close();
            server.listen(PORT);
        }, 2000);
    } else {
        console.error('Server error:', err);
    }
});

export default app;
