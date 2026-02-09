import pg from 'pg';

const pool = new pg.Pool({
    connectionString: 'postgresql://postgres:Meid3030@localhost:5432/resipebook'
});

async function showRecipes() {
    try {
        // Check recipe columns first
        const cols = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'recipes' ORDER BY ordinal_position
        `);
        console.log('Recipes table columns:');
        console.log(cols.rows.map(c => c.column_name).join(', '));
        console.log('');

        // Recipes - select all columns
        const recipes = await pool.query('SELECT * FROM recipes');
        console.log('========================================');
        console.log('RECIPES: ' + recipes.rows.length + ' total');
        console.log('========================================');
        recipes.rows.forEach(r => {
            console.log('ID: ' + r.id);
            console.log('Name: ' + (r.title || r.name || 'N/A'));
            console.log('Category: ' + (r.category || 'N/A'));
            console.log('---');
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

showRecipes();
