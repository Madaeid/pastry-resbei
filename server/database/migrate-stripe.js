// Database Migration: Add Stripe columns
// Run this if you have an existing database to add Stripe columns

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dbPath = process.env.DATABASE_PATH || './pastry.db';
const db = new Database(path.join(__dirname, '..', dbPath.replace('./', '')));

console.log('🔄 Running Stripe migration...\n');

// Add Stripe columns to subscriptions table
try {
    db.exec(`ALTER TABLE subscriptions ADD COLUMN stripe_session_id TEXT`);
    console.log('✅ Added stripe_session_id to subscriptions');
} catch (e) {
    if (e.message.includes('duplicate column')) {
        console.log('ℹ️  stripe_session_id already exists in subscriptions');
    } else {
        console.error('❌ Error:', e.message);
    }
}

try {
    db.exec(`ALTER TABLE subscriptions ADD COLUMN stripe_customer_id TEXT`);
    console.log('✅ Added stripe_customer_id to subscriptions');
} catch (e) {
    if (e.message.includes('duplicate column')) {
        console.log('ℹ️  stripe_customer_id already exists in subscriptions');
    } else {
        console.error('❌ Error:', e.message);
    }
}

// Add Stripe columns to transactions table
try {
    db.exec(`ALTER TABLE transactions ADD COLUMN stripe_session_id TEXT`);
    console.log('✅ Added stripe_session_id to transactions');
} catch (e) {
    if (e.message.includes('duplicate column')) {
        console.log('ℹ️  stripe_session_id already exists in transactions');
    } else {
        console.error('❌ Error:', e.message);
    }
}

db.close();

console.log('\n🎉 Stripe migration complete!');
