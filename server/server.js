// Main Express Server for Chef Book
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// Import routes
import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import userRoutes from './routes/users.js';
import recipeRoutes from './routes/recipes.js';
import subscriptionRoutes from './routes/subscriptions.js';
import adminRoutes from './routes/admin.js';
import dailyMenuRoutes from './routes/dailyMenu.js';
import cvRoutes from './routes/cv.js'; // CV routes
import storeRoutes from './routes/store.js'; // Store marketplace routes
import walletRoutes from './routes/wallet.js'; // Wallet & transfers
import booksRoutes from './routes/books.js'; // Chef Book portfolio
import scannerRoutes from './routes/scanner.js'; // AI Ingredient Scanner (Premium)
import nutritionRoutes from './routes/nutrition.js'; // AI Nutritional Analysis

import { getDatabase } from './database/db.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ===== Middleware =====

// CORS Configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json({ limit: '100mb' })); // Allow large base64 videos and images
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 auth requests per windowMs
    message: { error: 'Too many authentication attempts, please try again later.' }
});

// Apply authLimiter first so it takes precedence over the general limiter
app.use('/api/auth', authLimiter);

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ===== Routes =====
app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes); // OAuth routes (Google, Apple)
app.use('/api/users', userRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/daily-menu', dailyMenuRoutes);
app.use('/api/cv', cvRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/scanner', scannerRoutes); // AI Ingredient Scanner
app.use('/api/nutrition', nutritionRoutes); // AI Nutritional Analysis

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Chef Book API is running',
        timestamp: new Date().toISOString()
    });
});

// ===== Error Handling =====

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    console.error(err.stack);

    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'development'
            ? err.message
            : 'Internal server error'
    });
});

// ===== Start Server =====
const server = app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║          👨‍🍳 Chef Book API Server 👨‍🍳                    ║
╠════════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                  ║
║  Environment: ${process.env.NODE_ENV || 'development'}                           ║
║  Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}           ║
╚════════════════════════════════════════════════════════════╝
    `);
});

// Handle server errors (like EADDRINUSE)
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Retrying in 2 seconds...`);
        setTimeout(() => {
            server.close();
            server.listen(PORT);
        }, 2000);
    } else {
        console.error('Server error:', err);
    }
});

export default app;
