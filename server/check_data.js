import pg from 'pg';

const pool = new pg.Pool({
    connectionString: 'postgresql://postgres:Meid3030@localhost:5432/resipebook'
});

async function checkData() {
    try {
        // Get all tables
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('=== TABLES IN DATABASE ===');
        tables.rows.forEach(r => console.log('- ' + r.table_name));

        // Check users
        try {
            const users = await pool.query('SELECT id, username, email, is_premium, subscription_status, created_at FROM users');
            console.log('\n=== USERS (' + users.rows.length + ' total) ===');
            if (users.rows.length === 0) {
                console.log('No users found in database');
            } else {
                users.rows.forEach(u => {
                    console.log(`- ID: ${u.id}`);
                    console.log(`  Username: ${u.username}`);
                    console.log(`  Email: ${u.email}`);
                    console.log(`  Premium: ${u.is_premium}`);
                    console.log(`  Status: ${u.subscription_status}`);
                    console.log('');
                });
            }
        } catch (e) {
            console.log('\n=== USERS ===');
            console.log('Error:', e.message);
        }

        // Check recipes
        try {
            const recipes = await pool.query('SELECT id, title, category FROM recipes');
            console.log('\n=== RECIPES (' + recipes.rows.length + ' total) ===');
            if (recipes.rows.length === 0) {
                console.log('No recipes found in database');
            } else {
                recipes.rows.forEach(r => {
                    console.log(`- ${r.title} (${r.category})`);
                });
            }
        } catch (e) {
            console.log('\n=== RECIPES ===');
            console.log('Error:', e.message);
        }

    } catch (err) {
        console.error('Database connection error:', err.message);
    } finally {
        await pool.end();
    }
}

checkData();
