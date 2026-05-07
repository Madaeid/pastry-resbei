// Recipe API Service for Chef Book
// Handles all /api/recipes endpoints

import { API_URL, getAuthToken, authHeaders, jsonAuthHeaders } from './api-config.js';

/**
 * Create a new recipe.
 */
export async function createRecipe(recipeData) {
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
export async function updateRecipe(id, recipeData) {
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
export async function saveRecipe(recipeData, editingRecipeId = null) {
    if (editingRecipeId) {
        return updateRecipe(editingRecipeId, recipeData);
    }
    return createRecipe(recipeData);
}

/**
 * Delete a recipe by ID.
 */
export async function deleteRecipe(id) {
    const response = await fetch(`${API_URL}/recipes/${id}`, {
        method: 'DELETE',
        headers: jsonAuthHeaders()
    });
    return { response, data: await response.json() };
}

/**
 * Get the current user's recipes.
 */
export async function getMyRecipes() {
    const response = await fetch(`${API_URL}/recipes`, {
        headers: authHeaders()
    });
    return { response, data: await response.json() };
}

/**
 * Get all public recipes (home feed).
 */
export async function getPublicRecipes() {
    const response = await fetch(`${API_URL}/recipes/public`);
    return { response, data: await response.json() };
}

/**
 * Get a single recipe by ID.
 */
export async function getRecipeById(id) {
    const response = await fetch(`${API_URL}/recipes/${id}`, {
        headers: authHeaders()
    });
    return { response, data: await response.json() };
}

/**
 * Toggle like on a recipe.
 */
export async function toggleRecipeLike(id) {
    const response = await fetch(`${API_URL}/recipes/${id}/like`, {
        method: 'POST',
        headers: jsonAuthHeaders()
    });
    return { response, data: await response.json() };
}

/**
 * Get the list of users who liked a recipe.
 */
export async function getRecipeLikes(id) {
    const response = await fetch(`${API_URL}/recipes/${id}/likes`);
    return { response, data: await response.json() };
}

/**
 * Add a comment to a recipe.
 */
export async function addComment(recipeId, text, parentId = null) {
    const body = { text };
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
export async function editComment(commentId, text) {
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
export async function deleteComment(commentId) {
    const response = await fetch(`${API_URL}/recipes/comments/${commentId}`, {
        method: 'DELETE',
        headers: jsonAuthHeaders()
    });
    return { response, data: await response.json() };
}

/**
 * Toggle like on a comment.
 */
export async function toggleCommentLike(commentId) {
    const response = await fetch(`${API_URL}/recipes/comments/${commentId}/like`, {
        method: 'POST',
        headers: jsonAuthHeaders()
    });
    return { response, data: await response.json() };
}

/**
 * Share / reshare a recipe.
 */
export async function shareRecipe(id) {
    const response = await fetch(`${API_URL}/recipes/${id}/share`, {
        method: 'POST',
        headers: jsonAuthHeaders()
    });
    return { response, data: await response.json() };
}
