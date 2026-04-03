
import { getDatabase } from './server/database/db.js';

async function listAllTables() {
    const db = getDatabase();
    try {
        const result = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('Tables in public schema:', result.rows.map(r => r.table_name));
        
        for (const table of result.rows.map(r => r.table_name)) {
            const countRes = await db.query(`SELECT COUNT(*) FROM ${table}`);
            console.log(`Table ${table} count: ${countRes.rows[0].count}`);
        }
    } catch (err) {
        console.error('Error listing tables:', err.message);
    } finally {
        // Need to close pool
        process.exit();
    }
}

listAllTables();
