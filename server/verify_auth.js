
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const { Client } = pg;

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function verify() {
    try {
        await client.connect();
        console.log('✅ AUTHORIZATION SUCCESSFUL');
        await client.end();
    } catch (err) {
        console.error('❌ AUTHORIZATION FAILED');
        console.error(err.message);
        if (err.code) console.error('Code:', err.code);
        await client.end();
        process.exit(1);
    }
}

verify();
