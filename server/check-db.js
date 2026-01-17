// Check database tables and columns
import Database from 'better-sqlite3';

// Try both database paths
const paths = ['./pastry.db', './database/pastry.db'];

for (const dbPath of paths) {
    try {
        console.log(`\n=== Checking ${dbPath} ===`);
        const db = new Database(dbPath);

        const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
        console.log('Tables:', tables.map(t => t.name));

        // Check if daily_menu_items exists
        if (tables.some(t => t.name === 'daily_menu_items')) {
            const columns = db.prepare(`PRAGMA table_info(daily_menu_items)`).all();
            console.log('daily_menu_items columns:', columns.map(c => c.name));

            // Check if ingredients column exists
            const hasIngredients = columns.some(c => c.name === 'ingredients');
            const hasInstructions = columns.some(c => c.name === 'instructions');

            console.log(`Has ingredients column: ${hasIngredients}`);
            console.log(`Has instructions column: ${hasInstructions}`);

            if (!hasIngredients) {
                console.log('Adding ingredients column...');
                db.exec('ALTER TABLE daily_menu_items ADD COLUMN ingredients TEXT');
                console.log('✅ Added ingredients column');
            }

            if (!hasInstructions) {
                console.log('Adding instructions column...');
                db.exec('ALTER TABLE daily_menu_items ADD COLUMN instructions TEXT');
                console.log('✅ Added instructions column');
            }
        } else {
            console.log('daily_menu_items table does not exist');
        }

        db.close();
    } catch (e) {
        console.log(`Error with ${dbPath}:`, e.message);
    }
}

console.log('\n🎉 Done!');
