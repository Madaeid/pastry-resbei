// Nutritional Analysis Routes
// AI-powered calorie and macro analysis of recipe ingredients using Gemini
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ===== Analyze Nutrition from Ingredients =====
// POST /api/nutrition/analyze
router.post('/analyze', authenticateToken, async (req, res) => {
    try {
        const { ingredients, servings } = req.body;

        if (!ingredients || (typeof ingredients !== 'string' && !Array.isArray(ingredients))) {
            return res.status(400).json({ error: 'Please provide ingredients as text or array.' });
        }

        // Normalize ingredients to a single string
        const ingredientsText = Array.isArray(ingredients)
            ? ingredients.join('\n')
            : ingredients;

        const lines = ingredientsText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) {
            return res.status(400).json({ error: 'No valid ingredients provided.' });
        }

        if (lines.length > 50) {
            return res.status(400).json({ error: 'Too many ingredients. Please provide up to 50.' });
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
            console.log('⚠️ No Gemini API key configured — using mock nutrition response');
            return res.json(generateMockNutrition(lines, parseInt(servings) || 1));
        }

        // Build the prompt
        const prompt = buildNutritionPrompt(ingredientsText, parseInt(servings) || 1);

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
                        temperature: 0.2,
                        topP: 0.8,
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
                error: 'AI could not analyze the nutrition. Please try again.'
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
                console.error('Failed to parse AI nutrition response:', aiText);
                return res.status(502).json({
                    error: 'AI response was unclear. Please try again.'
                });
            }
        }

        // Normalize the response
        const normalizedResult = {
            totalPerRecipe: {
                calories: Math.round(result.totalPerRecipe?.calories || 0),
                protein: Math.round((result.totalPerRecipe?.protein || 0) * 10) / 10,
                carbs: Math.round((result.totalPerRecipe?.carbs || 0) * 10) / 10,
                fat: Math.round((result.totalPerRecipe?.fat || 0) * 10) / 10,
                fiber: Math.round((result.totalPerRecipe?.fiber || 0) * 10) / 10,
                sugar: Math.round((result.totalPerRecipe?.sugar || 0) * 10) / 10,
                sodium: Math.round(result.totalPerRecipe?.sodium || 0)
            },
            perServing: {
                calories: Math.round(result.perServing?.calories || 0),
                protein: Math.round((result.perServing?.protein || 0) * 10) / 10,
                carbs: Math.round((result.perServing?.carbs || 0) * 10) / 10,
                fat: Math.round((result.perServing?.fat || 0) * 10) / 10,
                fiber: Math.round((result.perServing?.fiber || 0) * 10) / 10,
                sugar: Math.round((result.perServing?.sugar || 0) * 10) / 10,
                sodium: Math.round(result.perServing?.sodium || 0)
            },
            servings: parseInt(servings) || result.servings || 1,
            items: Array.isArray(result.items) ? result.items.map(item => ({
                name: item.name || '',
                quantity: item.quantity || '',
                calories: Math.round(item.calories || 0),
                protein: Math.round((item.protein || 0) * 10) / 10,
                carbs: Math.round((item.carbs || 0) * 10) / 10,
                fat: Math.round((item.fat || 0) * 10) / 10
            })) : [],
            healthScore: result.healthScore || result.health_score || 'moderate',
            healthTip: result.healthTip || result.health_tip || '',
            allergens: Array.isArray(result.allergens) ? result.allergens : [],
            confidence: result.confidence || 'medium'
        };

        res.json(normalizedResult);

    } catch (error) {
        console.error('Nutrition analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze nutrition. Please try again.' });
    }
});

// ===== Nutrition Analysis Prompt Builder =====
function buildNutritionPrompt(ingredientsText, servings) {
    return `You are an expert nutritionist and food scientist. Analyze the following recipe ingredients and calculate accurate nutritional values.

**Ingredients:**
${ingredientsText}

**Servings:** ${servings}

Use standard USDA nutritional databases as reference. Parse natural language ingredient descriptions to determine quantities (e.g., "2 cups flour" = ~250g, "3 large eggs" = ~150g, "a pinch of salt" = ~1g).

Respond in JSON format with these exact fields:
{
  "totalPerRecipe": {
    "calories": number (kcal, total for entire recipe),
    "protein": number (grams),
    "carbs": number (grams),
    "fat": number (grams),
    "fiber": number (grams),
    "sugar": number (grams),
    "sodium": number (mg)
  },
  "perServing": {
    "calories": number (kcal, per single serving),
    "protein": number (grams),
    "carbs": number (grams),
    "fat": number (grams),
    "fiber": number (grams),
    "sugar": number (grams),
    "sodium": number (mg)
  },
  "servings": ${servings},
  "items": [
    {
      "name": "ingredient name",
      "quantity": "original quantity text",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number
    }
  ],
  "healthScore": "healthy" | "moderate" | "indulgent",
  "healthTip": "One short, practical nutritional tip about this recipe (1-2 sentences)",
  "allergens": ["list of common allergens detected, e.g., gluten, dairy, eggs, nuts, soy"],
  "confidence": "high" | "medium" | "low"
}

Be as accurate as possible with the nutritional calculations. If quantities are ambiguous, use standard recipe amounts.`;
}

// ===== Mock Nutrition for Development =====
function generateMockNutrition(ingredientLines, servings) {
    // Simple mock that estimates based on common ingredient keywords
    const mockItems = ingredientLines.map(line => {
        const lower = line.toLowerCase();
        let cals = 50, prot = 1, carbs = 5, fat = 2;

        if (lower.includes('flour')) { cals = 455; prot = 13; carbs = 95; fat = 1.2; }
        else if (lower.includes('sugar')) { cals = 387; prot = 0; carbs = 100; fat = 0; }
        else if (lower.includes('butter')) { cals = 717; prot = 0.9; carbs = 0.1; fat = 81; }
        else if (lower.includes('egg')) { cals = 155; prot = 13; carbs = 1.1; fat = 11; }
        else if (lower.includes('milk') || lower.includes('cream')) { cals = 149; prot = 3.2; carbs = 4.7; fat = 8; }
        else if (lower.includes('chocolate')) { cals = 546; prot = 5; carbs = 60; fat = 31; }
        else if (lower.includes('vanilla')) { cals = 12; prot = 0; carbs = 0.5; fat = 0; }
        else if (lower.includes('salt')) { cals = 0; prot = 0; carbs = 0; fat = 0; }
        else if (lower.includes('baking')) { cals = 5; prot = 0; carbs = 1.3; fat = 0; }
        else if (lower.includes('oil')) { cals = 884; prot = 0; carbs = 0; fat = 100; }
        else if (lower.includes('honey')) { cals = 304; prot = 0.3; carbs = 82; fat = 0; }
        else if (lower.includes('cheese') || lower.includes('mascarpone')) { cals = 350; prot = 5; carbs = 4; fat = 35; }
        else if (lower.includes('berr') || lower.includes('fruit') || lower.includes('strawberr')) { cals = 32; prot = 0.7; carbs = 7.7; fat = 0.3; }
        else if (lower.includes('almond') || lower.includes('nut')) { cals = 579; prot = 21; carbs = 22; fat = 50; }
        else if (lower.includes('cocoa')) { cals = 228; prot = 20; carbs = 58; fat = 14; }
        else if (lower.includes('yeast')) { cals = 105; prot = 14; carbs = 12; fat = 2; }
        else if (lower.includes('water')) { cals = 0; prot = 0; carbs = 0; fat = 0; }

        // Scale down by rough quantity parsing
        let scale = 0.25; // Default: assume ~quarter of a "unit"
        const qtyMatch = line.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l|cup|tbsp|tsp|oz)/i);
        if (qtyMatch) {
            const qty = parseFloat(qtyMatch[1]);
            const unit = qtyMatch[2].toLowerCase();
            if (unit === 'g') scale = qty / 100;
            else if (unit === 'kg') scale = qty * 10;
            else if (unit === 'ml' || unit === 'l') scale = unit === 'l' ? qty * 10 : qty / 100;
            else if (unit === 'cup') scale = qty * 2.4;
            else if (unit === 'tbsp') scale = qty * 0.15;
            else if (unit === 'tsp') scale = qty * 0.05;
            else if (unit === 'oz') scale = qty * 0.28;
        }

        return {
            name: line.replace(/^\d+[\.\)]\s*/, '').trim(),
            quantity: line,
            calories: Math.round(cals * scale),
            protein: Math.round(prot * scale * 10) / 10,
            carbs: Math.round(carbs * scale * 10) / 10,
            fat: Math.round(fat * scale * 10) / 10
        };
    });

    const totalCals = mockItems.reduce((s, i) => s + i.calories, 0);
    const totalProt = mockItems.reduce((s, i) => s + i.protein, 0);
    const totalCarbs = mockItems.reduce((s, i) => s + i.carbs, 0);
    const totalFat = mockItems.reduce((s, i) => s + i.fat, 0);

    const serv = servings || 1;

    // Detect common allergens from ingredient text
    const allText = ingredientLines.join(' ').toLowerCase();
    const allergens = [];
    if (allText.includes('flour') || allText.includes('bread') || allText.includes('wheat')) allergens.push('Gluten');
    if (allText.includes('milk') || allText.includes('cream') || allText.includes('butter') || allText.includes('cheese')) allergens.push('Dairy');
    if (allText.includes('egg')) allergens.push('Eggs');
    if (allText.includes('nut') || allText.includes('almond') || allText.includes('walnut') || allText.includes('pecan')) allergens.push('Tree Nuts');
    if (allText.includes('peanut')) allergens.push('Peanuts');
    if (allText.includes('soy')) allergens.push('Soy');

    // Health score
    const calPerServing = totalCals / serv;
    let healthScore = 'moderate';
    if (calPerServing > 500) healthScore = 'indulgent';
    else if (calPerServing < 200) healthScore = 'healthy';

    return {
        totalPerRecipe: {
            calories: Math.round(totalCals),
            protein: Math.round(totalProt * 10) / 10,
            carbs: Math.round(totalCarbs * 10) / 10,
            fat: Math.round(totalFat * 10) / 10,
            fiber: Math.round(totalCarbs * 0.08 * 10) / 10,
            sugar: Math.round(totalCarbs * 0.4 * 10) / 10,
            sodium: Math.round(200 + Math.random() * 300)
        },
        perServing: {
            calories: Math.round(totalCals / serv),
            protein: Math.round(totalProt / serv * 10) / 10,
            carbs: Math.round(totalCarbs / serv * 10) / 10,
            fat: Math.round(totalFat / serv * 10) / 10,
            fiber: Math.round(totalCarbs * 0.08 / serv * 10) / 10,
            sugar: Math.round(totalCarbs * 0.4 / serv * 10) / 10,
            sodium: Math.round((200 + Math.random() * 300) / serv)
        },
        servings: serv,
        items: mockItems,
        healthScore,
        healthTip: healthScore === 'indulgent'
            ? 'This is a rich recipe — consider reducing sugar or butter by 10-15% for a lighter version without sacrificing taste.'
            : healthScore === 'healthy'
                ? 'Great choice! This recipe is relatively light. Adding a handful of nuts could boost healthy fats and protein.'
                : 'A balanced recipe. To boost nutrition, consider using whole-grain flour or adding fresh fruit as a topping.',
        allergens,
        confidence: 'medium'
    };
}

export default router;
