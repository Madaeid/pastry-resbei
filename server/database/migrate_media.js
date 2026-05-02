import { getDatabase } from './db.js';
import { uploadMedia } from '../utils/cloudinary.js';

async function migrateMedia() {
    const db = getDatabase();
    console.log('Starting media migration from Base64 to Cloudinary...');

    try {
        // 1. Migrate Users (profile_picture, cv_file, gallery)
        console.log('Migrating users...');
        const users = await db.query('SELECT id, profile_picture, cv_file, gallery FROM users');
        for (const user of users.rows) {
            let updated = false;
            let profilePic = user.profile_picture;
            let cvFile = user.cv_file;
            
            if (profilePic && profilePic.startsWith('data:')) {
                console.log(`Uploading profile picture for user ${user.id}...`);
                profilePic = await uploadMedia(profilePic, 'users');
                updated = true;
            }
            if (cvFile && cvFile.startsWith('data:')) {
                console.log(`Uploading CV file for user ${user.id}...`);
                cvFile = await uploadMedia(cvFile, 'users');
                updated = true;
            }
            // gallery is an array, we'll skip for now unless needed
            
            if (updated) {
                await db.query(
                    'UPDATE users SET profile_picture = $1, cv_file = $2 WHERE id = $3',
                    [profilePic, cvFile, user.id]
                );
            }
        }

        // 2. Migrate Recipes (photo, video)
        console.log('Migrating recipes...');
        const recipes = await db.query('SELECT id, photo, video FROM recipes');
        for (const recipe of recipes.rows) {
            let updated = false;
            let photo = recipe.photo;
            let video = recipe.video;

            if (photo && photo.startsWith('data:')) {
                console.log(`Uploading photo for recipe ${recipe.id}...`);
                photo = await uploadMedia(photo, 'recipes');
                updated = true;
            }
            if (video && video.startsWith('data:')) {
                console.log(`Uploading video for recipe ${recipe.id}...`);
                video = await uploadMedia(video, 'recipes');
                updated = true;
            }

            if (updated) {
                await db.query(
                    'UPDATE recipes SET photo = $1, video = $2 WHERE id = $3',
                    [photo, video, recipe.id]
                );
            }
        }

        // 3. Migrate Store Recipes (photo, video)
        console.log('Migrating store recipes...');
        const storeRecipes = await db.query('SELECT id, photo, video FROM store_recipes');
        for (const recipe of storeRecipes.rows) {
            let updated = false;
            let photo = recipe.photo;
            let video = recipe.video;

            if (photo && photo.startsWith('data:')) {
                console.log(`Uploading photo for store recipe ${recipe.id}...`);
                photo = await uploadMedia(photo, 'store');
                updated = true;
            }
            if (video && video.startsWith('data:')) {
                console.log(`Uploading video for store recipe ${recipe.id}...`);
                video = await uploadMedia(video, 'store');
                updated = true;
            }

            if (updated) {
                await db.query(
                    'UPDATE store_recipes SET photo = $1, video = $2 WHERE id = $3',
                    [photo, video, recipe.id]
                );
            }
        }

        // 4. Migrate Daily Menu Items (photo)
        console.log('Migrating daily menu items...');
        const menuItems = await db.query('SELECT id, photo FROM daily_menu_items');
        for (const item of menuItems.rows) {
            let updated = false;
            let photo = item.photo;

            if (photo && photo.startsWith('data:')) {
                console.log(`Uploading photo for menu item ${item.id}...`);
                photo = await uploadMedia(photo, 'daily_menu');
                updated = true;
            }

            if (updated) {
                await db.query(
                    'UPDATE daily_menu_items SET photo = $1 WHERE id = $2',
                    [photo, item.id]
                );
            }
        }
        
        // 5. Migrate Books (cover_photo)
        console.log('Migrating books...');
        const books = await db.query('SELECT id, cover_photo FROM books');
        for (const book of books.rows) {
            let updated = false;
            let photo = book.cover_photo;

            if (photo && photo.startsWith('data:')) {
                console.log(`Uploading cover photo for book ${book.id}...`);
                photo = await uploadMedia(photo, 'books');
                updated = true;
            }

            if (updated) {
                await db.query(
                    'UPDATE books SET cover_photo = $1 WHERE id = $2',
                    [photo, book.id]
                );
            }
        }

        console.log('Media migration complete! 🎉');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit(0);
    }
}

migrateMedia();
