import { getDatabase } from './db.js';

async function addParentIdToComments() {
    try {
        const db = getDatabase();
        console.log('Adding parent_id column to recipe_comments...');

        await db.query(`
            ALTER TABLE recipe_comments 
            ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES recipe_comments(id) ON DELETE CASCADE;
        `);
        console.log('parent_id column added');
        process.exit(0);
    } catch (e) {
        console.error('Error adding parent_id column:', e);
        process.exit(1);
    }
}

addParentIdToComments();
