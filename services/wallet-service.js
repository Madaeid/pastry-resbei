// Wallet API Service for Chef Book
// Handles all /api/wallet endpoints

import { API_URL, authHeaders, jsonAuthHeaders } from './api-config.js';

/**
 * Get the current user's wallet balance.
 */
export async function getBalance() {
    const response = await fetch(`${API_URL}/wallet/balance`, {
        headers: authHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch balance');
    return response.json();
}

/**
 * Search users for wallet transfers.
 */
export async function searchUsers(query) {
    const response = await fetch(
        `${API_URL}/wallet/search-users?q=${encodeURIComponent(query)}`,
        { headers: authHeaders() }
    );
    return response.json();
}

/**
 * Transfer money to another user.
 */
export async function transfer(recipientUsername, amount, note = '') {
    const response = await fetch(`${API_URL}/wallet/transfer`, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ recipientUsername, amount, note })
    });
    const data = await response.json();
    return { response, data };
}

/**
 * Deposit funds into the wallet.
 */
export async function deposit(amount, cardLast4, cardBrand) {
    const response = await fetch(`${API_URL}/wallet/deposit`, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ amount, cardLast4, cardBrand })
    });
    const data = await response.json();
    return { response, data };
}

/**
 * Get wallet transaction history.
 */
export async function getTransactions(limit) {
    const url = limit
        ? `${API_URL}/wallet/transactions?limit=${limit}`
        : `${API_URL}/wallet/transactions`;
    const response = await fetch(url, {
        headers: authHeaders()
    });
    if (!response.ok) throw new Error('Failed to load transactions');
    return response.json();
}

/**
 * Purchase a subscription plan via wallet.
 */
export async function walletPurchase(body) {
    const response = await fetch(`${API_URL}/wallet/purchase`, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify(body)
    });
    const data = await response.json();
    return { response, data };
}
