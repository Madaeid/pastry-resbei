// Test PostgreSQL connection
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testConnection() {
    console.log('Testing PostgreSQL connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

    // Try connecting to the postgres database first
    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'Meid3030',
        database: 'postgres'
    });

    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL successfully!');

        // Check if resipebook database exists
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = 'resipebook'`);
        if (res.rowCount === 0) {
            console.log('📦 Creating resipebook database...');
            await client.query('CREATE DATABASE resipebook');
            console.log('✅ Database resipebook created!');
        } else {
            console.log('✅ Database resipebook already exists');
        }

        await client.end();

        // Now connect to resipebook and create tables
        console.log('\n📋 Creating tables in resipebook...');
        const resipeClient = new Client({
            host: 'localhost',
            port: 5432,
            user: 'postgres',
            password: 'Meid3030',
            database: 'resipebook'
        });

        await resipeClient.connect();

        // Create all tables
        await resipeClient.query(`
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

        await resipeClient.query(`
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

        await resipeClient.query(`
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

        await resipeClient.query(`
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

        await resipeClient.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Sessions table created');

        await resipeClient.query(`
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

        await resipeClient.query(`
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

        await resipeClient.query(`
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
        console.log('✅ Recipebook table created');

        // Create indexes
        await resipeClient.query(`
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

        // List all tables
        const result = await resipeClient.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        console.log('\n📋 All tables in resipebook database:');
        result.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name}`);
        });

        await resipeClient.end();
        console.log('\n🎉 Database setup complete!');

    } catch (err) {
        console.error('❌ Connection error:', err.message);
        if (err.code === '28P01') {
            console.error('\n⚠️  Password authentication failed!');
            console.error('Please run this in pgAdmin Query Tool:');
            console.error("   ALTER USER postgres WITH PASSWORD 'admin123';");
        }
    }
}

testConnection();
