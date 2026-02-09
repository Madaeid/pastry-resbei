// Verify PostgreSQL database setup - simple version
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function verify() {
    console.log('Verifying PostgreSQL Database Setup');
    console.log('====================================\n');

    const client = await pool.connect();

    try {
        // List all tables with counts
        const tables = ['users', 'recipes', 'subscriptions', 'transactions', 'sessions', 'daily_menus', 'daily_menu_items', 'recipebook'];

        console.log('Tables and row counts:');
        for (const table of tables) {
            try {
                const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`  ${table}: ${result.rows[0].count} rows`);
            } catch (e) {
                console.log(`  ${table}: ERROR - ${e.message}`);
            }
        }

        // Show users
        console.log('\nUsers:');
        const usersResult = await client.query('SELECT id, username, email, is_admin FROM users ORDER BY id LIMIT 5');
        usersResult.rows.forEach(u => {
            console.log(`  ID:${u.id} ${u.username} (${u.email}) ${u.is_admin ? '[ADMIN]' : ''}`);
        });

        console.log('\nDatabase verification complete!');

    } finally {
        client.release();
        await pool.end();
    }
}

verify().catch(console.error);
