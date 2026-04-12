import { getDatabase } from './db.js';

async function addShareFields() {
    try {
        const db = getDatabase();
        console.log('Adding share fields to recipes table...');

        await db.query(`
            ALTER TABLE recipes 
            ADD COLUMN IF NOT EXISTS shared_from_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS shared_notes TEXT;
        `);

        console.log('Fields added successfully.');
        process.exit(0);
    } catch (e) {
        console.error('Error adding share fields:', e);
        process.exit(1);
    }
}

addShareFields();
