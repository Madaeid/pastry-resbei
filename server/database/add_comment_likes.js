import { getDatabase } from './db.js';

async function createCommentLikesTable() {
    try {
        const db = getDatabase();
        console.log('Creating comment_likes table...');

        await db.query(`
            CREATE TABLE IF NOT EXISTS comment_likes (
                id SERIAL PRIMARY KEY,
                comment_id INTEGER REFERENCES recipe_comments(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(comment_id, user_id)
            );
        `);
        console.log('comment_likes table created');
        process.exit(0);
    } catch (e) {
        console.error('Error creating comment_likes table:', e);
        process.exit(1);
    }
}

createCommentLikesTable();
