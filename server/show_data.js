import pg from 'pg';

const pool = new pg.Pool({
    connectionString: 'postgresql://postgres:Meid3030@localhost:5432/resipebook'
});

async function showData() {
    try {
        // Check user columns first
        const cols = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'users' ORDER BY ordinal_position
        `);
        console.log('User table columns:');
        console.log(cols.rows.map(c => c.column_name).join(', '));
        console.log('');

        // Users - select all columns
        const users = await pool.query('SELECT * FROM users');
        console.log('========================================');
        console.log('USERS: ' + users.rows.length + ' total');
        console.log('========================================');
        users.rows.forEach(u => {
            console.log('ID: ' + u.id);
            console.log('Username: ' + u.username);
            console.log('Email: ' + u.email);
            if (u.subscription_status) console.log('Subscription: ' + u.subscription_status);
            if (u.subscription_type) console.log('Type: ' + u.subscription_type);
            console.log('---');
        });

        // Recipes
        const recipes = await pool.query('SELECT id, title, category FROM recipes');
        console.log('');
        console.log('========================================');
        console.log('RECIPES: ' + recipes.rows.length + ' total');
        console.log('========================================');
        recipes.rows.forEach(r => {
            console.log('- ' + r.title + ' (' + r.category + ')');
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

showData();
