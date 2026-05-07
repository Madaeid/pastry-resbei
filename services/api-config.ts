// Centralized API configuration for Chef Book
// All service modules import their base URL from here.

import type { HeadersInit } from './types';

export const API_URL: string = '/api';

/**
 * Helper: get the current auth token from sessionStorage.
 * Centralised so every service uses the same source of truth.
 */
export function getAuthToken(): string | null {
    return sessionStorage.getItem('authToken');
}

/**
 * Helper: build standard Authorization header object.
 * Returns an empty object when no token is available.
 */
export function authHeaders(): HeadersInit {
    const token = getAuthToken();
    if (!token) return {};
    return { 'Authorization': `Bearer ${token}` };
}

/**
 * Helper: build standard JSON + Authorization headers.
 */
export function jsonAuthHeaders(): HeadersInit {
    return {
        'Content-Type': 'application/json',
        ...authHeaders()
    };
}
