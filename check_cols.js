
import { getDatabase } from './server/database/db.js';

async function checkCols() {
    const db = getDatabase();
    try {
        const result = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'recipes'
        `);
        console.log('Recipes columns:', result.rows);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkCols();
