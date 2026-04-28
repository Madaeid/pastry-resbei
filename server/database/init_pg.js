import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function initDB() {
    console.log('🚀 Initializing PostgreSQL Database...');

    try {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Users Table
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    display_name TEXT,
                    email TEXT UNIQUE NOT NULL,
                    phone TEXT,
                    birthday TEXT,
                    password_hash TEXT,
                    is_admin INTEGER DEFAULT 0,
                    is_public TEXT DEFAULT 'all',
                    allowed_viewers JSON DEFAULT '[]',
                    profile_picture TEXT,
                    gallery JSON DEFAULT '[]',
                    cv_file TEXT,
                    google_id TEXT UNIQUE,
                    apple_id TEXT UNIQUE,
                    auth_provider TEXT DEFAULT 'local',
                    reset_code TEXT,
                    reset_code_expiry BIGINT,
                    reset_method TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Users table created');

            // 2. Store/Marketplace Tables (must be created before recipes due to FK dependency)
            await client.query(`
                CREATE TABLE IF NOT EXISTS store_recipes (
                    id SERIAL PRIMARY KEY,
                    seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    description TEXT,
                    category TEXT,
                    difficulty TEXT,
                    prep_time INTEGER DEFAULT 0,
                    cook_time INTEGER DEFAULT 0,
                    photo TEXT,
                    video TEXT,
                    ingredients TEXT,
                    instructions TEXT,
                    notes TEXT,
                    price DECIMAL(10,2) NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS store_purchases (
                    id SERIAL PRIMARY KEY,
                    buyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    store_recipe_id INTEGER REFERENCES store_recipes(id) ON DELETE CASCADE,
                    price_paid DECIMAL(10,2) NOT NULL,
                    stripe_session_id TEXT,
                    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Store tables created');

            // 3. Recipes Table (after store_recipes due to shared_from_store_id FK)
            await client.query(`
                CREATE TABLE IF NOT EXISTS recipes (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    prep_time INTEGER NOT NULL DEFAULT 0,
                    cook_time INTEGER NOT NULL DEFAULT 0,
                    servings INTEGER NOT NULL DEFAULT 1,
                    difficulty TEXT NOT NULL DEFAULT 'medium',
                    ingredients TEXT NOT NULL,
                    instructions TEXT NOT NULL,
                    notes TEXT,
                    photo TEXT,
                    video TEXT,
                    visibility TEXT DEFAULT 'private',
                    shared_from_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
                    shared_from_store_id INTEGER REFERENCES store_recipes(id) ON DELETE SET NULL,
                    shared_notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Recipes table created');

            // 4. CVs Table
            await client.query(`
                CREATE TABLE IF NOT EXISTS cvs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    full_name TEXT NOT NULL,
                    dob TEXT,
                    phone TEXT,
                    email TEXT,
                    address TEXT,
                    skills TEXT,
                    summary TEXT,
                    languages TEXT,
                    education TEXT,
                    experience TEXT,
                    certifications TEXT,
                    photo TEXT,
                    cv_file_name TEXT,
                    cv_file_data TEXT,
                    cv_file_type TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ CVs table created');

            // 5. Social Features Tables
            await client.query(`
                CREATE TABLE IF NOT EXISTS recipe_likes (
                    id SERIAL PRIMARY KEY,
                    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(recipe_id, user_id)
                );

                CREATE TABLE IF NOT EXISTS recipe_comments (
                    id SERIAL PRIMARY KEY,
                    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    comment_text TEXT NOT NULL,
                    parent_id INTEGER REFERENCES recipe_comments(id) ON DELETE CASCADE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS comment_likes (
                    id SERIAL PRIMARY KEY,
                    comment_id INTEGER REFERENCES recipe_comments(id) ON DELETE CASCADE,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(comment_id, user_id)
                );

                CREATE TABLE IF NOT EXISTS recipe_shares (
                    id SERIAL PRIMARY KEY,
                    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS follows (
                    id SERIAL PRIMARY KEY,
                    follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(follower_id, following_id)
                );
            `);
            console.log('✅ Social tables created (Likes, Comments, Shares, Follows)');

            // 6. Subscriptions & Transactions
            await client.query(`
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    plan TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'active',
                    start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    end_date TIMESTAMP NOT NULL,
                    payment_last4 TEXT,
                    payment_brand TEXT,
                    payment_expiry TEXT,
                    auto_renew BOOLEAN DEFAULT TRUE,
                    granted_by_admin BOOLEAN DEFAULT FALSE,
                    stripe_session_id TEXT,
                    stripe_customer_id TEXT,
                    cancelled_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS transactions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    transaction_id TEXT UNIQUE NOT NULL,
                    type TEXT NOT NULL,
                    plan TEXT,
                    amount DECIMAL(10,2) NOT NULL,
                    status TEXT NOT NULL,
                    payment_last4 TEXT,
                    payment_brand TEXT,
                    stripe_session_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Subscriptions and Transactions tables created');

            // 7. Planner Tables
            await client.query(`
                CREATE TABLE IF NOT EXISTS daily_menus (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    menu_date TEXT NOT NULL,
                    title TEXT,
                    notes TEXT,
                    is_completed BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, menu_date)
                );

                CREATE TABLE IF NOT EXISTS daily_menu_items (
                    id SERIAL PRIMARY KEY,
                    menu_id INTEGER NOT NULL REFERENCES daily_menus(id) ON DELETE CASCADE,
                    recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
                    item_type TEXT DEFAULT 'recipe',
                    name TEXT,
                    photo TEXT,
                    ingredients TEXT,
                    instructions TEXT,
                    is_completed BOOLEAN DEFAULT false,
                    order_index INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Planner tables created (Daily Menus)');

            // 8. Auth Sessions
            await client.query(`
                CREATE TABLE IF NOT EXISTS sessions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token_hash TEXT NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Sessions table created');

            // 9. Legacy / Mapping Tables (Optional keep for compatibility)
            await client.query(`
                CREATE TABLE IF NOT EXISTS recipebook (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    username TEXT NOT NULL,
                    email TEXT NOT NULL,
                    full_name TEXT,
                    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    subscription_type TEXT DEFAULT 'free',
                    is_active INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Legacy compatibility tables created');

            // 10. Books & Book Recipes Tables
            await client.query(`
                CREATE TABLE IF NOT EXISTS books (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    title TEXT NOT NULL DEFAULT 'My Chef Book',
                    description TEXT,
                    cover_photo TEXT,
                    theme TEXT DEFAULT 'classic',
                    price DECIMAL(10,2) DEFAULT 0,
                    is_public BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS book_recipes (
                    id SERIAL PRIMARY KEY,
                    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
                    order_index INTEGER DEFAULT 0,
                    section_title TEXT,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(book_id, recipe_id)
                );
            `);
            console.log('✅ Books tables created');

            // 10b. Book Purchases Table
            await client.query(`
                CREATE TABLE IF NOT EXISTS book_purchases (
                    id SERIAL PRIMARY KEY,
                    buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                    price_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
                    stripe_session_id TEXT,
                    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(buyer_id, book_id)
                );
            `);
            console.log('✅ Book purchases table created');

            // 11. Create Indexes
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
                CREATE INDEX IF NOT EXISTS idx_recipes_visibility ON recipes(visibility);
                CREATE INDEX IF NOT EXISTS idx_recipes_created_at_desc ON recipes(created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
                CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
                CREATE INDEX IF NOT EXISTS idx_daily_menus_user_date ON daily_menus(user_id, menu_date);
                CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
                CREATE INDEX IF NOT EXISTS idx_book_recipes_book_id ON book_recipes(book_id);
            `);
            console.log('✅ Performance indexes created');

            await client.query('COMMIT');
            console.log('\n✨ Database initialization complete!');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error('❌ Error initializing database:', err.message);
    } finally {
        await pool.end();
        process.exit();
    }
}

initDB();
