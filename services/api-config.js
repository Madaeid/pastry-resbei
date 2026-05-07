// Centralized API configuration for Chef Book
// All service modules import their base URL from here.

export const API_URL = '/api';

/**
 * Helper: get the current auth token from sessionStorage.
 * Centralised so every service uses the same source of truth.
 */
export function getAuthToken() {
    return sessionStorage.getItem('authToken');
}

/**
 * Helper: build standard Authorization header object.
 * Returns an empty object when no token is available.
 */
export function authHeaders() {
    const token = getAuthToken();
    if (!token) return {};
    return { 'Authorization': `Bearer ${token}` };
}

/**
 * Helper: build standard JSON + Authorization headers.
 */
export function jsonAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        ...authHeaders()
    };
}
