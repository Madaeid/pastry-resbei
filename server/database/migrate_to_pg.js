
import Database from 'better-sqlite3';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const sqlitePath = path.join(__dirname, 'pastry.db');
const pgConnectionString = process.env.DATABASE_URL;

if (!pgConnectionString) {
    console.error('❌ DATABASE_URL is not defined in .env');
    process.exit(1);
}

const pgPool = new Pool({
    connectionString: pgConnectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
    console.log('🚀 Starting migration from SQLite to PostgreSQL...');

    let sqliteDb;
    try {
        sqliteDb = new Database(sqlitePath, { readonly: true });
        console.log('✅ Connected to SQLite database');
    } catch (error) {
        console.error('❌ Failed to open SQLite database:', error.message);
        return;
    }

    const pgClient = await pgPool.connect();
    console.log('✅ Connected to PostgreSQL database');

    try {
        await pgClient.query('BEGIN');

        console.log('🧹 Clearing existing PostgreSQL data...');
        await pgClient.query('TRUNCATE table daily_menu_items, daily_menus, sessions, transactions, subscriptions, recipes, users RESTART IDENTITY CASCADE');

        // Migrate Users
        console.log('👤 Migrating Users...');
        const users = sqliteDb.prepare('SELECT * FROM users').all();
        console.log(`Found ${users.length} users`);

        for (const user of users) {
            await pgClient.query(`
               INSERT INTO users (id, username, display_name, email, phone, birthday, password_hash, is_admin, reset_code, reset_code_expiry, reset_method, google_id, apple_id, auth_provider, profile_picture, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           `, [
                user.id, user.username, user.display_name, user.email, user.phone, user.birthday,
                user.password_hash, user.is_admin, user.reset_code, user.reset_code_expiry,
                user.reset_method, user.google_id, user.apple_id, user.auth_provider,
                user.profile_picture || null,
                user.created_at, user.updated_at
            ]);
        }
        if (users.length > 0) {
            await pgClient.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
        }


        // Migrate Recipes
        console.log('🍳 Migrating Recipes...');
        const recipes = sqliteDb.prepare('SELECT * FROM recipes').all();
        console.log(`Found ${recipes.length} recipes`);

        for (const recipe of recipes) {
            await pgClient.query(`
                INSERT INTO recipes (id, user_id, name, category, prep_time, cook_time, servings, difficulty, ingredients, instructions, notes, photo, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, [
                recipe.id, recipe.user_id, recipe.name, recipe.category, recipe.prep_time, recipe.cook_time,
                recipe.servings, recipe.difficulty, recipe.ingredients, recipe.instructions,
                recipe.notes, recipe.photo, recipe.created_at, recipe.updated_at
            ]);
        }
        if (recipes.length > 0) {
            await pgClient.query(`SELECT setval('recipes_id_seq', (SELECT MAX(id) FROM recipes))`);
        }

        // Migrate Subscriptions
        console.log('💎 Migrating Subscriptions...');
        const subscriptions = sqliteDb.prepare('SELECT * FROM subscriptions').all();
        for (const sub of subscriptions) {
            await pgClient.query(`
                INSERT INTO subscriptions (id, user_id, plan, status, start_date, end_date, payment_last4, payment_brand, payment_expiry, auto_renew, granted_by_admin, stripe_session_id, stripe_customer_id, cancelled_at, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            `, [
                sub.id, sub.user_id, sub.plan, sub.status, sub.start_date, sub.end_date,
                sub.payment_last4, sub.payment_brand, sub.payment_expiry, sub.auto_renew,
                sub.granted_by_admin, sub.stripe_session_id, sub.stripe_customer_id,
                sub.cancelled_at, sub.created_at, sub.updated_at
            ]);
        }
        if (subscriptions.length > 0) {
            await pgClient.query(`SELECT setval('subscriptions_id_seq', (SELECT MAX(id) FROM subscriptions))`);
        }

        // Migrate Transactions
        console.log('💰 Migrating Transactions...');
        const transactions = sqliteDb.prepare('SELECT * FROM transactions').all();
        for (const tx of transactions) {
            await pgClient.query(`
                INSERT INTO transactions (id, user_id, transaction_id, type, plan, amount, status, payment_last4, payment_brand, stripe_session_id, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [
                tx.id, tx.user_id, tx.transaction_id, tx.type, tx.plan, tx.amount,
                tx.status, tx.payment_last4, tx.payment_brand, tx.stripe_session_id, tx.created_at
            ]);
        }
        if (transactions.length > 0) {
            await pgClient.query(`SELECT setval('transactions_id_seq', (SELECT MAX(id) FROM transactions))`);
        }

        // Migrate Sessions
        console.log('🔑 Migrating Sessions...');
        const sessions = sqliteDb.prepare('SELECT * FROM sessions').all();
        for (const session of sessions) {
            await pgClient.query(`
                INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
                VALUES ($1, $2, $3, $4, $5)
            `, [session.id, session.user_id, session.token_hash, session.expires_at, session.created_at]);
        }
        if (sessions.length > 0) {
            await pgClient.query(`SELECT setval('sessions_id_seq', (SELECT MAX(id) FROM sessions))`);
        }

        // Migrate Daily Menus
        console.log('📅 Migrating Daily Menus...');
        const dailyMenus = sqliteDb.prepare('SELECT * FROM daily_menus').all();
        for (const dm of dailyMenus) {
            await pgClient.query(`
                INSERT INTO daily_menus (id, user_id, menu_date, title, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [dm.id, dm.user_id, dm.menu_date, dm.title, dm.created_at, dm.updated_at]);
        }
        if (dailyMenus.length > 0) {
            await pgClient.query(`SELECT setval('daily_menus_id_seq', (SELECT MAX(id) FROM daily_menus))`);
        }

        // Migrate Daily Menu Items
        console.log('🍲 Migrating Daily Menu Items...');
        try {
            const dailyMenuItems = sqliteDb.prepare('SELECT * FROM daily_menu_items').all();
            for (const dmi of dailyMenuItems) {
                await pgClient.query(`
                    INSERT INTO daily_menu_items (id, menu_id, recipe_id, name, photo, ingredients, instructions, order_index, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [dmi.id, dmi.menu_id, dmi.recipe_id, dmi.name, dmi.photo, dmi.ingredients, dmi.instructions, dmi.order_index, dmi.created_at]);
            }
            if (dailyMenuItems.length > 0) {
                await pgClient.query(`SELECT setval('daily_menu_items_id_seq', (SELECT MAX(id) FROM daily_menu_items))`);
            }
        } catch (e) {
            console.log('Skipping daily_menu_items (table might not exist in SQLite)');
        }

        await pgClient.query('COMMIT');
        console.log('\n🎉 Migration completed successfully!');

    } catch (error) {
        await pgClient.query('ROLLBACK');
        console.error('\n❌ Migration failed:', error);
    } finally {
        sqliteDb.close();
        pgClient.release();
        await pgPool.end();
    }
}

migrate();
