// Daily Menu API Service for Chef Book
// Handles all /api/daily-menu endpoints

import { API_URL, authHeaders } from './api-config.js';

/**
 * Get the current user's recipes (for the daily-menu recipe picker).
 */
export async function getDailyMenuRecipes() {
    const response = await fetch(`${API_URL}/daily-menu/recipes`, {
        headers: authHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch recipes');
    return response.json();
}
