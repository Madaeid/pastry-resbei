// User API Service for Chef Book
// Handles all /api/users endpoints

import { API_URL, authHeaders } from './api-config';
import type { ApiResult, PublicUser, UserProfile } from './types';

/**
 * Get all public users (optionally filtered by search query).
 */
export async function getPublicUsers(search: string = ''): Promise<ApiResult<PublicUser[]>> {
    const url = search
        ? `${API_URL}/users/public?search=${encodeURIComponent(search)}`
        : `${API_URL}/users/public`;
    const response = await fetch(url, {
        headers: authHeaders()
    });
    return { response, data: await response.json() };
}

/**
 * Get the current user's profile.
 */
export async function getUserProfile(): Promise<ApiResult<UserProfile>> {
    const response = await fetch(`${API_URL}/users/profile`, {
        headers: authHeaders()
    });
    return { response, data: await response.json() };
}
