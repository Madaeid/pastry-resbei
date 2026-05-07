// Admin API Service for Chef Book
// Handles all /api/admin endpoints

import { API_URL, jsonAuthHeaders } from './api-config';
import type {
    AdminFetchOptions,
    AdminStats,
    AdminAnalytics,
    AdminUserUpdate,
    PublicUser,
    Recipe
} from './types';

/**
 * Generic admin-authenticated fetch wrapper.
 * All admin endpoints share the same auth/JSON headers pattern.
 */
export async function adminFetch<T = unknown>(endpoint: string, options: AdminFetchOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
        ...jsonAuthHeaders(),
        ...(options.headers as Record<string, string> | undefined)
    };

    const response = await fetch(`${API_URL}/admin${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Error ${response.status}`);
    }

    return response.json() as Promise<T>;
}

/**
 * Get dashboard stats (total users, admins, recipes).
 */
export async function getStats(): Promise<AdminStats> {
    return adminFetch<AdminStats>('/stats');
}

/**
 * Get all users.
 */
export async function getUsers(): Promise<PublicUser[]> {
    return adminFetch<PublicUser[]>('/users');
}

/**
 * Toggle admin status for a user.
 */
export async function toggleAdmin(userId: number): Promise<{ message: string }> {
    return adminFetch<{ message: string }>(`/users/${userId}/toggle-admin`, { method: 'PATCH' });
}

/**
 * Delete a user.
 */
export async function deleteUser(userId: number): Promise<{ message: string }> {
    return adminFetch<{ message: string }>(`/users/${userId}`, { method: 'DELETE' });
}

/**
 * Update a user's profile (admin edit).
 */
export async function updateUser(userId: number, data: AdminUserUpdate): Promise<PublicUser> {
    return adminFetch<PublicUser>(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

/**
 * Grant premium to a user.
 */
export async function grantPremium(userId: number, plan: string = 'yearly'): Promise<{ message: string }> {
    return adminFetch<{ message: string }>(`/users/${userId}/grant-premium`, {
        method: 'POST',
        body: JSON.stringify({ plan })
    });
}

/**
 * Revoke premium from a user.
 */
export async function revokePremium(userId: number): Promise<{ message: string }> {
    return adminFetch<{ message: string }>(`/users/${userId}/revoke-premium`, { method: 'POST' });
}

/**
 * Get all recipes (admin view).
 */
export async function getAllRecipes(): Promise<Recipe[]> {
    return adminFetch<Recipe[]>('/recipes');
}

/**
 * Clear all recipes from the database.
 */
export async function clearAllRecipes(): Promise<{ message: string }> {
    return adminFetch<{ message: string }>('/recipes/clear-all', { method: 'POST' });
}

/**
 * Export all system data.
 */
export async function exportData(): Promise<unknown> {
    return adminFetch('/export');
}

/**
 * Get analytics data.
 */
export async function getAnalytics(): Promise<AdminAnalytics> {
    return adminFetch<AdminAnalytics>('/analytics');
}
