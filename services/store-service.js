// Store API Service for Chef Book
// Handles all /api/store endpoints

import { API_URL, authHeaders, jsonAuthHeaders } from './api-config.js';

/**
 * List a recipe in the store.
 */
export async function listRecipe(recipeData) {
    const response = await fetch(`${API_URL}/store`, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify(recipeData)
    });
    const data = await response.json();
    return { response, data };
}

/**
 * Browse all store recipes (public).
 */
export async function browseStoreRecipes() {
    const response = await fetch(`${API_URL}/store`);
    return response.json();
}

/**
 * View a store recipe by ID.
 */
export async function getStoreRecipe(id) {
    const response = await fetch(`${API_URL}/store/${id}`, {
        headers: authHeaders()
    });
    const data = await response.json();
    return { response, data };
}

/**
 * Get preview info for a store recipe (for purchase modal on payment page).
 */
export async function getStoreRecipePreview(id) {
    const response = await fetch(`${API_URL}/store/${id}/preview`);
    return { response, data: await response.json() };
}

/**
 * Purchase a store recipe via wallet.
 */
export async function purchaseRecipeWithWallet(id) {
    const response = await fetch(`${API_URL}/store/${id}/purchase`, {
        method: 'POST',
        headers: jsonAuthHeaders()
    });
    const data = await response.json();
    return { response, data };
}

/**
 * Create a Stripe checkout session for a store recipe.
 */
export async function createCheckoutSession(recipeId, successUrl, cancelUrl) {
    const response = await fetch(`${API_URL}/store/create-checkout-session`, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ recipeId, successUrl, cancelUrl })
    });
    const data = await response.json();
    return { response, data };
}

/**
 * Get current user's store listings.
 */
export async function getMyListings() {
    const response = await fetch(`${API_URL}/store/my/listings`, {
        headers: authHeaders()
    });
    return response.json();
}

/**
 * Get current user's purchased recipes.
 */
export async function getMyPurchases() {
    const response = await fetch(`${API_URL}/store/my/purchases`, {
        headers: authHeaders()
    });
    return response.json();
}

/**
 * Delete a store listing.
 */
export async function deleteStoreListing(id) {
    const response = await fetch(`${API_URL}/store/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
    });
    return { response, data: response.ok ? {} : await response.json() };
}
