// Book API Service for Chef Book
// Handles all /api/books endpoints

import { API_URL, authHeaders, jsonAuthHeaders } from './api-config';
import type { ApiResult, Book, BookMetadata } from './types';

const BOOK_API: string = `${API_URL}/books`;

/**
 * Get the current user's books.
 */
export async function getMyBooks(): Promise<Book[]> {
    const response = await fetch(BOOK_API, {
        headers: authHeaders()
    });
    return response.json();
}

/**
 * Get a single book by ID (with recipes).
 */
export async function getBook(bookId: number): Promise<Book> {
    const response = await fetch(`${BOOK_API}/${bookId}`, {
        headers: authHeaders()
    });
    if (!response.ok) throw new Error('Failed to load book');
    return response.json();
}

/**
 * Create a new book.
 */
export async function createBook(title: string, description: string, price: number = 0): Promise<ApiResult<Book>> {
    const response = await fetch(BOOK_API, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ title, description, price })
    });
    const data: Book = await response.json();
    return { response, data };
}

/**
 * Update book metadata.
 */
export async function updateBook(bookId: number, metadata: BookMetadata): Promise<Book> {
    const response = await fetch(`${BOOK_API}/${bookId}`, {
        method: 'PUT',
        headers: jsonAuthHeaders(),
        body: JSON.stringify(metadata)
    });
    if (!response.ok) throw new Error('Update failed');
    return response.json();
}

/**
 * Delete a book.
 */
export async function deleteBook(bookId: number): Promise<Response> {
    const response = await fetch(`${BOOK_API}/${bookId}`, {
        method: 'DELETE',
        headers: authHeaders()
    });
    return response;
}

/**
 * Get available recipes to add to a book.
 */
export async function getAvailableRecipes(bookId: number): Promise<Book['recipes']> {
    const response = await fetch(`${BOOK_API}/${bookId}/available-recipes`, {
        headers: authHeaders()
    });
    return response.json();
}

/**
 * Add recipes to a book.
 */
export async function addRecipesToBook(bookId: number, recipeIds: number[]): Promise<{ message: string }> {
    const response = await fetch(`${BOOK_API}/${bookId}/recipes`, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ recipeIds })
    });
    if (!response.ok) throw new Error('Failed to add recipes');
    return response.json();
}

/**
 * Remove a recipe from a book.
 */
export async function removeRecipeFromBook(bookId: number, recipeId: number): Promise<Response> {
    const response = await fetch(`${BOOK_API}/${bookId}/recipes/${recipeId}`, {
        method: 'DELETE',
        headers: authHeaders()
    });
    return response;
}

/**
 * Reorder recipes within a book.
 */
export async function reorderBookRecipes(bookId: number, recipeOrder: number[]): Promise<Response> {
    const response = await fetch(`${BOOK_API}/${bookId}/reorder`, {
        method: 'PUT',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ recipeOrder })
    });
    return response;
}

/**
 * Browse public books in the marketplace.
 */
export async function browsePublicBooks(): Promise<Book[]> {
    const response = await fetch(`${BOOK_API}/public/browse`);
    return response.json();
}

/**
 * View a public book by ID.
 */
export async function getPublicBook(bookId: number): Promise<Book> {
    const response = await fetch(`${BOOK_API}/public/${bookId}`, {
        headers: authHeaders()
    });
    if (!response.ok) throw new Error('Failed to load book');
    return response.json();
}

/**
 * Purchase a public book via wallet.
 */
export async function purchaseBook(bookId: number): Promise<ApiResult<{ message: string }>> {
    const response = await fetch(`${BOOK_API}/public/${bookId}/purchase`, {
        method: 'POST',
        headers: jsonAuthHeaders()
    });
    const data = await response.json();
    return { response, data };
}
