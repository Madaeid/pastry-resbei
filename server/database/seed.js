import bcrypt from 'bcrypt';
import { getDatabase } from './db.js';

export async function ensureAdminUser() {
    const db = getDatabase();
    const username = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'Admin123';
    const email = (process.env.ADMIN_EMAIL || 'madaeid500@gmail.com').toLowerCase();

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Check if admin exists
        const res = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (res.rows.length === 0) {
            console.log(`🌱 Seeding admin user "${username}" into database...`);
            await db.query(`
                INSERT INTO users (username, display_name, email, password_hash, is_admin)
                VALUES ($1, $2, $3, $4, true)
            `, [username, 'Admin', email, passwordHash]);
            console.log('✅ Admin user seeded successfully.');
        } else {
            // Ensure admin is actually admin and has the correct password/email from env
            console.log(`🔄 Verifying admin user "${username}" credentials in database...`);
            await db.query(`
                UPDATE users 
                SET is_admin = true, password_hash = $1, email = $2
                WHERE username = $3
            `, [passwordHash, email, username]);
            console.log('✅ Admin user credentials verified and updated.');
        }
    } catch (err) {
        console.error('❌ Failed to seed/verify admin user:', err.message);
    }
}
