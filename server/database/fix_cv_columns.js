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

async function fixCvColumns() {
    const client = await pool.connect();
    try {
        console.log('🔧 Adding missing columns to cvs table...');

        // Add all missing columns that the CV route expects
        const columnsToAdd = [
            { name: 'summary', type: 'TEXT' },
            { name: 'languages', type: 'TEXT' },
            { name: 'education', type: 'TEXT' },
            { name: 'experience', type: 'TEXT' },
            { name: 'certifications', type: 'TEXT' }
        ];

        for (const col of columnsToAdd) {
            try {
                await client.query(`ALTER TABLE cvs ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
                console.log(`✅ Added/verified column: ${col.name}`);
            } catch (err) {
                console.log(`Column ${col.name} may already exist:`, err.message);
            }
        }

        // Verify all columns
        const columns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'cvs' 
            ORDER BY ordinal_position
        `);
        console.log('\n=== CVS Table Columns ===');
        columns.rows.forEach(col => console.log(`  ${col.column_name}: ${col.data_type}`));
        console.log('\n✅ CV table fix complete!');

    } catch (err) {
        console.error('Error fixing CV table:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

fixCvColumns();
