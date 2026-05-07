// Type declarations for store.js
// Recipe marketplace — listing, browsing, purchasing, and management.

/** Store recipe used in UI rendering */
interface StoreRecipeUI {
    id: number;
    name: string;
    category?: string;
    ingredients?: string;
    instructions?: string;
    photo?: string;
    price: number;
    seller?: { username: string; name: string; pic?: string };
    salesCount?: number;
    createdAt?: string;
    [key: string]: unknown;
}

/** Set up all store tab event listeners */
export function setupStoreListeners(): void;

/** Handle the sell-recipe form submission */
export function handleSellRecipeSubmit(e: Event): Promise<void>;

/** Load and render all store recipes */
export function loadStoreRecipes(): Promise<void>;

/** Create a store recipe card element */
export function createStoreCard(recipe: StoreRecipeUI): HTMLDivElement;

/** View a store recipe detail by ID */
export function viewStoreRecipe(id: number): Promise<void>;

/** Show the purchase modal for a recipe */
export function showPurchaseModal(recipe: StoreRecipeUI): void;

/** Fetch wallet balance and update purchase button state */
export function fetchAndUpdateWalletBtn(
    price: number,
    btnId: string,
    balanceTagId: string,
    insufficientMsgId: string
): Promise<void>;

/** Purchase a store recipe */
export function purchaseRecipe(id: number, method?: string): Promise<void>;

/** Show the full-screen recipe detail view */
export function showFullStoreRecipe(recipe: StoreRecipeUI): void;

/** Load the current user's store listings */
export function loadMyListings(): Promise<void>;

/** Load the current user's purchased recipes */
export function loadMyPurchases(): Promise<void>;

/** Delete a store listing */
export function deleteStoreRecipe(id: number): Promise<void>;
