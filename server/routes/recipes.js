// Recipe Routes
import express from 'express';
import { getDatabase } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Free tier limit
const FREE_RECIPE_LIMIT = 10;

// ===== Get All User Recipes =====
router.get('/', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const recipes = db.prepare(`
            SELECT * FROM recipes WHERE user_id = ? ORDER BY created_at DESC
        `).all(req.user.userId);

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
            dateAdded: recipe.created_at
        }));

        res.json(formattedRecipes);

    } catch (error) {
        console.error('Get recipes error:', error);
        res.status(500).json({ error: 'Failed to get recipes' });
    }
});

// ===== Get Single Recipe =====
router.get('/:id', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const recipe = db.prepare(`
            SELECT * FROM recipes WHERE id = ? AND user_id = ?
        `).get(req.params.id, req.user.userId);

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
            dateAdded: recipe.created_at
        });

    } catch (error) {
        console.error('Get recipe error:', error);
        res.status(500).json({ error: 'Failed to get recipe' });
    }
});

// ===== Create Recipe =====
router.post('/', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const { name, category, prepTime, cookTime, servings, difficulty, ingredients, instructions, notes, photo } = req.body;

        // Validation
        if (!name || !category || !ingredients || !instructions) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check recipe limit for free users
        const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.userId);
        const subscription = db.prepare('SELECT * FROM subscriptions WHERE user_id = ? AND status = "active" AND end_date > datetime("now")').get(req.user.userId);

        const isPremium = user?.is_admin === 1 || subscription != null;

        if (!isPremium) {
            const recipeCount = db.prepare('SELECT COUNT(*) as count FROM recipes WHERE user_id = ?').get(req.user.userId);
            if (recipeCount.count >= FREE_RECIPE_LIMIT) {
                return res.status(403).json({
                    error: 'Recipe limit reached',
                    message: `Free users can only save ${FREE_RECIPE_LIMIT} recipes. Upgrade to Premium for unlimited recipes!`,
                    requiresPremium: true
                });
            }
        }

        const result = db.prepare(`
            INSERT INTO recipes (user_id, name, category, prep_time, cook_time, servings, difficulty, ingredients, instructions, notes, photo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
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
            photo || null
        );

        const newRecipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(result.lastInsertRowid);

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
                dateAdded: newRecipe.created_at
            }
        });

    } catch (error) {
        console.error('Create recipe error:', error);
        res.status(500).json({ error: 'Failed to create recipe' });
    }
});

// ===== Update Recipe =====
router.put('/:id', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const { name, category, prepTime, cookTime, servings, difficulty, ingredients, instructions, notes, photo } = req.body;

        // Check if recipe exists and belongs to user
        const existingRecipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
        if (!existingRecipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        db.prepare(`
            UPDATE recipes SET
                name = ?,
                category = ?,
                prep_time = ?,
                cook_time = ?,
                servings = ?,
                difficulty = ?,
                ingredients = ?,
                instructions = ?,
                notes = ?,
                photo = ?,
                updated_at = ?
            WHERE id = ? AND user_id = ?
        `).run(
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
            new Date().toISOString(),
            req.params.id,
            req.user.userId
        );

        const updatedRecipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);

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
router.delete('/:id', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();

        // Check if recipe exists and belongs to user
        const recipe = db.prepare('SELECT id FROM recipes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);

        res.json({ success: true, message: 'Recipe deleted successfully' });

    } catch (error) {
        console.error('Delete recipe error:', error);
        res.status(500).json({ error: 'Failed to delete recipe' });
    }
});

// ===== Delete All Recipes =====
router.delete('/', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();

        const result = db.prepare('DELETE FROM recipes WHERE user_id = ?').run(req.user.userId);

        res.json({
            success: true,
            message: `Deleted ${result.changes} recipes`
        });

    } catch (error) {
        console.error('Delete all recipes error:', error);
        res.status(500).json({ error: 'Failed to delete recipes' });
    }
});

// ===== Get Recipe Count =====
router.get('/count/total', authenticateToken, (req, res) => {
    try {
        const db = getDatabase();
        const result = db.prepare('SELECT COUNT(*) as count FROM recipes WHERE user_id = ?').get(req.user.userId);

        res.json({ count: result.count });

    } catch (error) {
        console.error('Get recipe count error:', error);
        res.status(500).json({ error: 'Failed to get recipe count' });
    }
});

export default router;
