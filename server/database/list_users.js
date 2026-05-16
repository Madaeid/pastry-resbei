
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

async function listUsers() {
    try {
        const res = await pool.query('SELECT id, username, email, is_admin FROM users');
        console.log('Current Users:');
        console.table(res.rows);
    } catch (err) {
        console.error('Error listing users:', err);
    } finally {
        await pool.end();
    }
}

listUsers();
