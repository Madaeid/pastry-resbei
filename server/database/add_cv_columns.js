import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addCvColumns() {
    const client = await pool.connect();
    try {
        console.log('Adding new columns to cvs table...');
        await client.query(`
            ALTER TABLE cvs 
            ADD COLUMN IF NOT EXISTS summary TEXT,
            ADD COLUMN IF NOT EXISTS languages TEXT,
            ADD COLUMN IF NOT EXISTS education TEXT,
            ADD COLUMN IF NOT EXISTS experience TEXT,
            ADD COLUMN IF NOT EXISTS certifications TEXT
        `);
        console.log('✅ New CV columns added successfully (summary, languages, education, experience, certifications)');
    } catch (err) {
        console.error('Error adding columns:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

addCvColumns();
