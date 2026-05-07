// Store API Service for Chef Book
// Handles all /api/store endpoints

import { API_URL, authHeaders, jsonAuthHeaders } from './api-config';
import type { ApiResult, StoreRecipeData, StoreRecipe, CheckoutSessionResult } from './types';

/**
 * List a recipe in the store.
 */
export async function listRecipe(recipeData: StoreRecipeData): Promise<ApiResult<StoreRecipe>> {
    const response = await fetch(`${API_URL}/store`, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify(recipeData)
    });
    const data: StoreRecipe = await response.json();
    return { response, data };
}

/**
 * Browse all store recipes (public).
 */
export async function browseStoreRecipes(): Promise<StoreRecipe[]> {
    const response = await fetch(`${API_URL}/store`);
    return response.json();
}

/**
 * View a store recipe by ID.
 */
export async function getStoreRecipe(id: number): Promise<ApiResult<StoreRecipe>> {
    const response = await fetch(`${API_URL}/store/${id}`, {
        headers: authHeaders()
    });
    const data: StoreRecipe = await response.json();
    return { response, data };
}

/**
 * Get preview info for a store recipe (for purchase modal on payment page).
 */
export async function getStoreRecipePreview(id: number): Promise<ApiResult<StoreRecipe>> {
    const response = await fetch(`${API_URL}/store/${id}/preview`);
    return { response, data: await response.json() };
}

/**
 * Purchase a store recipe via wallet.
 */
export async function purchaseRecipeWithWallet(id: number): Promise<ApiResult<{ message: string; newBalance?: number }>> {
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
export async function createCheckoutSession(recipeId: number, successUrl: string, cancelUrl: string): Promise<ApiResult<CheckoutSessionResult>> {
    const response = await fetch(`${API_URL}/store/create-checkout-session`, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ recipeId, successUrl, cancelUrl })
    });
    const data: CheckoutSessionResult = await response.json();
    return { response, data };
}

/**
 * Get current user's store listings.
 */
export async function getMyListings(): Promise<StoreRecipe[]> {
    const response = await fetch(`${API_URL}/store/my/listings`, {
        headers: authHeaders()
    });
    return response.json();
}

/**
 * Get current user's purchased recipes.
 */
export async function getMyPurchases(): Promise<StoreRecipe[]> {
    const response = await fetch(`${API_URL}/store/my/purchases`, {
        headers: authHeaders()
    });
    return response.json();
}

/**
 * Delete a store listing.
 */
export async function deleteStoreListing(id: number): Promise<ApiResult<Record<string, unknown>>> {
    const response = await fetch(`${API_URL}/store/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
    });
    return { response, data: response.ok ? {} : await response.json() };
}
