// AI Ingredient Scanner Routes
// Premium-only feature: Scan photos to identify ingredients using Gemini Vision AI
import express from 'express';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();

// ===== Premium Gate Middleware =====
async function requirePremium(req, res, next) {
    try {
        const db = getDatabase();

        // Check admin status (admins get free premium)
        const userResult = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
        const user = userResult.rows[0];

        if (user?.is_admin) {
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
                                inlineData: {
                                    mimeType: mimeType,
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
    const randomIdx = crypto.randomInt(0, results.length);

    return results[randomIdx];
}

// ===== Generate Recipe from Ingredients =====
// POST /api/scanner/generate-recipe
router.post('/generate-recipe', authenticateToken, requirePremium, async (req, res) => {
    try {
        const { ingredients, category, difficulty, servings, dietaryNotes } = req.body;

        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            return res.status(400).json({ error: 'Please provide at least one ingredient.' });
        }

        if (ingredients.length > 30) {
            return res.status(400).json({ error: 'Too many ingredients. Please provide up to 30.' });
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
            console.log('⚠️ No Gemini API key configured — using mock recipe response');
            return res.json(generateMockRecipe(ingredients, category, difficulty));
        }

        // Build the prompt
        const prompt = buildRecipeGeneratorPrompt(ingredients, category, difficulty, servings, dietaryNotes);

        // Call Gemini API
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.9,
                        maxOutputTokens: 3000,
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
        const aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiText) {
            return res.status(502).json({
                error: 'AI could not generate a recipe. Try different ingredients.'
            });
        }

        // Parse the JSON response from Gemini
        let result;
        try {
            result = JSON.parse(aiText);
        } catch (parseErr) {
            const jsonMatch = aiText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                console.error('Failed to parse AI recipe response:', aiText);
                return res.status(502).json({
                    error: 'AI response was unclear. Please try again.'
                });
            }
        }

        // Normalize the response
        const normalizedResult = {
            name: result.name || result.recipeName || 'Untitled Recipe',
            category: result.category || category || 'Other',
            difficulty: result.difficulty || difficulty || 'Medium',
            prepTime: parseInt(result.prepTime || result.prep_time) || 15,
            cookTime: parseInt(result.cookTime || result.cook_time) || 30,
            servings: parseInt(result.servings) || parseInt(servings) || 4,
            ingredients: Array.isArray(result.ingredients)
                ? result.ingredients.join('\n')
                : (result.ingredients || ''),
            instructions: Array.isArray(result.instructions)
                ? result.instructions.map((step, i) => `${i + 1}. ${step}`).join('\n')
                : (result.instructions || ''),
            notes: result.notes || result.tips || '',
            description: result.description || ''
        };

        res.json(normalizedResult);

    } catch (error) {
        console.error('Recipe generator error:', error);
        res.status(500).json({ error: 'Failed to generate recipe. Please try again.' });
    }
});

// ===== Recipe Generator Prompt Builder =====
function buildRecipeGeneratorPrompt(ingredients, category, difficulty, servings, dietaryNotes) {
    const ingredientsList = ingredients.join(', ');

    let prompt = `You are a world-class pastry chef and recipe creator. A chef has the following ingredients available:

**Available Ingredients:** ${ingredientsList}

Create ONE complete, professional-quality recipe using these ingredients as the primary components. You may add common pantry staples (salt, pepper, oil, water) if needed, but the recipe MUST primarily feature the provided ingredients.`;

    if (category) {
        prompt += `\n\n**Preferred Category:** ${category} — Try to create a recipe in this category if possible.`;
    }

    if (difficulty) {
        prompt += `\n**Difficulty Level:** ${difficulty} — Adjust technique complexity accordingly.`;
    }

    if (servings) {
        prompt += `\n**Target Servings:** ${servings}`;
    }

    if (dietaryNotes) {
        prompt += `\n**Dietary Notes:** ${dietaryNotes}`;
    }

    prompt += `

Respond in JSON format with these exact fields:
{
  "name": "Creative and appealing recipe name",
  "description": "One-sentence description of the dish (appetizing and inviting)",
  "category": "One of: Cakes, Cookies, Pastries, Pies & Tarts, Breads, Desserts, Chocolates, Other",
  "difficulty": "Easy, Medium, or Hard",
  "prepTime": number (minutes),
  "cookTime": number (minutes),
  "servings": number,
  "ingredients": ["ingredient 1 with exact quantity", "ingredient 2 with exact quantity", ...],
  "instructions": ["Clear step 1 without numbering", "Clear step 2 without numbering", ...],
  "notes": "Professional chef tips, variations, and serving suggestions (2-3 sentences)"
}

Make the recipe creative, detailed, and professional. Include precise measurements and clear instructions.`;

    return prompt;
}

// ===== Mock Recipe for Development =====
function generateMockRecipe(ingredients, category, difficulty) {
    const mockRecipes = [
        {
            name: 'Rustic Berry Galette',
            description: 'A free-form French pastry with a buttery crust and jewel-toned berry filling.',
            category: category || 'Pastries',
            difficulty: difficulty || 'Medium',
            prepTime: 25,
            cookTime: 35,
            servings: 6,
            ingredients: '250g all-purpose flour\n150g cold unsalted butter, cubed\n1 tbsp sugar\n¼ tsp salt\n60ml ice water\n300g mixed berries\n50g sugar\n1 tbsp cornstarch\n1 tsp lemon zest\n1 egg (for egg wash)\nDemerara sugar for sprinkling',
            instructions: '1. Pulse flour, sugar, salt, and cold butter in a food processor until pea-sized crumbles form. Drizzle ice water and pulse until the dough just holds together.\n2. Shape into a disk, wrap in cling film, and refrigerate for at least 30 minutes.\n3. Preheat oven to 200°C (400°F). Line a baking sheet with parchment paper.\n4. Toss berries with sugar, cornstarch, and lemon zest in a bowl.\n5. Roll the chilled dough into a rough 30cm circle on a floured surface.\n6. Transfer to the baking sheet. Arrange berry mixture in the center, leaving a 5cm border.\n7. Fold the edges up and over the filling, pleating as you go.\n8. Brush the crust with beaten egg and sprinkle with Demerara sugar.\n9. Bake for 30-35 minutes until the crust is deep golden and the filling is bubbling.\n10. Cool for 10 minutes before slicing. Serve with vanilla ice cream.',
            notes: '💡 Chef\'s Tip: Keep the butter ice-cold for the flakiest crust. You can substitute any seasonal fruit. The rustic, imperfect shape is part of the charm — don\'t worry about making it perfect!'
        },
        {
            name: 'Velvet Chocolate Mousse Cups',
            description: 'Silky-smooth dark chocolate mousse served in elegant portions with a hint of espresso.',
            category: category || 'Desserts',
            difficulty: difficulty || 'Easy',
            prepTime: 20,
            cookTime: 5,
            servings: 4,
            ingredients: '200g dark chocolate (70% cocoa)\n3 large eggs, separated\n30g sugar\n200ml heavy cream\n1 tsp instant espresso powder\n1 tsp vanilla extract\nPinch of salt\nCocoa powder for dusting\nWhipped cream for serving',
            instructions: '1. Melt chocolate with espresso powder in a heatproof bowl over simmering water. Remove from heat and let cool for 5 minutes.\n2. Whisk egg yolks into the melted chocolate one at a time until smooth and glossy.\n3. In a separate bowl, whip cream with vanilla until soft peaks form. Set aside.\n4. In another clean bowl, whisk egg whites with salt until foamy, then gradually add sugar and beat to stiff peaks.\n5. Gently fold one-third of the whipped cream into the chocolate mixture to lighten it.\n6. Fold in the remaining whipped cream, then gently fold in the egg whites in two additions.\n7. Divide the mousse among serving cups or glasses.\n8. Refrigerate for at least 2 hours (or overnight) until set.\n9. Before serving, dust with cocoa powder and add a dollop of whipped cream.',
            notes: '💡 Chef\'s Tip: The espresso doesn\'t make it taste like coffee — it deepens the chocolate flavor. For a boozy twist, add 1 tbsp Grand Marnier or Baileys to the melted chocolate.'
        },
        {
            name: 'Golden Almond Financiers',
            description: 'Petite French tea cakes with nutty brown butter and crisp golden edges.',
            category: category || 'Cakes',
            difficulty: difficulty || 'Medium',
            prepTime: 15,
            cookTime: 18,
            servings: 12,
            ingredients: '100g unsalted butter\n90g almond flour\n120g powdered sugar\n40g all-purpose flour\n4 large egg whites\n1 tsp vanilla extract\n¼ tsp almond extract\nPinch of salt\nSliced almonds for topping\nButter and flour for greasing molds',
            instructions: '1. Make brown butter: Melt butter in a small saucepan over medium heat. Continue cooking, swirling, until it turns golden amber and smells nutty (about 5 minutes). Set aside to cool slightly.\n2. Preheat oven to 190°C (375°F). Grease and flour a financier or mini muffin pan.\n3. Whisk together almond flour, powdered sugar, all-purpose flour, and salt in a large bowl.\n4. Add egg whites and extracts. Whisk until smooth and combined.\n5. Pour in the warm brown butter (leaving behind any dark sediment) and fold until incorporated.\n6. Fill each mold about three-quarters full. Top each with a few sliced almonds.\n7. Bake for 14-18 minutes until the edges are deeply golden and the centers spring back.\n8. Cool in the pan for 5 minutes, then unmold onto a wire rack.\n9. Serve warm or at room temperature. Best eaten the same day.',
            notes: '💡 Chef\'s Tip: The brown butter is the secret — don\'t skip this step! These freeze beautifully for up to 1 month. Reheat briefly in a warm oven to restore the crisp edges.'
        }
    ];

    const randomIdx = crypto.randomInt(0, mockRecipes.length);
    return mockRecipes[randomIdx];
}

export default router;
