import { uploadMedia } from '../utils/cloudinary.js';

// Recipe Routes
import express from 'express';
import { getDatabase } from '../database/db.js';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Free tier limit
const FREE_RECIPE_LIMIT = 10;

// ===== Get All User Recipes =====
router.get('/', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const currentUserId = req.user.userId;

        const result = await db.query(`
            SELECT 
                r.*,
                (SELECT COUNT(*) FROM recipe_likes WHERE recipe_id = r.id) as likes_count,
                (SELECT COUNT(*) FROM recipe_shares WHERE recipe_id = r.id) as shares_count,
                COALESCE(
                    (SELECT json_agg(comment_data)
                     FROM (
                         SELECT 
                             c.id, c.user_id as "userId", c.comment_text as text, c.created_at as "dateAdded", c.parent_id as "parentId",
                             u.display_name as "authorName", u.profile_picture as "authorPic", u.username as "authorUsername",
                             (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as likes,
                             EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = $1) as "isLikedByMe"
                         FROM recipe_comments c
                         JOIN users u ON c.user_id = u.id
                         WHERE c.recipe_id = r.id
                         ORDER BY c.created_at ASC
                     ) comment_data
                    ), '[]'
                ) as comments_list
            FROM recipes r
            WHERE r.user_id = $1
            ORDER BY r.created_at DESC
        `, [currentUserId]);

        const formattedRecipes = result.rows.map(recipe => ({
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
            video: recipe.video,
            visibility: recipe.visibility,
            dateAdded: recipe.created_at,
            author: { userId: recipe.user_id },
            likes: parseInt(recipe.likes_count),
            shares: parseInt(recipe.shares_count),
            comments: recipe.comments_list
        }));

        res.json(formattedRecipes);

    } catch (error) {
        console.error('Get recipes error:', error);
        res.status(500).json({ error: 'Failed to get recipes' });
    }
});

// ===== Get Public Recipes (Home Feed) =====
router.get('/public', optionalAuthenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const currentUserId = req.user ? req.user.userId : null;

        const result = await db.query(`
            SELECT 
                r.*, 
                u.display_name as author_name, u.profile_picture as author_pic, u.username as author_username, u.is_admin as author_is_admin,
                -- Premium status check
                (u.is_admin = 1 OR EXISTS(
                    SELECT 1 FROM subscriptions s 
                    WHERE s.user_id = r.user_id AND s.status = 'active' AND s.end_date::timestamp > NOW()
                )) as author_is_premium,
                -- Info from original standard recipe
                orig_r.id as orig_id, orig_r.name as orig_name, orig_r.category as orig_category, 
                orig_r.prep_time as orig_prep_time, orig_r.cook_time as orig_cook_time, orig_r.servings as orig_servings, 
                orig_r.difficulty as orig_difficulty, orig_r.ingredients as orig_ingredients,
                orig_r.instructions as orig_instructions, orig_r.photo as orig_photo, orig_r.video as orig_video,
                orig_u.profile_picture as orig_author_pic, orig_u.display_name as orig_author_name, orig_u.username as orig_author_username,
                -- Info from original store recipe
                sr.id as store_id, sr.name as store_name, sr.category as store_category,
                sr.prep_time as store_prep_time, sr.cook_time as store_cook_time, 
                sr.difficulty as store_difficulty, sr.ingredients as store_ingredients, 
                sr.instructions as store_instructions, sr.photo as store_photo, sr.video as store_video,
                su.profile_picture as store_author_pic, su.display_name as store_author_name, su.username as store_author_username,
                -- Social counts
                (SELECT COUNT(*) FROM recipe_likes WHERE recipe_id = r.id) as likes_count,
                (SELECT COUNT(*) FROM recipe_shares WHERE recipe_id = r.id) as shares_count,
                -- Comments
                COALESCE(
                    (SELECT json_agg(comment_data)
                     FROM (
                         SELECT 
                             c.id, c.user_id as "userId", c.comment_text as text, c.created_at as "dateAdded", c.parent_id as "parentId",
                             cu.display_name as "authorName", cu.profile_picture as "authorPic", cu.username as "authorUsername",
                             (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as likes,
                             EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = $1) as "isLikedByMe"
                         FROM recipe_comments c
                         JOIN users cu ON c.user_id = cu.id
                         WHERE c.recipe_id = r.id
                         ORDER BY c.created_at ASC
                     ) comment_data
                    ), '[]'
                ) as comments_list
            FROM recipes r
            LEFT JOIN recipes orig_r ON r.shared_from_id = orig_r.id
            LEFT JOIN users orig_u ON orig_r.user_id = orig_u.id
            LEFT JOIN store_recipes sr ON r.shared_from_store_id = sr.id
            LEFT JOIN users su ON sr.seller_id = su.id
            JOIN users u ON r.user_id = u.id
            WHERE r.visibility = 'public'
            ORDER BY r.created_at DESC
            LIMIT 50
        `, [currentUserId]);

        const recipes = result.rows.map(recipe => ({
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
            video: recipe.video,
            visibility: recipe.visibility,
            dateAdded: recipe.created_at,
            author: {
                userId: recipe.user_id,
                username: recipe.author_username,
                name: recipe.author_name,
                pic: recipe.author_pic,
                isPremium: recipe.author_is_premium
            },
            likes: parseInt(recipe.likes_count),
            shares: parseInt(recipe.shares_count),
            comments: recipe.comments_list,
            sharedFrom: recipe.orig_id ? {
                id: recipe.orig_id,
                name: recipe.orig_name,
                category: recipe.orig_category,
                prepTime: recipe.orig_prep_time,
                cookTime: recipe.orig_cook_time,
                servings: recipe.orig_servings,
                difficulty: recipe.orig_difficulty,
                ingredients: recipe.orig_ingredients,
                instructions: recipe.orig_instructions,
                photo: recipe.orig_photo,
                video: recipe.orig_video,
                author: {
                    name: recipe.orig_author_name,
                    username: recipe.orig_author_username,
                    pic: recipe.orig_author_pic || null
                }
            } : (recipe.store_id ? {
                id: recipe.store_id,
                name: recipe.store_name,
                category: recipe.store_category,
                prepTime: recipe.store_prep_time,
                cookTime: recipe.store_cook_time,
                servings: 1,
                difficulty: recipe.store_difficulty,
                ingredients: '🔒 Purchase to view ingredients',
                instructions: '🔒 Purchase to view instructions',
                photo: recipe.store_photo,
                video: recipe.store_video,
                isStore: true,
                author: {
                    name: recipe.store_author_name,
                    username: recipe.store_author_username,
                    pic: recipe.store_author_pic || null
                }
            } : null)
        }));

        res.json(recipes);

    } catch (error) {
        console.error('Get public recipes error:', error);
        res.status(500).json({ error: 'Failed to get public recipes' });
    }
});

// ===== Get Public Recipes for a Specific User =====
router.get('/public/user/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const db = getDatabase();
        
        // First get the user id
        const userRes = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userId = userRes.rows[0].id;

        // Optimized query for user's public recipes
        const result = await db.query(`
            SELECT 
                r.*, u.display_name as author_name, u.profile_picture as author_pic, u.username as author_username, u.is_admin as author_is_admin,
                -- Premium status check
                (u.is_admin = 1 OR EXISTS(
                    SELECT 1 FROM subscriptions s 
                    WHERE s.user_id = r.user_id AND s.status = 'active' AND s.end_date::timestamp > NOW()
                )) as author_is_premium,
                -- Info from original shared recipe
                orig_r.id as orig_id, orig_r.instructions as orig_instructions, orig_r.photo as orig_photo, orig_r.video as orig_video,
                orig_u.profile_picture as orig_author_pic, orig_u.display_name as orig_author_name, orig_u.username as orig_author_username,
                -- Social counts
                (SELECT COUNT(*) FROM recipe_likes WHERE recipe_id = r.id) as likes_count,
                (SELECT COUNT(*) FROM recipe_shares WHERE recipe_id = r.id) as shares_count,
                -- Comments
                COALESCE(
                    (SELECT json_agg(comment_data)
                     FROM (
                         SELECT 
                             c.id, c.user_id as "userId", c.comment_text as text, c.created_at as "dateAdded",
                             cu.display_name as "authorName", cu.profile_picture as "authorPic", cu.username as "authorUsername"
                         FROM recipe_comments c
                         JOIN users cu ON c.user_id = cu.id
                         WHERE c.recipe_id = r.id
                         ORDER BY c.created_at ASC
                     ) comment_data
                    ), '[]'
                ) as comments_list
            FROM recipes r
            LEFT JOIN recipes orig_r ON r.shared_from_id = orig_r.id
            LEFT JOIN users orig_u ON orig_r.user_id = orig_u.id
            JOIN users u ON r.user_id = u.id
            WHERE r.user_id = $1 AND r.visibility = 'public'
            ORDER BY r.created_at DESC
        `, [userId]);

        const recipes = result.rows.map(recipe => ({
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
            video: recipe.video,
            visibility: recipe.visibility,
            dateAdded: recipe.created_at,
            author: {
                userId: recipe.user_id,
                username: recipe.author_username,
                name: recipe.author_name,
                pic: recipe.author_pic,
                isPremium: recipe.author_is_premium
            },
            likes: parseInt(recipe.likes_count),
            shares: parseInt(recipe.shares_count),
            comments: recipe.comments_list,
            sharedFrom: recipe.orig_id ? {
                id: recipe.orig_id,
                instructions: recipe.orig_instructions,
                photo: recipe.orig_photo,
                video: recipe.orig_video,
                author: {
                    name: recipe.orig_author_name,
                    username: recipe.orig_author_username,
                    pic: recipe.orig_author_pic || null
                }
            } : null
        }));

        res.json(recipes);
    } catch (error) {
        console.error('Get user public recipes error:', error);
        res.status(500).json({ error: 'Failed to get user public recipes' });
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
            video: recipe.video,
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
        let { name, category, prepTime, cookTime, servings, difficulty, ingredients, instructions, notes, photo, video } = req.body;
        if (photo) photo = await uploadMedia(photo, 'recipes');
        if (video) video = await uploadMedia(video, 'recipes');

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
            INSERT INTO recipes (user_id, name, category, prep_time, cook_time, servings, difficulty, ingredients, instructions, notes, photo, video, visibility)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
            video || null,
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
                video: newRecipe.video,
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
        let { name, category, prepTime, cookTime, servings, difficulty, ingredients, instructions, notes, photo, video } = req.body;
        if (photo) photo = await uploadMedia(photo, 'recipes');
        if (video) video = await uploadMedia(video, 'recipes');

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
                video = $14,
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
            (req.body.visibility === 'public') ? 'public' : 'private',
            video !== undefined ? video : existingRecipe.video
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
                video: updatedRecipe.video,
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

// ===== Social Features =====

// Like a recipe
router.post('/:id/like', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        // Check if already liked
        const checkResult = await db.query('SELECT * FROM recipe_likes WHERE recipe_id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (checkResult.rows.length === 0) {
            await db.query('INSERT INTO recipe_likes (recipe_id, user_id) VALUES ($1, $2)', [req.params.id, req.user.userId]);
        } else {
            await db.query('DELETE FROM recipe_likes WHERE recipe_id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Like error:', error);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
});

// Comment on a recipe
router.post('/:id/comment', authenticateToken, async (req, res) => {
    try {
        const { text, parentId } = req.body;
        if (!text) return res.status(400).json({ error: 'Comment text required' });

        const db = getDatabase();
        const insertResult = await db.query(`
            INSERT INTO recipe_comments (recipe_id, user_id, comment_text, parent_id) 
            VALUES ($1, $2, $3, $4) RETURNING id, created_at, parent_id
        `, [req.params.id, req.user.userId, text, parentId || null]);

        const userResult = await db.query('SELECT display_name, profile_picture, username FROM users WHERE id = $1', [req.user.userId]);
        const user = userResult.rows[0];

        res.json({ 
            success: true, 
            comment: {
                id: insertResult.rows[0].id,
                text,
                dateAdded: insertResult.rows[0].created_at,
                parentId: insertResult.rows[0].parent_id,
                authorName: user.display_name,
                authorUsername: user.username,
                authorPic: user.profile_picture || null,
                userId: req.user.userId
            }
        });
    } catch (error) {
        console.error('Comment error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Get Likes List
router.get('/:id/likes', async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.query(`
            SELECT u.id, u.username, u.display_name, u.profile_picture 
            FROM recipe_likes l
            JOIN users u ON l.user_id = u.id
            WHERE l.recipe_id = $1
            ORDER BY l.created_at DESC
        `, [req.params.id]);

        res.json(result.rows.map(row => ({
            id: row.id,
            username: row.username,
            displayName: row.display_name,
            profilePic: row.profile_picture || null
        })));
    } catch (error) {
        console.error('Get likes error:', error);
        res.status(500).json({ error: 'Failed to get likes' });
    }
});

// Share a recipe
router.post('/:id/share', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const { id } = req.params;
        const { notes } = req.body;
        
        // 1. Try to find in standard recipes
        let origResult = await db.query('SELECT * FROM recipes WHERE id = $1', [id]);
        let isStoreRecipe = false;
        
        // 2. If not found, try to find in store_recipes
        if (origResult.rows.length === 0) {
            origResult = await db.query('SELECT * FROM store_recipes WHERE id = $1', [id]);
            isStoreRecipe = true;
        }
        
        if (origResult.rows.length === 0) {
            return res.status(404).json({ error: 'Original post not found' });
        }
        
        const orig = origResult.rows[0];

        // If it's already a shared post, we link to the original source to avoid deep chains
        // This ensures the shared content always points to the actual recipe/post
        const effectiveOrigId = orig.shared_from_id || orig.id;
        const effectiveStoreId = orig.shared_from_store_id || (isStoreRecipe ? orig.id : null);
        const isFromStore = !!effectiveStoreId;

        // Use the original recipe's metadata for the new share
        // But the name should reflect it's a reshare
        const reshareName = orig.name ? (orig.name.startsWith('Reshare of') ? orig.name : `Reshare of ${orig.name}`) : 'Reshare of Recipe';

        const reshareResult = await db.query(`
            INSERT INTO recipes (
                user_id, 
                name, 
                category, 
                prep_time, 
                cook_time, 
                servings, 
                difficulty, 
                ingredients, 
                instructions, 
                photo, 
                video, 
                shared_from_id,
                shared_from_store_id,
                visibility
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'public')
            RETURNING id
        `, [
            req.user.userId,
            reshareName,
            orig.category || 'Social',
            orig.prep_time || 0,
            orig.cook_time || 0,
            orig.servings || 1,
            orig.difficulty || 'Medium',
            orig.ingredients || '',
            notes || 'Shared this post!',
            orig.photo || null,
            orig.video || null,
            isFromStore ? null : effectiveOrigId,
            effectiveStoreId
        ]);

        // Record the share action
        if (!isStoreRecipe) {
            await db.query('INSERT INTO recipe_shares (recipe_id, user_id) VALUES ($1, $2)', [id, req.user.userId]);
        }
        
        res.json({ success: true, newPostId: reshareResult.rows[0].id });
    } catch (error) {
        console.error('Share error:', error);
        res.status(500).json({ 
            error: 'Failed to record share', 
            details: error.message 
        });
    }
});

// Edit a comment
router.put('/comments/:commentId', authenticateToken, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Comment text required' });

        const db = getDatabase();
        const checkResult = await db.query('SELECT user_id FROM recipe_comments WHERE id = $1', [req.params.commentId]);
        if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
        if (checkResult.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });

        await db.query('UPDATE recipe_comments SET comment_text = $1 WHERE id = $2', [text, req.params.commentId]);
        res.json({ success: true, message: 'Comment updated' });
    } catch (error) {
        console.error('Update comment error:', error);
        res.status(500).json({ error: 'Failed to update comment' });
    }
});

// Delete a comment
router.delete('/comments/:commentId', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const checkResult = await db.query(`
            SELECT c.user_id as comment_author_id, r.user_id as recipe_author_id
            FROM recipe_comments c
            JOIN recipes r ON c.recipe_id = r.id
            WHERE c.id = $1
        `, [req.params.commentId]);

        if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
        
        const isCommentAuthor = checkResult.rows[0].comment_author_id === req.user.userId;
        const isRecipeAuthor = (checkResult.rows[0].recipe_author_id === req.user.userId);

        if (!isCommentAuthor && !isRecipeAuthor) return res.status(403).json({ error: 'Unauthorized' });

        await db.query('DELETE FROM recipe_comments WHERE id = $1', [req.params.commentId]);
        res.json({ success: true, message: 'Comment deleted' });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// Toggle Like on a comment
router.post('/comments/:commentId/like', authenticateToken, async (req, res) => {
    try {
        const { commentId } = req.params;
        const db = getDatabase();

        // Check if like exists
        const checkResult = await db.query('SELECT id FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, req.user.userId]);

        if (checkResult.rows.length > 0) {
            // Unlike
            await db.query('DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, req.user.userId]);
            const countResult = await db.query('SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = $1', [commentId]);
            return res.json({ liked: false, count: parseInt(countResult.rows[0].count) });
        } else {
            // Like
            await db.query('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)', [commentId, req.user.userId]);
            const countResult = await db.query('SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = $1', [commentId]);
            return res.json({ liked: true, count: parseInt(countResult.rows[0].count) });
        }
    } catch (error) {
        console.error('Comment like error:', error);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
});

export default router;
