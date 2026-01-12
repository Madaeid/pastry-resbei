// Database Connection Module
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || './database/pastry.db';
const fullPath = path.join(__dirname, '..', dbPath.replace('./', ''));

let db;

export function getDatabase() {
    if (!db) {
        db = new Database(fullPath);
        db.pragma('foreign_keys = ON');
    }
    return db;
}

export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

export default getDatabase;
