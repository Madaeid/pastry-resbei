
import { getDatabase } from './server/database/db.js';

async function checkVisibility() {
    const db = getDatabase();
    try {
        const result = await db.query('SELECT name, visibility FROM recipes');
        console.log('Recipes:', result.rows);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkVisibility();
