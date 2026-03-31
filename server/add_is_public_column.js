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

async function addIsPublicColumn() {
    console.log('--- Adding is_public column to users table ---');
    try {
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'is_public';
        `);

        if (columnCheck.rows.length > 0) {
            console.log('✅ Column "is_public" already exists.');
        } else {
            console.log('➕ Adding "is_public" column (BOOLEAN) to "users" table...');
            await pool.query('ALTER TABLE users ADD COLUMN is_public BOOLEAN DEFAULT true;');
            console.log('✅ Column "is_public" added successfully.');
        }

    } catch (err) {
        console.error('❌ Error adding is_public column:', err);
    } finally {
        await pool.end();
    }
}

addIsPublicColumn();
