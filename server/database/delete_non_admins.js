
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

async function deleteNonAdmins() {
    console.log('🚀 Starting deletion of non-admin users...');
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Find non-admin users first to log them
            const res = await client.query('SELECT username FROM users WHERE is_admin != true AND username != \'admin\'');
            const usernames = res.rows.map(r => r.username);
            
            if (usernames.length === 0) {
                console.log('ℹ️ No non-admin users found to delete.');
            } else {
                console.log(`🗑️ Deleting ${usernames.length} users: ${usernames.join(', ')}`);
                
                // Delete from users. Cascade should handle other tables.
                const deleteRes = await client.query('DELETE FROM users WHERE is_admin != true AND username != \'admin\'');
                console.log(`✅ Deleted ${deleteRes.rowCount} users successfully.`);
            }

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('❌ Error deleting users:', err.message);
    } finally {
        await pool.end();
        process.exit();
    }
}

deleteNonAdmins();
