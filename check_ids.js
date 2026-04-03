
import { getDatabase } from './server/database/db.js';

async function checkUsers() {
    const db = getDatabase();
    try {
        const result = await db.query('SELECT id, username FROM users LIMIT 5');
        console.log('Users:', result.rows);
        
        const countRes = await db.query('SELECT user_id, COUNT(*) FROM recipes GROUP BY user_id');
        console.log('Recipes by user_id:', countRes.rows);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkUsers();
