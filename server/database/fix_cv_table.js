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

async function fixCvTable() {
    const client = await pool.connect();
    try {
        console.log('Fixing cvs table...');

        // Add missing photo column
        await client.query(`ALTER TABLE cvs ADD COLUMN IF NOT EXISTS photo TEXT`);
        console.log('✅ Added photo column');

        // Add missing timestamp columns
        await client.query(`ALTER TABLE cvs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        await client.query(`ALTER TABLE cvs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        console.log('✅ Added timestamp columns');

        // Verify all columns
        const columns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'cvs' 
            ORDER BY ordinal_position
        `);
        console.log('\n=== Updated CVS Table Columns ===');
        columns.rows.forEach(col => console.log(`  ${col.column_name}: ${col.data_type}`));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

fixCvTable();
