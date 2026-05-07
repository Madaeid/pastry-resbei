// Admin API Service for Chef Book
// Handles all /api/admin endpoints

import { API_URL, jsonAuthHeaders } from './api-config.js';

/**
 * Generic admin-authenticated fetch wrapper.
 * All admin endpoints share the same auth/JSON headers pattern.
 */
export async function adminFetch(endpoint, options = {}) {
    const headers = {
        ...jsonAuthHeaders(),
        ...options.headers
    };

    const response = await fetch(`${API_URL}/admin${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Error ${response.status}`);
    }

    return response.json();
}

/**
 * Get dashboard stats (total users, admins, recipes).
 */
export async function getStats() {
    return adminFetch('/stats');
}

/**
 * Get all users.
 */
export async function getUsers() {
    return adminFetch('/users');
}

/**
 * Toggle admin status for a user.
 */
export async function toggleAdmin(userId) {
    return adminFetch(`/users/${userId}/toggle-admin`, { method: 'PATCH' });
}

/**
 * Delete a user.
 */
export async function deleteUser(userId) {
    return adminFetch(`/users/${userId}`, { method: 'DELETE' });
}

/**
 * Update a user's profile (admin edit).
 */
export async function updateUser(userId, data) {
    return adminFetch(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

/**
 * Grant premium to a user.
 */
export async function grantPremium(userId, plan = 'yearly') {
    return adminFetch(`/users/${userId}/grant-premium`, {
        method: 'POST',
        body: JSON.stringify({ plan })
    });
}

/**
 * Revoke premium from a user.
 */
export async function revokePremium(userId) {
    return adminFetch(`/users/${userId}/revoke-premium`, { method: 'POST' });
}

/**
 * Get all recipes (admin view).
 */
export async function getAllRecipes() {
    return adminFetch('/recipes');
}

/**
 * Clear all recipes from the database.
 */
export async function clearAllRecipes() {
    return adminFetch('/recipes/clear-all', { method: 'POST' });
}

/**
 * Export all system data.
 */
export async function exportData() {
    return adminFetch('/export');
}

/**
 * Get analytics data.
 */
export async function getAnalytics() {
    return adminFetch('/analytics');
}
