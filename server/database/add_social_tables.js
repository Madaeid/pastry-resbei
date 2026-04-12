import { getDatabase } from './db.js';

async function createSocialTables() {
    try {
        const db = getDatabase();
        console.log('Creating social tables...');

        await db.query(`
            CREATE TABLE IF NOT EXISTS recipe_likes (
                id SERIAL PRIMARY KEY,
                recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(recipe_id, user_id)
            );
        `);
        console.log('recipe_likes table created');

        await db.query(`
            CREATE TABLE IF NOT EXISTS recipe_comments (
                id SERIAL PRIMARY KEY,
                recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                comment_text TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('recipe_comments table created');

        await db.query(`
            CREATE TABLE IF NOT EXISTS recipe_shares (
                id SERIAL PRIMARY KEY,
                recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('recipe_shares table created');

        console.log('Social tables setup complete.');
        process.exit(0);
    } catch (e) {
        console.error('Error creating social tables:', e);
        process.exit(1);
    }
}

createSocialTables();
