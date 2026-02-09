
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const targetDbName = 'resipebook';
const dbUrl = process.env.DATABASE_URL;

// Replace the target database name with 'postgres' to connect to the default database
// This assumes the URL ends with /pastry_db or similar
const baseUrl = dbUrl.replace(`/${targetDbName}`, '/postgres');

async function createDb() {
    console.log(`Attempting to connect to ${baseUrl} to create ${targetDbName}...`);
    const client = new Client({
        connectionString: baseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();

        // Check if db exists
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [targetDbName]);
        if (res.rowCount === 0) {
            console.log(`Creating database ${targetDbName}...`);
            // Cannot use parameters for database name in CREATE DATABASE
            await client.query(`CREATE DATABASE "${targetDbName}"`);
            console.log('Database created successfully.');
        } else {
            console.log(`Database ${targetDbName} already exists.`);
        }
    } catch (err) {
        console.error('Error creating database:', err);
        // If auth failed, user might need to change password in .env
        if (err.code === '28P01') {
            console.error('Authentication failed. Please check ADMIN_PASSWORD or postgres credentials in .env');
        }
    } finally {
        await client.end();
    }
}

createDb();
