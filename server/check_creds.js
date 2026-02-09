
import pg from 'pg';
const { Client } = pg;

const passwords = [
    'admin123',
    'password',
    'postgres',
    'admin',
    'root',
    '123456',
    '1234',
    'secret'
];

async function check() {
    console.log("Checking common passwords for user 'postgres'...");

    for (const pass of passwords) {
        const client = new Client({
            connectionString: `postgresql://postgres:${pass}@localhost:5432/postgres`,
            connectionTimeoutMillis: 2000
        });

        try {
            await client.connect();
            console.log(`\n✅ SUCCESS! Password found: "${pass}"`);
            await client.end();
            process.exit(0);
        } catch (err) {
            process.stdout.write(`❌ "${pass}" failed. `);
            await client.end(); // Ensure closed
        }
    }
    console.log("\n\n❌ All passwords failed.");
    process.exit(1);
}

check();
