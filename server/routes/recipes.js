
// Recipe Routes
import express from 'express';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Free tier limit
const FREE_RECIPE_LIMIT = 10;

// ===== Get All User Recipes =====
router.get('/', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT * FROM recipes WHERE user_id = $1 ORDER BY created_at DESC
        `, [req.user.userId]);

        const recipes = result.rows;

        const formattedRecipes = recipes.map(recipe => ({
            id: recipe.id,
            name: recipe.name,
            category: recipe.category,
            prepTime: recipe.prep_time,
            cookTime: recipe.cook_time,
            servings: recipe.servings,
            difficulty: recipe.difficulty,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            notes: recipe.notes,
            photo: recipe.photo,
            visibility: recipe.visibility,
            dateAdded: recipe.created_at
        }));

        res.json(formattedRecipes);

    } catch (error) {
        console.error('Get recipes error:', error);
        res.status(500).json({ error: 'Failed to get recipes' });
    }
});

// ===== Get Public Recipes (Home Feed) =====
router.get('/public', async (req, res) => {
    try {
        const db = getDatabase();
        // Join with users table to get author info
        const result = await db.query(`
            SELECT r.*, u.display_name as author_name, u.profile_picture as author_pic, u.username as author_username, u.is_admin as author_is_admin
            FROM recipes r
            JOIN users u ON r.user_id = u.id
            WHERE r.visibility = 'public'
            ORDER BY r.created_at DESC
            LIMIT 50
        `);

        // Check premium status for each author
        const recipes = [];
        for (const recipe of result.rows) {
            let authorIsPremium = recipe.author_is_admin === 1;
            if (!authorIsPremium) {
                const subCheck = await db.query(`
                    SELECT id FROM subscriptions 
                    WHERE user_id = $1 AND status = 'active' AND end_date::timestamp > NOW()
                    LIMIT 1
                `, [recipe.user_id]);
                authorIsPremium = subCheck.rows.length > 0;
            }
            recipes.push({
                id: recipe.id,
                name: recipe.name,
                category: recipe.category,
                prepTime: recipe.prep_time,
                cookTime: recipe.cook_time,
                servings: recipe.servings,
                difficulty: recipe.difficulty,
                ingredients: recipe.ingredients,
                instructions: recipe.instructions,
                notes: recipe.notes,
                photo: recipe.photo,
                visibility: recipe.visibility,
                dateAdded: recipe.created_at,
                author: {
                    username: recipe.author_username,
                    name: recipe.author_name,
                    pic: recipe.author_pic,
                    isPremium: authorIsPremium
                }
            });
        }

        res.json(recipes);

    } catch (error) {
        console.error('Get public recipes error:', error);
        res.status(500).json({ error: 'Failed to get public recipes' });
    }
});

// ===== Get Single Recipe =====
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT * FROM recipes WHERE id = $1 AND user_id = $2
        `, [req.params.id, req.user.userId]);

        const recipe = result.rows[0];

        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        res.json({
            id: recipe.id,
            name: recipe.name,
            category: recipe.category,
            prepTime: recipe.prep_time,
            cookTime: recipe.cook_time,
            servings: recipe.servings,
            difficulty: recipe.difficulty,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            notes: recipe.notes,
            photo: recipe.photo,
            visibility: recipe.visibility,
            dateAdded: recipe.created_at
        });

    } catch (error) {
        console.error('Get recipe error:', error);
        res.status(500).json({ error: 'Failed to get recipe' });
    }
});

// ===== Create Recipe =====
router.post('/', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const { name, category, prepTime, cookTime, servings, difficulty, ingredients, instructions, notes, photo } = req.body;

        // Validation
        if (!name || !category || !ingredients || !instructions) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check recipe limit for free users
        const userResult = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
        const user = userResult.rows[0];

        const subResult = await db.query(`
            SELECT * FROM subscriptions 
            WHERE user_id = $1 AND status = 'active' AND end_date::timestamp > NOW()
        `, [req.user.userId]);
        const subscription = subResult.rows[0];

        // Ensure is_admin is treated correctly as number or boolean from PG
        const isPremium = (user?.is_admin === 1) || (subscription != null);

        if (!isPremium) {
            const countResult = await db.query('SELECT COUNT(*) as count FROM recipes WHERE user_id = $1', [req.user.userId]);
            const recipeCount = parseInt(countResult.rows[0].count);

            if (recipeCount >= FREE_RECIPE_LIMIT) {
                return res.status(403).json({
                    error: 'Recipe limit reached',
                    message: `Free users can only save ${FREE_RECIPE_LIMIT} recipes. Upgrade to Premium for unlimited recipes!`,
                    requiresPremium: true
                });
            }
        }

        const insertResult = await db.query(`
            INSERT INTO recipes (user_id, name, category, prep_time, cook_time, servings, difficulty, ingredients, instructions, notes, photo, visibility)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            req.user.userId,
            name,
            category,
            prepTime || 0,
            cookTime || 0,
            servings || 1,
            difficulty || 'medium',
            ingredients,
            instructions,
            notes || null,
            photo || null,
            (req.body.visibility === 'public') ? 'public' : 'private'
        ]);

        const newRecipe = insertResult.rows[0];

        res.status(201).json({
            success: true,
            message: 'Recipe saved successfully',
            recipe: {
                id: newRecipe.id,
                name: newRecipe.name,
                category: newRecipe.category,
                prepTime: newRecipe.prep_time,
                cookTime: newRecipe.cook_time,
                servings: newRecipe.servings,
                difficulty: newRecipe.difficulty,
                ingredients: newRecipe.ingredients,
                instructions: newRecipe.instructions,
                notes: newRecipe.notes,
                photo: newRecipe.photo,
                visibility: newRecipe.visibility,
                dateAdded: newRecipe.created_at
            }
        });

    } catch (error) {
        console.error('Create recipe error:', error);
        res.status(500).json({ error: 'Failed to create recipe' });
    }
});

// ===== Update Recipe =====
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const { name, category, prepTime, cookTime, servings, difficulty, ingredients, instructions, notes, photo } = req.body;

        // Check premium status
        const userResult = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
        const user = userResult.rows[0];
        const subResult = await db.query(`
            SELECT * FROM subscriptions 
            WHERE user_id = $1 AND status = 'active' AND end_date::timestamp > NOW()
        `, [req.user.userId]);
        const subscription = subResult.rows[0];
        const isPremium = (user?.is_admin === 1) || (subscription != null);

        // Check if recipe exists and belongs to user
        const existingResult = await db.query('SELECT * FROM recipes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        const existingRecipe = existingResult.rows[0];

        if (!existingRecipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        await db.query(`
            UPDATE recipes SET
                name = $1,
                category = $2,
                prep_time = $3,
                cook_time = $4,
                servings = $5,
                difficulty = $6,
                ingredients = $7,
                instructions = $8,
                notes = $9,
                photo = $10,
                updated_at = NOW(),
                visibility = $13
            WHERE id = $11 AND user_id = $12
        `, [
            name || existingRecipe.name,
            category || existingRecipe.category,
            prepTime ?? existingRecipe.prep_time,
            cookTime ?? existingRecipe.cook_time,
            servings ?? existingRecipe.servings,
            difficulty || existingRecipe.difficulty,
            ingredients || existingRecipe.ingredients,
            instructions || existingRecipe.instructions,
            notes !== undefined ? notes : existingRecipe.notes,
            photo !== undefined ? photo : existingRecipe.photo,
            req.params.id,
            req.user.userId,
            (req.body.visibility === 'public') ? 'public' : 'private'
        ]);

        const updatedResult = await db.query('SELECT * FROM recipes WHERE id = $1', [req.params.id]);
        const updatedRecipe = updatedResult.rows[0];

        res.json({
            success: true,
            message: 'Recipe updated successfully',
            recipe: {
                id: updatedRecipe.id,
                name: updatedRecipe.name,
                category: updatedRecipe.category,
                prepTime: updatedRecipe.prep_time,
                cookTime: updatedRecipe.cook_time,
                servings: updatedRecipe.servings,
                difficulty: updatedRecipe.difficulty,
                ingredients: updatedRecipe.ingredients,
                instructions: updatedRecipe.instructions,
                notes: updatedRecipe.notes,
                photo: updatedRecipe.photo,
                dateAdded: updatedRecipe.created_at
            }
        });

    } catch (error) {
        console.error('Update recipe error:', error);
        res.status(500).json({ error: 'Failed to update recipe' });
    }
});

// ===== Delete Recipe =====
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();

        // Check if recipe exists and belongs to user
        const recipeResult = await db.query('SELECT id FROM recipes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);

        if (recipeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        await db.query('DELETE FROM recipes WHERE id = $1', [req.params.id]);

        res.json({ success: true, message: 'Recipe deleted successfully' });

    } catch (error) {
        console.error('Delete recipe error:', error);
        res.status(500).json({ error: 'Failed to delete recipe' });
    }
});

// ===== Delete All Recipes =====
router.delete('/', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();

        const result = await db.query('DELETE FROM recipes WHERE user_id = $1', [req.user.userId]);

        res.json({
            success: true,
            message: `Deleted ${result.rowCount} recipes`
        });

    } catch (error) {
        console.error('Delete all recipes error:', error);
        res.status(500).json({ error: 'Failed to delete recipes' });
    }
});

// ===== Get Recipe Count =====
router.get('/count/total', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query('SELECT COUNT(*) as count FROM recipes WHERE user_id = $1', [req.user.userId]);

        res.json({ count: parseInt(result.rows[0].count) });

    } catch (error) {
        console.error('Get recipe count error:', error);
        res.status(500).json({ error: 'Failed to get recipe count' });
    }
});

export default router;
