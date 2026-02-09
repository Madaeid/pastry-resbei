
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL is not defined in .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
    try {
        console.log('🗄️  Initializing Pastry Recipe Book Database (PostgreSQL)...\n');

        const client = await pool.connect();

        try {
            // ===== Create Tables =====

            // Users Table
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    display_name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    phone TEXT,
                    birthday TEXT,
                    password_hash TEXT,
                    is_admin INTEGER DEFAULT 0,
                    reset_code TEXT,
                    reset_code_expiry BIGINT,
                    reset_method TEXT,
                    google_id TEXT UNIQUE,
                    apple_id TEXT UNIQUE,
                    auth_provider TEXT DEFAULT 'local',
                    profile_picture TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Users table created');

            // Recipes Table
            await client.query(`
                CREATE TABLE IF NOT EXISTS recipes (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    prep_time INTEGER NOT NULL,
                    cook_time INTEGER NOT NULL,
                    servings INTEGER NOT NULL,
                    difficulty TEXT NOT NULL,
                    ingredients TEXT NOT NULL,
                    instructions TEXT NOT NULL,
                    notes TEXT,
                    photo TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Recipes table created');

            // Subscriptions Table
            await client.query(`
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    plan TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'active',
                    start_date TEXT NOT NULL,
                    end_date TEXT NOT NULL,
                    payment_last4 TEXT,
                    payment_brand TEXT,
                    payment_expiry TEXT,
                    auto_renew INTEGER DEFAULT 1,
                    granted_by_admin INTEGER DEFAULT 0,
                    stripe_session_id TEXT,
                    stripe_customer_id TEXT,
                    cancelled_at TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Subscriptions table created');

            // Transactions Table
            await client.query(`
                CREATE TABLE IF NOT EXISTS transactions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    transaction_id TEXT UNIQUE NOT NULL,
                    type TEXT NOT NULL,
                    plan TEXT,
                    amount REAL NOT NULL,
                    status TEXT NOT NULL,
                    payment_last4 TEXT,
                    payment_brand TEXT,
                    stripe_session_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Transactions table created');

            // Sessions Table
            await client.query(`
                CREATE TABLE IF NOT EXISTS sessions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token_hash TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Sessions table created');

            // Daily Menus Table
            await client.query(`
                CREATE TABLE IF NOT EXISTS daily_menus (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    menu_date TEXT NOT NULL,
                    title TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, menu_date)
                );
            `);
            console.log('✅ Daily menus table created');

            // Daily Menu Items Table
            await client.query(`
                CREATE TABLE IF NOT EXISTS daily_menu_items (
                    id SERIAL PRIMARY KEY,
                    menu_id INTEGER NOT NULL REFERENCES daily_menus(id) ON DELETE CASCADE,
                    recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
                    name TEXT NOT NULL,
                    photo TEXT,
                    ingredients TEXT,
                    instructions TEXT,
                    order_index INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Daily menu items table created');

            // Recipe Book Table (User registration data)
            await client.query(`
                CREATE TABLE IF NOT EXISTS recipebook (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    username TEXT NOT NULL,
                    email TEXT NOT NULL,
                    phone TEXT,
                    full_name TEXT,
                    address TEXT,
                    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    subscription_type TEXT DEFAULT 'free',
                    is_active INTEGER DEFAULT 1,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Recipe book table created');

            // ===== Create Indexes =====
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
                CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
                CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
                CREATE INDEX IF NOT EXISTS idx_daily_menus_user_id ON daily_menus(user_id);
                CREATE INDEX IF NOT EXISTS idx_daily_menus_date ON daily_menus(menu_date);
                CREATE INDEX IF NOT EXISTS idx_daily_menu_items_menu_id ON daily_menu_items(menu_id);
                CREATE INDEX IF NOT EXISTS idx_recipebook_user_id ON recipebook(user_id);
            `);
            console.log('✅ Indexes created');

            // ===== Create Default Admin User =====
            /*
             Note: We can't use bcrypt here easily without importing it effectively, 
             but typically the admin creation is done conditionally.
             For now, let's skip admin creation in this script or we can add it if needed.
             The original script did it.
            */

        } finally {
            client.release();
        }

        console.log('\n🎉 Database initialization complete!');

    } catch (err) {
        console.error('Error initializing database:', err);
    } finally {
        await pool.end();
    }
}

initDB();
