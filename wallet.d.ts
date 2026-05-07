// Type declarations for wallet.js
// Wallet page module — no ES exports (page-entry script).
// This file runs on wallet.html and handles all wallet UI interactions.

/** Wallet transaction display shape */
interface WalletTransactionUI {
    id: number;
    type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out' | 'purchase' | 'sale';
    amount: number;
    description?: string;
    recipientUsername?: string;
    senderUsername?: string;
    createdAt: string;
}

/** Wallet user search result */
interface WalletUserResult {
    id: number;
    username: string;
    displayName: string;
    profilePicture?: string;
}

// wallet.js is a self-executing page module with no exports.
export {};
