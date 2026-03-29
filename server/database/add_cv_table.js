
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addCvTable() {
    try {
        console.log('📄 Adding CV table to database...');

        const client = await pool.connect();
        try {
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
                    photo TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Cv table created');

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_cvs_user_id ON cvs(user_id);
            `);
            console.log('✅ Cv indexes created');

        } finally {
            client.release();
        }

    } catch (err) {
        console.error('Error adding CV table:', err);
    } finally {
        await pool.end();
    }
}

addCvTable();
