import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
    api_key: process.env.CLOUDINARY_API_KEY || '123456789012345',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'abcdefg1234567890',
});

/**
 * Uploads a base64 media string to Cloudinary
 * @param {string} base64String - The base64 string of the image/video
 * @param {string} folder - The folder to store the media in
 * @returns {Promise<string|null>} - Returns the secure URL or null if failed
 */
export async function uploadMedia(base64String, folder = 'chef-book') {
    if (!base64String) return null;
    
    // If it's already a URL (e.g., from a previous upload or an external link), just return it
    if (base64String.startsWith('http://') || base64String.startsWith('https://')) {
        return base64String;
    }

    // Determine resource type based on data URI
    let resourceType = 'auto';
    if (base64String.startsWith('data:video/')) {
        resourceType = 'video';
    }

    try {
        const result = await cloudinary.uploader.upload(base64String, {
            folder: folder,
            resource_type: resourceType,
        });
        return result.secure_url;
    } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        // Fallback to storing the original string if upload fails (e.g., due to invalid credentials in dev)
        // This prevents the app from breaking entirely during local development
        if (process.env.NODE_ENV !== 'production') {
            console.warn('Falling back to returning original base64 due to Cloudinary error (likely missing credentials)');
            return base64String;
        }
        return null;
    }
}

export default cloudinary;
