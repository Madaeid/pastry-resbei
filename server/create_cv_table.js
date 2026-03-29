import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'Meid3030',
    database: 'resipebook'
});

async function createCvTable() {
    try {
        await client.connect();

        await client.query(`
            CREATE TABLE IF NOT EXISTS cv_profiles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
                full_name TEXT,
                dob DATE,
                phone TEXT,
                email TEXT,
                address TEXT,
                skills JSONB,
                photo TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ cv_profiles table created successfully');

    } catch (err) {
        console.error('❌ Error creating table:', err);
    } finally {
        await client.end();
    }
}

createCvTable();
