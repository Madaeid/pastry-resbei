// Type declarations for ingredient-scanner.js
// Provides type-checking for the AI scanner module without rewriting the 650-line file.

/** Scanner scan modes */
export type ScanMode = 'ingredients' | 'dish' | 'menu';

/** Scanner target form */
export type ScannerTarget = 'add' | 'sell';

/** AI scan result from the server */
export interface ScanResult {
    ingredients: string[];
    confidence?: 'high' | 'medium' | 'low';
    suggestedName?: string;
    suggestedCategory?: string;
    tips?: string;
    requiresPremium?: boolean;
    error?: string;
}

/** Initialize the scanner module (creates modal + attaches buttons) */
export function initScanner(): void;

/** Open the scanner modal */
export function openScanner(target?: ScannerTarget): void;
