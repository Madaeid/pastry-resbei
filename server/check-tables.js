// Check data in PostgreSQL tables
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkTables() {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'Meid3030',
        database: 'resipebook'
    });

    try {
        await client.connect();
        console.log('Connected to resipebook database\n');

        // Check users
        const users = await client.query('SELECT id, username, email, is_admin FROM users');
        console.log('📋 USERS TABLE:');
        console.log(users.rows.length ? users.rows : '   (empty)');

        // Check subscriptions
        const subs = await client.query('SELECT * FROM subscriptions');
        console.log('\n📋 SUBSCRIPTIONS TABLE:');
        console.log(subs.rows.length ? subs.rows : '   (empty)');

        // Check transactions
        const trans = await client.query('SELECT * FROM transactions');
        console.log('\n📋 TRANSACTIONS TABLE:');
        console.log(trans.rows.length ? trans.rows : '   (empty)');

        // List ALL tables
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('\n📋 ALL TABLES IN DB:');
        console.log(tables.rows.map(r => r.table_name));

        await client.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkTables();
