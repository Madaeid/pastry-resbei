// Migration: Add ingredients and instructions columns to daily_menu_items
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use the database in the server root folder
const db = new Database(path.join(__dirname, '..', 'pastry.db'));

console.log('🔧 Migrating daily_menu_items table...');

try {
    db.exec('ALTER TABLE daily_menu_items ADD COLUMN ingredients TEXT');
    console.log('✅ Added ingredients column');
} catch (e) {
    if (e.message.includes('duplicate column')) {
        console.log('ℹ️  ingredients column already exists');
    } else {
        console.error('Error adding ingredients:', e.message);
    }
}

try {
    db.exec('ALTER TABLE daily_menu_items ADD COLUMN instructions TEXT');
    console.log('✅ Added instructions column');
} catch (e) {
    if (e.message.includes('duplicate column')) {
        console.log('ℹ️  instructions column already exists');
    } else {
        console.error('Error adding instructions:', e.message);
    }
}

db.close();
console.log('🎉 Migration complete!');
