import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkCVs() {
    const client = await pool.connect();
    try {
        // Check table structure
        const columns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'cvs' 
            ORDER BY ordinal_position
        `);
        console.log('=== CVS Table Columns ===');
        columns.rows.forEach(col => console.log(`  ${col.column_name}: ${col.data_type}`));

        // Check CV data
        const cvs = await client.query('SELECT id, user_id, full_name, email, summary, languages, education, experience, certifications FROM cvs');
        console.log('\n=== CV Records ===');
        console.log(`Total records: ${cvs.rows.length}`);
        cvs.rows.forEach(cv => {
            console.log(`  ID: ${cv.id}, User: ${cv.user_id}, Name: ${cv.full_name}, Email: ${cv.email}`);
            console.log(`    Summary: ${cv.summary ? cv.summary.substring(0, 50) + '...' : 'null'}`);
            console.log(`    Languages: ${cv.languages}`);
            console.log(`    Education: ${cv.education}`);
            console.log(`    Experience: ${cv.experience}`);
            console.log(`    Certifications: ${cv.certifications}`);
        });
    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

checkCVs();
