// Recipe API Service for Chef Book
// Handles all /api/recipes endpoints

import { API_URL, authHeaders, jsonAuthHeaders } from './api-config';
import type { ApiResult, RecipeData, Recipe, Comment } from './types';

/**
 * Create a new recipe.
 */
export async function createRecipe(recipeData: RecipeData): Promise<ApiResult<Recipe>> {
    const response = await fetch(`${API_URL}/recipes`, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify(recipeData)
    });
    return { response, data: await response.json() };
}

/**
 * Update an existing recipe by ID.
 */
export async function updateRecipe(id: number, recipeData: Partial<RecipeData>): Promise<ApiResult<Recipe>> {
    const response = await fetch(`${API_URL}/recipes/${id}`, {
        method: 'PUT',
        headers: jsonAuthHeaders(),
        body: JSON.stringify(recipeData)
    });
    return { response, data: await response.json() };
}

/**
 * Create or update a recipe (convenience wrapper).
 */
export async function saveRecipe(recipeData: RecipeData, editingRecipeId: number | null = null): Promise<ApiResult<Recipe>> {
    if (editingRecipeId) {
        return updateRecipe(editingRecipeId, recipeData);
    }
    return createRecipe(recipeData);
}

/**
 * Delete a recipe by ID.
 */
export async function deleteRecipe(id: number): Promise<ApiResult<{ message?: string }>> {
    const response = await fetch(`${API_URL}/recipes/${id}`, {
        method: 'DELETE',
        headers: jsonAuthHeaders()
    });
    return { response, data: await response.json() };
}

/**
 * Get the current user's recipes.
 */
export async function getMyRecipes(): Promise<ApiResult<Recipe[]>> {
    const response = await fetch(`${API_URL}/recipes`, {
        headers: authHeaders()
    });
    return { response, data: await response.json() };
}

/**
 * Get all public recipes (home feed).
 */
export async function getPublicRecipes(): Promise<ApiResult<Recipe[]>> {
    const response = await fetch(`${API_URL}/recipes/public`);
    return { response, data: await response.json() };
}

/**
 * Get a single recipe by ID.
 */
export async function getRecipeById(id: number): Promise<ApiResult<Recipe>> {
    const response = await fetch(`${API_URL}/recipes/${id}`, {
        headers: authHeaders()
    });
    return { response, data: await response.json() };
}

/**
 * Toggle like on a recipe.
 */
export async function toggleRecipeLike(id: number): Promise<ApiResult<{ likes: number; liked: boolean }>> {
    const response = await fetch(`${API_URL}/recipes/${id}/like`, {
        method: 'POST',
        headers: jsonAuthHeaders()
    });
    return { response, data: await response.json() };
}

/**
 * Get the list of users who liked a recipe.
 */
export async function getRecipeLikes(id: number): Promise<ApiResult<{ users: string[] }>> {
    const response = await fetch(`${API_URL}/recipes/${id}/likes`);
    return { response, data: await response.json() };
}

/**
 * Add a comment to a recipe.
 */
export async function addComment(recipeId: number, text: string, parentId: number | null = null): Promise<ApiResult<Comment>> {
    const body: { text: string; parentId?: number } = { text };
    if (parentId) body.parentId = parentId;

    const response = await fetch(`${API_URL}/recipes/${recipeId}/comment`, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify(body)
    });
    return { response, data: await response.json() };
}

/**
 * Edit a comment.
 */
export async function editComment(commentId: number, text: string): Promise<ApiResult<Comment>> {
    const response = await fetch(`${API_URL}/recipes/comments/${commentId}`, {
        method: 'PUT',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ text })
    });
    return { response, data: await response.json() };
}

/**
 * Delete a comment.
 */
export async function deleteComment(commentId: number): Promise<ApiResult<{ message?: string }>> {
    const response = await fetch(`${API_URL}/recipes/comments/${commentId}`, {
        method: 'DELETE',
        headers: jsonAuthHeaders()
    });
    return { response, data: await response.json() };
}

/**
 * Toggle like on a comment.
 */
export async function toggleCommentLike(commentId: number): Promise<ApiResult<{ likes: number; liked: boolean }>> {
    const response = await fetch(`${API_URL}/recipes/comments/${commentId}/like`, {
        method: 'POST',
        headers: jsonAuthHeaders()
    });
    return { response, data: await response.json() };
}

/**
 * Share / reshare a recipe.
 */
export async function shareRecipe(id: number): Promise<ApiResult<Recipe>> {
    const response = await fetch(`${API_URL}/recipes/${id}/share`, {
        method: 'POST',
        headers: jsonAuthHeaders()
    });
    return { response, data: await response.json() };
}
