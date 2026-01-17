// Database Initialization Script
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dbPath = process.env.DATABASE_PATH || './pastry.db';
const db = new Database(path.join(__dirname, '..', dbPath.replace('./', '')));

console.log('🗄️  Initializing Pastry Recipe Book Database...\n');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// ===== Create Tables =====

// Users Table
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL COLLATE NOCASE,
        display_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL COLLATE NOCASE,
        phone TEXT,
        birthday TEXT,
        password_hash TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        reset_code TEXT,
        reset_code_expiry INTEGER,
        reset_method TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);
console.log('✅ Users table created');

// Recipes Table
db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`);
console.log('✅ Recipes table created');

// Subscriptions Table
db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`);
console.log('✅ Subscriptions table created');

// Transactions Table
db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        transaction_id TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        plan TEXT,
        amount REAL NOT NULL,
        status TEXT NOT NULL,
        payment_last4 TEXT,
        payment_brand TEXT,
        stripe_session_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`);
console.log('✅ Transactions table created');

// Sessions Table (for JWT blacklist/refresh tokens)
db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`);
console.log('✅ Sessions table created');

// Daily Menus Table (Premium Feature)
db.exec(`
    CREATE TABLE IF NOT EXISTS daily_menus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        menu_date TEXT NOT NULL,
        title TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, menu_date)
    )
`);
console.log('✅ Daily menus table created');

// Daily Menu Items Table
db.exec(`
    CREATE TABLE IF NOT EXISTS daily_menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_id INTEGER NOT NULL,
        recipe_id INTEGER,
        name TEXT NOT NULL,
        photo TEXT,
        ingredients TEXT,
        instructions TEXT,
        order_index INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (menu_id) REFERENCES daily_menus(id) ON DELETE CASCADE,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
    )
`);
console.log('✅ Daily menu items table created');

// ===== Create Indexes =====
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_daily_menus_user_id ON daily_menus(user_id);
    CREATE INDEX IF NOT EXISTS idx_daily_menus_date ON daily_menus(menu_date);
    CREATE INDEX IF NOT EXISTS idx_daily_menu_items_menu_id ON daily_menu_items(menu_id);
`);
console.log('✅ Indexes created');

// ===== Create Default Admin User =====
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
const adminEmail = process.env.ADMIN_EMAIL || 'admin@pastry.com';

const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);

if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync(adminPassword, 10);

    db.prepare(`
        INSERT INTO users (username, display_name, email, password_hash, is_admin)
        VALUES (?, ?, ?, ?, 1)
    `).run(adminUsername, 'Admin', adminEmail, passwordHash);

    console.log(`\n👤 Default admin account created:`);
    console.log(`   Username: ${adminUsername}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Email: ${adminEmail}`);
} else {
    console.log('\n👤 Admin account already exists');
}

// Close database connection
db.close();

console.log('\n🎉 Database initialization complete!');
console.log(`📁 Database file: ${path.join(__dirname, '..', dbPath.replace('./', ''))}`);
