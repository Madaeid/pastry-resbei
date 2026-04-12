import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: 'postgresql://postgres:Meid3030@localhost:5432/resipebook'
});

async function check() {
    try {
        const res = await pool.query("SELECT id, name, visibility, user_id FROM recipes WHERE visibility = 'public' LIMIT 5");
        console.log('Public recipes count:', res.rows.length);
        console.log('Sample recipes:', res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
