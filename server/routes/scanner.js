// AI Ingredient Scanner Routes
// Premium-only feature: Scan photos to identify ingredients using Gemini Vision AI
import express from 'express';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ===== Premium Gate Middleware =====
async function requirePremium(req, res, next) {
    try {
        const db = getDatabase();

        // Check admin status (admins get free premium)
        const userResult = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
        const user = userResult.rows[0];

        if (user?.is_admin === 1) {
            return next(); // Admins bypass premium check
        }

        // Check subscription
        const subResult = await db.query('SELECT * FROM subscriptions WHERE user_id = $1', [req.user.userId]);
        const subscription = subResult.rows[0];

        if (!subscription) {
            return res.status(403).json({
                error: 'Premium required',
                requiresPremium: true,
                message: 'AI Ingredient Scanner is a Premium feature. Upgrade to unlock!'
            });
        }

        const endDate = new Date(subscription.end_date);
        const now = new Date();

        if (subscription.status === 'cancelled' && endDate <= now) {
            return res.status(403).json({
                error: 'Premium required',
                requiresPremium: true,
                message: 'Your subscription has expired. Renew to continue using AI scanning!'
            });
        }

        if (subscription.status !== 'active' && subscription.status !== 'cancelled') {
            return res.status(403).json({
                error: 'Premium required',
                requiresPremium: true,
                message: 'AI Ingredient Scanner is a Premium feature. Upgrade to unlock!'
            });
        }

        if (endDate <= now) {
            return res.status(403).json({
                error: 'Premium required',
                requiresPremium: true,
                message: 'Your subscription has expired. Renew to continue using AI scanning!'
            });
        }

        next();
    } catch (error) {
        console.error('Premium check error:', error);
        res.status(500).json({ error: 'Failed to verify premium status' });
    }
}

// ===== Scan Image for Ingredients =====
// POST /api/scanner/scan
router.post('/scan', authenticateToken, requirePremium, async (req, res) => {
    try {
        const { image, mode } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
            // Fallback: intelligent mock response for demo/development
            console.log('⚠️ No Gemini API key configured — using smart mock response');
            return res.json(generateMockScanResult(mode));
        }

        // Prepare the image for Gemini API
        // Strip the data URL prefix if present
        let base64Image = image;
        let mimeType = 'image/jpeg';

        if (image.startsWith('data:')) {
            const match = image.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
                mimeType = match[1];
                base64Image = match[2];
            }
        }

        // Build the prompt based on scan mode
        const prompt = buildScanPrompt(mode);

        // Call Gemini Vision API
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: mimeType,
                                    data: base64Image
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        topP: 0.8,
                        maxOutputTokens: 2048,
                        responseMimeType: 'application/json'
                    }
                })
            }
        );

        if (!geminiResponse.ok) {
            const errText = await geminiResponse.text();
            console.error('Gemini API error:', errText);
            return res.status(502).json({
                error: 'AI service temporarily unavailable. Please try again.',
                details: process.env.NODE_ENV === 'development' ? errText : undefined
            });
        }

        const geminiData = await geminiResponse.json();

        // Extract the AI response text
        const aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiText) {
            return res.status(502).json({
                error: 'AI could not analyze this image. Try a clearer photo.'
            });
        }

        // Parse the JSON response from Gemini
        let result;
        try {
            result = JSON.parse(aiText);
        } catch (parseErr) {
            // Try to extract JSON from the response text
            const jsonMatch = aiText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                console.error('Failed to parse AI response:', aiText);
                return res.status(502).json({
                    error: 'AI response was unclear. Please try again with a different photo.'
                });
            }
        }

        // Normalize and validate the response
        const normalizedResult = {
            ingredients: Array.isArray(result.ingredients) ? result.ingredients : [],
            suggestedName: result.suggestedName || result.suggested_name || '',
            suggestedCategory: result.suggestedCategory || result.suggested_category || '',
            confidence: result.confidence || 'medium',
            tips: result.tips || ''
        };

        res.json(normalizedResult);

    } catch (error) {
        console.error('Scanner error:', error);
        res.status(500).json({ error: 'Failed to scan image. Please try again.' });
    }
});

// ===== Build prompt based on mode =====
function buildScanPrompt(mode) {
    const baseInstruction = `You are an expert pastry chef and food ingredient analyst. Analyze this image and identify all visible ingredients or food items.`;

    const responseFormat = `
Respond in JSON format with these fields:
{
  "ingredients": ["ingredient 1 with estimated quantity", "ingredient 2 with estimated quantity", ...],
  "suggestedName": "suggested recipe name based on visible ingredients",
  "suggestedCategory": "one of: Cakes, Cookies, Pastries, Pies & Tarts, Breads, Desserts, Chocolates, Other",
  "confidence": "high, medium, or low",
  "tips": "brief chef's tip about these ingredients (1-2 sentences)"
}`;

    switch (mode) {
        case 'ingredients':
            return `${baseInstruction}
Focus on identifying raw baking/cooking ingredients like flour, sugar, butter, eggs, etc.
Estimate quantities where possible (e.g., "200g flour", "3 large eggs", "1 cup sugar").
If you see packaging, read the labels for exact quantities.
${responseFormat}`;

        case 'dish':
            return `${baseInstruction}
This image shows a finished dish or baked item. Reverse-engineer the likely ingredients needed to recreate it.
Include common ingredients that would be used even if not directly visible.
Provide reasonable quantities for a standard recipe serving 6-8 people.
${responseFormat}`;

        case 'menu':
            return `${baseInstruction}
This image shows a menu, recipe card, or written recipe. Extract all ingredients mentioned.
Keep the quantities exactly as written if visible.
${responseFormat}`;

        default:
            return `${baseInstruction}
Identify everything food-related in this image. If it shows raw ingredients, list them with quantities.
If it shows a finished dish, reverse-engineer the recipe ingredients.
If it shows text (menu/recipe), extract the ingredient list.
${responseFormat}`;
    }
}

// ===== Mock Response for Development =====
function generateMockScanResult(mode) {
    const mockResults = {
        ingredients: [
            {
                ingredients: [
                    '250g all-purpose flour',
                    '200g unsalted butter (room temperature)',
                    '150g granulated sugar',
                    '3 large eggs',
                    '1 tsp vanilla extract',
                    '2 tsp baking powder',
                    '100ml whole milk',
                    'Pinch of salt'
                ],
                suggestedName: 'Classic Vanilla Cake',
                suggestedCategory: 'Cakes',
                confidence: 'high',
                tips: 'Make sure your butter is truly at room temperature for the fluffiest cake. Sift the flour for an extra-light texture.'
            },
            {
                ingredients: [
                    '300g dark chocolate (70% cocoa)',
                    '200g unsalted butter',
                    '4 large eggs',
                    '200g granulated sugar',
                    '100g all-purpose flour',
                    '2 tbsp cocoa powder',
                    '1 tsp espresso powder',
                    'Pinch of flaky sea salt'
                ],
                suggestedName: 'Rich Chocolate Brownies',
                suggestedCategory: 'Chocolates',
                confidence: 'medium',
                tips: 'Adding espresso powder intensifies the chocolate flavor without making it taste like coffee.'
            },
            {
                ingredients: [
                    '500g bread flour',
                    '10g active dry yeast',
                    '300ml warm water',
                    '30g sugar',
                    '50g unsalted butter (melted)',
                    '8g salt',
                    '1 egg (for egg wash)',
                    'Sesame seeds for topping'
                ],
                suggestedName: 'Artisan Bread Rolls',
                suggestedCategory: 'Breads',
                confidence: 'medium',
                tips: 'Allow the dough to rise in a warm spot for at least 1 hour. Patience is the secret to great bread!'
            }
        ],
        dish: [
            {
                ingredients: [
                    '400g puff pastry dough',
                    '300g pastry cream',
                    '200g fresh strawberries',
                    '100g apricot jam (for glaze)',
                    '2 tbsp powdered sugar',
                    '1 tsp vanilla bean paste',
                    'Fresh mint leaves for garnish'
                ],
                suggestedName: 'French Strawberry Tart',
                suggestedCategory: 'Pies & Tarts',
                confidence: 'high',
                tips: 'Brush the tart base with a thin layer of melted chocolate before adding the cream to prevent sogginess.'
            }
        ],
        menu: [
            {
                ingredients: [
                    '250g mascarpone cheese',
                    '300ml heavy cream',
                    '200g ladyfinger biscuits',
                    '200ml strong espresso (cooled)',
                    '3 egg yolks',
                    '100g sugar',
                    '2 tbsp Marsala wine',
                    'Cocoa powder for dusting'
                ],
                suggestedName: 'Classic Tiramisu',
                suggestedCategory: 'Desserts',
                confidence: 'high',
                tips: 'Use day-old espresso for the best flavor. Quick-dip the ladyfingers — don\'t soak them!'
            }
        ]
    };

    const category = mode || 'ingredients';
    const results = mockResults[category] || mockResults.ingredients;
    const randomIdx = Math.floor(Math.random() * results.length);

    return results[randomIdx];
}

export default router;
