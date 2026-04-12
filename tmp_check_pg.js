
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function check() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('users', 'cvs')
            ORDER BY table_name, ordinal_position
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } finally {
        client.release();
        await pool.end();
    }
}
check();
