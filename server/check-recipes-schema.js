import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkRecipesTable() {
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

        const result = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'recipes';
        `);
        console.log('📋 RECIPES TABLE COLUMNS:');
        console.table(result.rows);

        const rowCount = await client.query('SELECT COUNT(*) FROM recipes');
        console.log(`\n Total recipes: ${rowCount.rows[0].count}`);

        const publicRecipes = await client.query("SELECT COUNT(*) FROM recipes WHERE visibility = 'public'");
        console.log(`\n Public recipes: ${publicRecipes.rows[0].count}`);

        await client.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkRecipesTable();
