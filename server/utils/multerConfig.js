import multer from 'multer';

// Use memory storage or disk storage depending on needs.
// For Cloudinary uploads, memory storage is usually preferred.
const storage = multer.memoryStorage();

// Mime-type Isolation: Strictly validate MIME types to prevent malicious uploads
const fileFilter = (req, file, cb) => {
    // List of allowed MIME types
    const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'video/mp4',
        'video/mpeg',
        'video/webm',
        'application/pdf'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        // Accept the file
        cb(null, true);
    } else {
        // Reject the file
        cb(new Error(`Invalid file type. Allowed types are: ${allowedMimeTypes.join(', ')}`), false);
    }
};

// Configure multer with strict file filtering and limits
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit to match express.json limit
    }
});

export default upload;
