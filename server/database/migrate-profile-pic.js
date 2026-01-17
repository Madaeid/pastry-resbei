// Migration script to add profile_picture column to users table
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file is in the same directory as this file
const dbPath = path.join(__dirname, 'pastry.db');

try {
    const db = new Database(dbPath);
    console.log('🔌 Connected to database:', dbPath);

    // Check if column exists
    const columns = db.prepare("PRAGMA table_info(users)").all();
    const hasColumn = columns.some(col => col.name === 'profile_picture');

    if (hasColumn) {
        console.log('✅ profile_picture column already exists');
    } else {
        console.log('➕ Adding profile_picture column...');
        db.prepare("ALTER TABLE users ADD COLUMN profile_picture TEXT").run();
        console.log('✅ profile_picture column added successfully');
    }

    db.close();
} catch (error) {
    console.error('❌ Migration failed:', error);
}
