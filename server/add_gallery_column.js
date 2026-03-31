import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Meid3030@localhost:5432/resipebook'
};

const pool = new pg.Pool(config);

async function addGalleryColumn() {
    console.log('--- Adding gallery column to users table ---');
    try {
        // 1. Check if users table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.error('❌ Table "users" does not exist!');
            return;
        }

        // 2. Check if gallery column exists
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'gallery';
        `);

        if (columnCheck.rows.length > 0) {
            console.log('✅ Column "gallery" already exists.');
        } else {
            console.log('➕ Adding "gallery" column (JSONB) to "users" table...');
            await pool.query('ALTER TABLE users ADD COLUMN gallery JSONB DEFAULT \'[]\'::jsonb;');
            console.log('✅ Column "gallery" added successfully.');
        }

    } catch (err) {
        console.error('❌ Error adding gallery column:', err);
    } finally {
        await pool.end();
    }
}

addGalleryColumn();
