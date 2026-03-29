import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Meid3030@localhost:5432/resipebook'
});

async function checkColumns() {
    try {
        const query = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'profile_picture';
        `;
        const result = await pool.query(query);

        if (result.rows.length > 0) {
            console.log('✅ Column profile_picture already exists in users table.');
        } else {
            console.log('❌ Column profile_picture DOES NOT exist in users table.');
            console.log('Use add_profile_column.js (create one?) to add it.');
        }
    } catch (err) {
        console.error('Error checking columns:', err);
    } finally {
        await pool.end();
    }
}

checkColumns();
