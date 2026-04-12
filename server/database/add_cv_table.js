import { getDatabase } from './db.js';

async function createCvTable() {
    try {
        const db = getDatabase();
        console.log('Creating CV table...');

        await db.query(`
            CREATE TABLE IF NOT EXISTS cvs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                full_name TEXT NOT NULL,
                dob TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                skills TEXT,
                summary TEXT,
                languages TEXT,
                education TEXT,
                experience TEXT,
                certifications TEXT,
                photo TEXT,
                cv_file_name TEXT,
                cv_file_data TEXT,
                cv_file_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('CV table created/verified with all columns.');
        process.exit(0);
    } catch (e) {
        console.error('Error creating CV table:', e);
        process.exit(1);
    }
}

createCvTable();
