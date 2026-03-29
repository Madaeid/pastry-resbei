import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Meid3030@localhost:5432/resipebook'
});

async function listUserPics() {
    try {
        const res = await pool.query('SELECT username, display_name, length(profile_picture) as pic_len FROM users');
        console.log('Users and their profile picture size:');
        res.rows.forEach(u => {
            console.log(`${u.username} (${u.display_name}): ${u.pic_len ? u.pic_len + ' bytes' : 'NULL'}`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

listUserPics();
