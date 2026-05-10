import { getDatabase } from './db.js';

export async function runMigrations() {
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

        // Migration: Add sharing columns to recipes
        try {
            // Check for shared_from_id
            const fromIdCheck = await db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'recipes' AND column_name = 'shared_from_id'
            `);
            if (fromIdCheck.rows.length === 0) {
                await db.query(`ALTER TABLE recipes ADD COLUMN shared_from_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL`);
                console.log('✅ shared_from_id column added to recipes');
            }

            // Check for shared_from_store_id
            const storeIdCheck = await db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'recipes' AND column_name = 'shared_from_store_id'
            `);
            if (storeIdCheck.rows.length === 0) {
                await db.query(`ALTER TABLE recipes ADD COLUMN shared_from_store_id INTEGER REFERENCES store_recipes(id) ON DELETE SET NULL`);
                console.log('✅ shared_from_store_id column added to recipes');
            }

            // Check for shared_notes
            const notesCheck = await db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'recipes' AND column_name = 'shared_notes'
            `);
            if (notesCheck.rows.length === 0) {
                await db.query(`ALTER TABLE recipes ADD COLUMN shared_notes TEXT`);
                console.log('✅ shared_notes column added to recipes');
            }

            // Ensure recipe_shares table exists
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
