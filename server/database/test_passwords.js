// Test different password combinations
import pg from 'pg';

const { Client } = pg;

const passwords = ['admin123', 'postgres', 'password', '123456', 'admin', ''];

async function tryPasswords() {
    console.log('Testing different PostgreSQL passwords...\n');

    for (const pass of passwords) {
        const client = new Client({
            host: 'localhost',
            port: 5432,
            user: 'postgres',
            password: pass,
            database: 'postgres',
            connectionTimeoutMillis: 3000
        });

        try {
            await client.connect();
            console.log(`✅ SUCCESS! Password is: "${pass}"`);
            await client.end();
            return pass;
        } catch (err) {
            console.log(`❌ Password "${pass}" failed`);
        }
    }

    console.log('\n⚠️ None of the common passwords worked.');
    console.log('Please enter your PostgreSQL password manually.');
}

tryPasswords();
