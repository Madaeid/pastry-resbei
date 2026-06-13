// Type declarations for books.js
// Book portfolio CRUD, marketplace browsing, and PDF export.

/** Book data shape used in the UI */
interface BookUIData {
    id: number;
    title: string;
    description?: string;
    coverPhoto?: string;
    cover_photo?: string;
    price?: number;
    isPublic?: boolean;
    is_public?: boolean;
    theme?: string;
    author?: { username: string; name: string; pic?: string };
    recipes?: unknown[];
    createdAt?: string;
}

/** Recipe available for book inclusion */
interface PickerRecipe {
    id: number;
    name: string;
    photo?: string;
    category?: string;
}

/** Load and render the user's books */
export function loadBooks(): Promise<void>;

/** Create a book card DOM element */
export function createBookCard(book: BookUIData): HTMLDivElement;

/** Open the detail view for a book */
export function openBookDetail(bookId: number): Promise<void>;

/** Render the recipes list inside a book detail view */
export function renderBookRecipesList(): void;

/** Set up event listeners for book detail interactions */
export function setupBookDetailListeners(): void;

/** Save book metadata (title, description, price, etc.) */
export function saveBookMeta(): Promise<void>;

/** Create a new book */
export function createNewBook(): Promise<void>;

/** Delete the currently viewed book */
export function deleteCurrentBook(): Promise<void>;

/** Open the recipe picker modal for adding recipes to a book */
export function openRecipePicker(): Promise<void>;

/** Render the list of available recipes in the picker */
export function renderPickerList(recipes: PickerRecipe[]): void;

/** Update the selected count in the picker */
export function updatePickerCount(): void;

/** Add selected recipes from the picker to the current book */
export function addSelectedRecipes(): Promise<void>;

/** Open the book preview/flip-through view */
export function openBookPreview(): void;

/** Export the current book as a PDF */
export function exportBookPdf(): void;

/** Load and render public books in the marketplace */
export function loadBrowseBooks(): Promise<void>;

/** Create a public book card for the marketplace grid */
export function createPublicBookCard(book: BookUIData): HTMLDivElement;

/** View a public book by ID */
export function viewPublicBook(bookId: number): Promise<void>;

/** Load the user's purchased books */
export function loadPurchasedBooks(): Promise<void>;
