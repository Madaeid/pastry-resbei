// Main Express Server for Chef Book - Secured & Optimized
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import cvRoutes from './routes/cv.js'; 
import storeRoutes from './routes/store.js'; 
import walletRoutes from './routes/wallet.js'; 
import booksRoutes from './routes/books.js'; 
import scannerRoutes from './routes/scanner.js'; // AI Ingredient Scanner
import nutritionRoutes from './routes/nutrition.js'; // AI Nutritional Analysis

import { getDatabase } from './database/db.js';
import currencyUtils from './utils/currency.js';
import { runMigrations as originalRunMigrations } from './database/migrate.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ===== Database Migrations =====
async function runMigrations() {
    try {
        // Run original migrations first
        try {
            await originalRunMigrations();
        } catch (err) {
            console.log('Original migration note:', err.message);
        }

        const db = getDatabase();
        
        // Migration: Convert is_public from BOOLEAN to TEXT and add allowed_viewers
        try {
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
            
            const viewersCheck = await db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'allowed_viewers'
            `);
            
            if (viewersCheck.rows.length === 0) {
                await db.query(`ALTER TABLE users ADD COLUMN allowed_viewers JSON DEFAULT '[]'`);
                console.log('✅ allowed_viewers column added');
            }

            const resetMethodCheck = await db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'reset_method'
            `);
            if (resetMethodCheck.rows.length === 0) {
                await db.query(`ALTER TABLE users ADD COLUMN reset_method TEXT`);
                console.log('✅ reset_method column added');
            }
        } catch (migErr) {
            console.log('Migration note:', migErr.message);
        }

        // Migration: Add sharing columns to recipes
        try {
            const fromIdCheck = await db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'recipes' AND column_name = 'shared_from_id'
            `);
            if (fromIdCheck.rows.length === 0) {
                await db.query(`ALTER TABLE recipes ADD COLUMN shared_from_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL`);
                console.log('✅ shared_from_id column added to recipes');
            }

            const storeIdCheck = await db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'recipes' AND column_name = 'shared_from_store_id'
            `);
            if (storeIdCheck.rows.length === 0) {
                await db.query(`ALTER TABLE recipes ADD COLUMN shared_from_store_id INTEGER REFERENCES store_recipes(id) ON DELETE SET NULL`);
                console.log('✅ shared_from_store_id column added to recipes');
            }

            const notesCheck = await db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'recipes' AND column_name = 'shared_notes'
            `);
            if (notesCheck.rows.length === 0) {
                await db.query(`ALTER TABLE recipes ADD COLUMN shared_notes TEXT`);
                console.log('✅ shared_notes column added to recipes');
            }
            
            await db.query(`
                CREATE TABLE IF NOT EXISTS recipe_shares (
                    id SERIAL PRIMARY KEY,
                    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            `);
        } catch (migErr) {
            console.log('Migration note (sharing columns):', migErr.message);
        }

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
        throw err; // تمرير الخطأ لمنع تشغيل الخادم في حال فشل قاعدة البيانات الحرجة
    }
}

// ===== Middleware =====

// Security Headers
app.use(helmet());

// CORS Configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// حماية الذاكرة: تحديد حجم معقول لطلبات الـ JSON لمنع هجمات حجب الخدمة DoS
// We use the 'verify' function to preserve the raw request body as a Buffer. 
// This is strictly required by Stripe to verify Webhook signatures!
app.use(express.json({ 
    limit: '2mb', // الحجم الافتراضي الآمن للنصوص والبيانات العادية
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
})); 
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// في حال وجود مسار مخصص لرفع الفيديوهات أو الصور الكبيرة بصيغة base64، يتم استثناؤه بشكل منفرد مثل:
// app.use('/api/recipes/upload-heavy', express.json({ limit: '50mb' }));

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, 
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Financial rate limiter (stricter for wallet and payments)
const financialLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 requests per windowMs for financial operations
    message: { error: 'Too many financial operations, please try again later.' }
});

// Apply stricter limiters first so they take precedence over the general limiter
app.use('/api/auth', authLimiter);
app.use('/api/wallet', financialLimiter);
app.use('/api/subscriptions', financialLimiter);

// Rate limiting العام لحماية الموارد
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 1000, 
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
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
app.use('/api/scanner', scannerRoutes); // AI Ingredient Scanner
app.use('/api/nutrition', nutritionRoutes); // AI Nutritional Analysis

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

app.use((err, req, res, next) => {
    // وضع قيمة افتراضية صارمة: البيئة هي الإنتاج ما لم يتم تحديد التطوير صراحة
    const env = process.env.NODE_ENV || 'production';
    const isDev = env === 'development';

    // طباعة الخطأ في سجلات الخادم دائماً
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    
    if (isDev) {
        console.error(err.stack);
    }

    // إخفاء التفاصيل الحساسة للمستخدم النهائي إلا في بيئة التطوير
    res.status(err.status || 500).json({
        error: isDev
            ? err.message
            : 'Internal server error'
    });
});

// ===== تشغيل الترحيل أولاً ثم بدء الخادم لضمان سلامة البيانات =====
async function startServer() {
    try {
        await runMigrations(); // الانتظار حتى تكتمل التحديثات الهيكلية لقاعدة البيانات
        
        // Initialize exchange rate fetching scheduler
        currencyUtils.initCurrencyScheduler();
        
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

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use. Retrying in 2 seconds...`);
                setTimeout(() => {
                    // إغلاق الخادم فقط إذا كان يعمل بالفعل لتجنب خطأ ERR_SERVER_NOT_RUNNING
                    if (server.listening) {
                        server.close();
                    }
                    server.listen(PORT);
                }, 2000);
            } else {
                console.error('Server error:', err);
            }
        });
    } catch (error) {
        console.error('Failed to start server due to migration error:', error.message);
        process.exit(1);
    }
}

startServer();

export default app;
