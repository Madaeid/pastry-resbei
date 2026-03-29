
// Check user count in PostgreSQL
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkUserCount() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();

        const res = await client.query('SELECT COUNT(*) FROM users');
        const count = res.rows[0].count;

        console.log(`\n=== POSTRGESQL USER COUNT ===`);
        console.log(`Total Users: ${count}`);

        if (count > 0) {
            const users = await client.query('SELECT username, email, created_at FROM users ORDER BY created_at DESC LIMIT 5');
            console.log('\nLast 5 Users:');
            users.rows.forEach(u => {
                console.log(`- ${u.username} (${u.email}) - ${u.created_at}`);
            });
        }

        await client.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkUserCount();
