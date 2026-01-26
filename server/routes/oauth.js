// OAuth Routes for Google and Apple Sign In
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/db.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

// OAuth Configuration - Set these in your .env file
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback';

const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || '';
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || '';
const APPLE_KEY_ID = process.env.APPLE_KEY_ID || '';
const APPLE_REDIRECT_URI = process.env.APPLE_REDIRECT_URI || 'http://localhost:3001/api/auth/apple/callback';

// ===== Google OAuth =====

// Initiate Google OAuth flow
router.get('/google', (req, res) => {
    if (!GOOGLE_CLIENT_ID) {
        return res.send(`
            <html>
            <head><title>Google Sign In</title></head>
            <body>
                <script>
                    window.opener.postMessage({
                        type: 'google-auth-error',
                        error: 'Google Sign In is not configured. Please contact the administrator.'
                    }, '*');
                    window.close();
                </script>
            </body>
            </html>
        `);
    }

    const scope = encodeURIComponent('openid email profile');
    const state = uuidv4(); // For CSRF protection

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=${scope}` +
        `&state=${state}` +
        `&access_type=offline` +
        `&prompt=consent`;

    res.redirect(googleAuthUrl);
});

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        return res.send(generateErrorPage('google', error));
    }

    if (!code) {
        return res.send(generateErrorPage('google', 'No authorization code received'));
    }

    try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            return res.send(generateErrorPage('google', tokens.error_description || tokens.error));
        }

        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });

        const googleUser = await userInfoResponse.json();

        if (!googleUser.email) {
            return res.send(generateErrorPage('google', 'Could not get email from Google'));
        }

        // Find or create user in our database
        const db = getDatabase();
        let user = db.prepare('SELECT * FROM users WHERE email = ? OR google_id = ?')
            .get(googleUser.email.toLowerCase(), googleUser.id);

        if (!user) {
            // Create new user
            const username = googleUser.email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 6);
            const displayName = googleUser.name || username;

            const result = db.prepare(`
                INSERT INTO users (username, display_name, email, google_id, auth_provider, created_at)
                VALUES (?, ?, ?, ?, 'google', datetime('now'))
            `).run(username, displayName, googleUser.email.toLowerCase(), googleUser.id);

            user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        } else if (!user.google_id) {
            // Link Google account to existing user
            db.prepare('UPDATE users SET google_id = ?, auth_provider = COALESCE(auth_provider, "google") WHERE id = ?')
                .run(googleUser.id, user.id);
        }

        // Generate JWT token
        const token = generateToken(user);

        // Send success message to parent window
        res.send(generateSuccessPage('google', {
            username: user.username,
            displayName: user.display_name || user.username,
            email: user.email,
            isAdmin: user.is_admin === 1
        }, token));

    } catch (error) {
        console.error('Google OAuth error:', error);
        res.send(generateErrorPage('google', 'Authentication failed. Please try again.'));
    }
});

// ===== Apple OAuth =====

// Initiate Apple OAuth flow
router.get('/apple', (req, res) => {
    if (!APPLE_CLIENT_ID) {
        return res.send(`
            <html>
            <head><title>Apple Sign In</title></head>
            <body>
                <script>
                    window.opener.postMessage({
                        type: 'apple-auth-error',
                        error: 'Apple Sign In is not configured. Please contact the administrator.'
                    }, '*');
                    window.close();
                </script>
            </body>
            </html>
        `);
    }

    const scope = encodeURIComponent('name email');
    const state = uuidv4();

    const appleAuthUrl = `https://appleid.apple.com/auth/authorize?` +
        `client_id=${APPLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(APPLE_REDIRECT_URI)}` +
        `&response_type=code id_token` +
        `&scope=${scope}` +
        `&state=${state}` +
        `&response_mode=form_post`;

    res.redirect(appleAuthUrl);
});

// Apple OAuth callback (POST because Apple uses form_post)
router.post('/apple/callback', async (req, res) => {
    const { code, id_token, error, user: userInfo } = req.body;

    if (error) {
        return res.send(generateErrorPage('apple', error));
    }

    if (!code && !id_token) {
        return res.send(generateErrorPage('apple', 'No authorization code received'));
    }

    try {
        // Decode the id_token to get user info (Apple sends it in the callback)
        let appleUser = {};

        if (id_token) {
            // Decode JWT token (base64)
            const tokenParts = id_token.split('.');
            if (tokenParts.length === 3) {
                const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                appleUser = {
                    id: payload.sub,
                    email: payload.email
                };
            }
        }

        // Parse user info if provided (only on first login)
        if (userInfo) {
            try {
                const parsedUserInfo = typeof userInfo === 'string' ? JSON.parse(userInfo) : userInfo;
                appleUser.name = parsedUserInfo.name?.firstName
                    ? `${parsedUserInfo.name.firstName} ${parsedUserInfo.name.lastName || ''}`.trim()
                    : null;
            } catch (e) {
                // User info parsing failed, continue without name
            }
        }

        if (!appleUser.email && !appleUser.id) {
            return res.send(generateErrorPage('apple', 'Could not get user info from Apple'));
        }

        // Find or create user in our database
        const db = getDatabase();
        let user = db.prepare('SELECT * FROM users WHERE email = ? OR apple_id = ?')
            .get(appleUser.email?.toLowerCase(), appleUser.id);

        if (!user) {
            // Create new user
            const username = (appleUser.email?.split('@')[0] || 'apple_user') + '_' + Math.random().toString(36).substring(2, 6);
            const displayName = appleUser.name || username;

            const result = db.prepare(`
                INSERT INTO users (username, display_name, email, apple_id, auth_provider, created_at)
                VALUES (?, ?, ?, ?, 'apple', datetime('now'))
            `).run(username, displayName, appleUser.email?.toLowerCase() || null, appleUser.id);

            user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        } else if (!user.apple_id && appleUser.id) {
            // Link Apple account to existing user
            db.prepare('UPDATE users SET apple_id = ?, auth_provider = COALESCE(auth_provider, "apple") WHERE id = ?')
                .run(appleUser.id, user.id);
        }

        // Generate JWT token
        const token = generateToken(user);

        // Send success message to parent window
        res.send(generateSuccessPage('apple', {
            username: user.username,
            displayName: user.display_name || user.username,
            email: user.email,
            isAdmin: user.is_admin === 1
        }, token));

    } catch (error) {
        console.error('Apple OAuth error:', error);
        res.send(generateErrorPage('apple', 'Authentication failed. Please try again.'));
    }
});

// ===== Helper Functions =====

function generateSuccessPage(provider, user, token) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Sign In Successful</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #0f0f1a, #1a1a2e);
                    color: white;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                }
                .container {
                    text-align: center;
                    padding: 40px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 20px;
                    border: 1px solid rgba(255,107,138,0.2);
                }
                .icon { font-size: 4rem; margin-bottom: 20px; }
                h1 { color: #ff6b8a; margin-bottom: 10px; }
                p { color: rgba(255,255,255,0.7); }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">✅</div>
                <h1>Sign In Successful!</h1>
                <p>Redirecting you to the app...</p>
            </div>
            <script>
                window.opener.postMessage({
                    type: '${provider}-auth-success',
                    user: ${JSON.stringify(user)},
                    token: ${JSON.stringify(token)}
                }, '*');
                setTimeout(() => window.close(), 1500);
            </script>
        </body>
        </html>
    `;
}

function generateErrorPage(provider, errorMessage) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Sign In Failed</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #0f0f1a, #1a1a2e);
                    color: white;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                }
                .container {
                    text-align: center;
                    padding: 40px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 20px;
                    border: 1px solid rgba(239,68,68,0.3);
                }
                .icon { font-size: 4rem; margin-bottom: 20px; }
                h1 { color: #ef4444; margin-bottom: 10px; }
                p { color: rgba(255,255,255,0.7); }
                button {
                    margin-top: 20px;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #ff6b8a, #ffb347);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 1rem;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">❌</div>
                <h1>Sign In Failed</h1>
                <p>${errorMessage}</p>
                <button onclick="window.close()">Close Window</button>
            </div>
            <script>
                window.opener.postMessage({
                    type: '${provider}-auth-error',
                    error: ${JSON.stringify(errorMessage)}
                }, '*');
            </script>
        </body>
        </html>
    `;
}

export default router;
