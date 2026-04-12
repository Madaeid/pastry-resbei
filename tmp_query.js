import pg from 'pg';
const pool = new pg.Pool({
    connectionString: 'postgresql://postgres:Meid3030@localhost:5432/resipebook'
});

async function run() {
    try {
        const userRes = await pool.query("SELECT id, username, display_name, is_public FROM users WHERE username = 'chet'");
        if (userRes.rows.length === 0) {
            console.log('User "chet" not found');
            return;
        }
        const user = userRes.rows[0];
        console.log('USER INFO:', user);

        const recipesRes = await pool.query("SELECT id, name, category, visibility FROM recipes WHERE user_id = $1", [user.id]);
        console.log('ALL RECIPES/POSTS FOR CHET:', recipesRes.rows);

        const publicRes = await pool.query("SELECT id, name, category, visibility FROM recipes WHERE user_id = $1 AND visibility = 'public'", [user.id]);
        console.log('PUBLIC CONTENT ONLY:', publicRes.rows);

    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        await pool.end();
    }
}

run();
