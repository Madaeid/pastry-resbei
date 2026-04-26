import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: 'postgresql://postgres:Meid3030@localhost:5432/resipebook'
});

async function migrate() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS book_purchases (
                id SERIAL PRIMARY KEY,
                buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                price_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
                purchased_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(buyer_id, book_id)
            )
        `);
        console.log('✅ book_purchases table created');
        await pool.end();
    } catch (e) {
        console.error('Error:', e.message);
        await pool.end();
    }
}

migrate();
