
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function deleteNonAdmins() {
    let log = '🚀 Starting deletion of non-admin users...\n';
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const res = await client.query('SELECT username FROM users WHERE is_admin != 1 AND username != \'admin\'');
            const usernames = res.rows.map(r => r.username);
            
            if (usernames.length === 0) {
                log += 'ℹ️ No non-admin users found to delete.\n';
            } else {
                log += `🗑️ Deleting ${usernames.length} users: ${usernames.join(', ')}\n`;
                const deleteRes = await client.query('DELETE FROM users WHERE is_admin != 1 AND username != \'admin\'');
                log += `✅ Deleted ${deleteRes.rowCount} users successfully.\n`;
            }

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            log += `❌ Error: ${e.message}\n`;
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        log += `❌ Connection Error: ${err.message}\n`;
    } finally {
        fs.writeFileSync(path.join(__dirname, '..', '..', 'delete_result.txt'), log);
        await pool.end();
        process.exit();
    }
}

deleteNonAdmins();
