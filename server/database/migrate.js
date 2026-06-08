import { getDatabase, closeDatabase } from './db.js';

export async function runMigrations() {
    const startTime = Date.now();
    let migrationCount = 0;

    try {
        const db = getDatabase();

        console.log('🔄 Running database migrations...');

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
                migrationCount++;
            }

            // Add allowed_viewers column if it doesn't exist
            const viewersCheck = await db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'allowed_viewers'
            `);

            if (viewersCheck.rows.length === 0) {
                await db.query(`ALTER TABLE users ADD COLUMN allowed_viewers JSON DEFAULT '[]'`);
                console.log('✅ allowed_viewers column added');
                migrationCount++;
            }

            // Add reset_method column if it doesn't exist
            const resetMethodCheck = await db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'reset_method'
            `);
            if (resetMethodCheck.rows.length === 0) {
                await db.query(`ALTER TABLE users ADD COLUMN reset_method TEXT`);
                console.log('✅ reset_method column added');
                migrationCount++;
            }
        } catch (migErr) {
            if (migErr.code === '42P01') {
                console.log('⚠️ Skipping users table migration: Table does not exist yet.');
            } else {
                console.error('❌ Critical migration error (users table structure):', migErr);
                throw migErr; // Re-throw to stop execution
            }
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
                migrationCount++;
            }

            // Check for shared_from_store_id
            const storeIdCheck = await db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'recipes' AND column_name = 'shared_from_store_id'
            `);
            if (storeIdCheck.rows.length === 0) {
                await db.query(`ALTER TABLE recipes ADD COLUMN shared_from_store_id INTEGER REFERENCES store_recipes(id) ON DELETE SET NULL`);
                console.log('✅ shared_from_store_id column added to recipes');
                migrationCount++;
            }

            // Check for shared_notes
            const notesCheck = await db.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'recipes' AND column_name = 'shared_notes'
            `);
            if (notesCheck.rows.length === 0) {
                await db.query(`ALTER TABLE recipes ADD COLUMN shared_notes TEXT`);
                console.log('✅ shared_notes column added to recipes');
                migrationCount++;
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
            if (migErr.code === '42P01') {
                console.log('⚠️ Skipping recipes table migration: Table does not exist yet.');
            } else {
                console.error('❌ Critical migration error (recipes table sharing columns):', migErr);
                throw migErr;
            }
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
                migrationCount++;
            }
        } catch (migErr) {
            if (migErr.code === '42P01') {
                console.log('⚠️ Skipping reset_code_expiry migration: users table does not exist yet.');
            } else {
                console.error('❌ Critical migration error (reset_code_expiry):', migErr);
                throw migErr;
            }
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
                migrationCount++;
            }
        } catch (migErr) {
            if (migErr.code === '42P01') {
                console.log('⚠️ Skipping password_hash migration: users table does not exist yet.');
            } else {
                console.error('❌ Critical migration error (password_hash):', migErr);
                throw migErr;
            }
        }

        const elapsed = Date.now() - startTime;
        if (migrationCount > 0) {
            console.log(`\n✨ ${migrationCount} migration(s) applied in ${elapsed}ms`);
        } else {
            console.log(`\n✅ Database is up to date (checked in ${elapsed}ms)`);
        }
    } catch (err) {
        console.error('❌ Migration error:', err.message);
        throw err;
    }
}

// ===== CLI Entry Point =====
// Run standalone with: node database/migrate.js
const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').replace(/^[a-zA-Z]:/, ''));

if (isDirectRun) {
    runMigrations()
        .then(() => {
            console.log('🏁 Migration complete. Closing database connection...');
            return closeDatabase();
        })
        .then(() => {
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Migration failed:', err.message);
            process.exit(1);
        });
}
