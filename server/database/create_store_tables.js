// Migration: Create Store Tables for Recipe Marketplace
import { getDatabase } from './db.js';

async function createStoreTables() {
    const db = getDatabase();

    try {
        console.log('Creating store tables...');

        // Store Recipes - recipes listed for sale
        await db.query(`
            CREATE TABLE IF NOT EXISTS store_recipes (
                id SERIAL PRIMARY KEY,
                seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                category VARCHAR(100) DEFAULT 'Other',
                difficulty VARCHAR(50) DEFAULT 'Medium',
                prep_time INTEGER DEFAULT 0,
                cook_time INTEGER DEFAULT 0,
                photo TEXT,
                video TEXT,
                ingredients TEXT,
                instructions TEXT,
                notes TEXT,
                price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ store_recipes table created');

        // Store Purchases - tracks who bought what
        await db.query(`
            CREATE TABLE IF NOT EXISTS store_purchases (
                id SERIAL PRIMARY KEY,
                buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                store_recipe_id INTEGER NOT NULL REFERENCES store_recipes(id) ON DELETE CASCADE,
                price_paid DECIMAL(10,2) NOT NULL,
                purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(buyer_id, store_recipe_id)
            )
        `);
        console.log('✅ store_purchases table created');

        // Index for faster lookups
        await db.query(`CREATE INDEX IF NOT EXISTS idx_store_recipes_seller ON store_recipes(seller_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_store_purchases_buyer ON store_purchases(buyer_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_store_purchases_recipe ON store_purchases(store_recipe_id)`);

        console.log('✅ All store indexes created');
        console.log('🎉 Store tables migration complete!');

    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        process.exit(0);
    }
}

createStoreTables();
