// Subscription API Service for Chef Book
// Handles all /api/subscriptions endpoints

import { API_URL, authHeaders, jsonAuthHeaders } from './api-config';
import type { ApiResult, SubscriptionStatus, SubscriptionCheckoutBody, CheckoutSessionResult } from './types';

/**
 * Get the current user's subscription status from the server.
 */
export async function getSubscriptionStatus(): Promise<ApiResult<SubscriptionStatus>> {
    const response = await fetch(`${API_URL}/subscriptions/status`, {
        headers: authHeaders()
    });
    return { response, data: await response.json() };
}

/**
 * Create a Stripe checkout session for a subscription plan.
 */
export async function createCheckoutSession(endpoint: string, body: SubscriptionCheckoutBody): Promise<ApiResult<CheckoutSessionResult>> {
    const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify(body)
    });
    return { response, data: await response.json() };
}

/**
 * Create a Stripe portal session (for managing billing).
 */
export async function createPortalSession(): Promise<ApiResult<{ url: string }>> {
    const response = await fetch(`${API_URL}/subscriptions/create-portal-session`, {
        method: 'POST',
        headers: jsonAuthHeaders()
    });
    return { response, data: await response.json() };
}
