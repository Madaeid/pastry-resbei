// Wallet API Service for Chef Book
// Handles all /api/wallet endpoints

import { API_URL, authHeaders, jsonAuthHeaders } from './api-config';
import type {
    ApiResult,
    WalletBalance,
    WalletTransaction,
    TransferResult,
    DepositResult,
    WalletPurchaseBody,
    WalletPurchaseResult,
    PublicUser
} from './types';

/**
 * Get the current user's wallet balance.
 */
export async function getBalance(): Promise<WalletBalance> {
    const response = await fetch(`${API_URL}/wallet/balance`, {
        headers: authHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch balance');
    return response.json();
}

/**
 * Search users for wallet transfers.
 */
export async function searchUsers(query: string): Promise<PublicUser[]> {
    const response = await fetch(
        `${API_URL}/wallet/search-users?q=${encodeURIComponent(query)}`,
        { headers: authHeaders() }
    );
    return response.json();
}

/**
 * Transfer money to another user.
 */
export async function transfer(recipientUsername: string, amount: number, note: string = ''): Promise<ApiResult<TransferResult>> {
    const response = await fetch(`${API_URL}/wallet/transfer`, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ recipientUsername, amount, note })
    });
    const data: TransferResult = await response.json();
    return { response, data };
}

/**
 * Deposit funds into the wallet.
 */
export async function deposit(amount: number, cardLast4: string, cardBrand: string): Promise<ApiResult<DepositResult>> {
    const response = await fetch(`${API_URL}/wallet/deposit`, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ amount, cardLast4, cardBrand })
    });
    const data: DepositResult = await response.json();
    return { response, data };
}

/**
 * Get wallet transaction history.
 */
export async function getTransactions(limit?: number): Promise<WalletTransaction[]> {
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
export async function walletPurchase(body: WalletPurchaseBody): Promise<ApiResult<WalletPurchaseResult>> {
    const response = await fetch(`${API_URL}/wallet/purchase`, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify(body)
    });
    const data: WalletPurchaseResult = await response.json();
    return { response, data };
}
