
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL is not defined in .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addVisibilityColumn() {
    try {
        console.log('📡 Connecting to database...');
        const client = await pool.connect();
        try {
            console.log('🔄 Adding visibility column to recipes table...');

            await client.query(`
                ALTER TABLE recipes 
                ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';
            `);

            console.log('✅ visibility column added successfully');

        } finally {
            client.release();
        }
    } catch (err) {
        console.error('❌ Error adding column:', err);
    } finally {
        await pool.end();
    }
}

addVisibilityColumn();
