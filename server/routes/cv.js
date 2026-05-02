import { uploadMedia } from '../utils/cloudinary.js';
import express from 'express';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get CV
router.get('/', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query('SELECT * FROM cvs WHERE user_id = $1', [req.user.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'CV not found' });
        }

        const cv = result.rows[0];
        res.json({
            fullName: cv.full_name,
            dob: cv.dob,
            phone: cv.phone,
            email: cv.email,
            address: cv.address,
            summary: cv.summary || '',
            skills: cv.skills,
            languages: cv.languages,
            education: cv.education,
            experience: cv.experience,
            certifications: cv.certifications,
            photo: cv.photo
        });
    } catch (err) {
        console.error('Error fetching CV:', err);
        res.status(500).json({ error: 'Failed to fetch CV' });
    }
});

// Save CV
router.post('/', authenticateToken, async (req, res) => {
    try {
        let { fullName, dob, phone, email, address, summary, skills, languages, education, experience, certifications, photo } = req.body;
        if (photo) photo = await uploadMedia(photo, 'cvs');
        const db = getDatabase();
        const userId = req.user.userId;

        // Basic validation
        if (!fullName || !email) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Upsert CV data using ON CONFLICT
        const query = `
            INSERT INTO cvs (user_id, full_name, dob, phone, email, address, summary, skills, languages, education, experience, certifications, photo, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET
                full_name = EXCLUDED.full_name,
                dob = EXCLUDED.dob,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                address = EXCLUDED.address,
                summary = EXCLUDED.summary,
                skills = EXCLUDED.skills,
                languages = EXCLUDED.languages,
                education = EXCLUDED.education,
                experience = EXCLUDED.experience,
                certifications = EXCLUDED.certifications,
                photo = EXCLUDED.photo,
                updated_at = NOW()
            RETURNING *;
        `;

        // Handle potentially empty optional fields
        const safeDob = dob || null;
        const safeSkills = skills ? JSON.stringify(skills) : '[]';
        const safeLanguages = languages ? JSON.stringify(languages) : '[]';
        const safeEducation = education ? JSON.stringify(education) : '[]';
        const safeExperience = experience ? JSON.stringify(experience) : '[]';
        const safeCertifications = certifications ? JSON.stringify(certifications) : '[]';

        const values = [userId, fullName, safeDob, phone, email, address, summary || '', safeSkills, safeLanguages, safeEducation, safeExperience, safeCertifications, photo];

        const result = await db.query(query, values);

        // Also update the user profile with matching fields
        // This keeps profile and CV data in sync
        const updateProfileQuery = `
            UPDATE users 
            SET 
                phone = $1,
                email = $2,
                birthday = $3,
                profile_picture = $4,
                updated_at = NOW()
            WHERE id = $5
        `;

        await db.query(updateProfileQuery, [
            phone || null,      // phone
            email,              // email
            safeDob,            // birthday from dob
            photo || null,      // profile_picture from photo
            userId
        ]);

        res.json({ success: true, cv: result.rows[0] });

    } catch (err) {
        console.error('Error saving CV:', err);
        res.status(500).json({ error: 'Failed to save CV' });
    }
});

// Delete CV
router.delete('/', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        await db.query('DELETE FROM cvs WHERE user_id = $1', [req.user.userId]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting CV:', err);
        res.status(500).json({ error: 'Failed to delete CV' });
    }
});

export default router;
