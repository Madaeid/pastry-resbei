// Type declarations for main.js
// Main application module — no ES exports, but attaches functions to window.

/** Recipe object used throughout the main app */
interface MainRecipe {
    id: number;
    name: string;
    category?: string;
    ingredients?: string;
    instructions?: string;
    photo?: string;
    video?: string;
    notes?: string;
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    difficulty?: string;
    likes?: number;
    commentsCount?: number;
    author?: {
        userId?: number;
        name?: string;
        username?: string;
        pic?: string;
        isPremium?: boolean;
    };
    sharedFrom?: MainRecipe | null;
    createdAt?: string;
    [key: string]: unknown;
}

/**
 * main.js does not use ES module exports.
 * Instead it attaches key functions to the global window object:
 *
 * - window.viewRecipe(recipe, isPublic?)
 * - window.toggleLike(recipeId, likesCountEl, likeBtn)
 * - window.submitComment(recipeId, text, cardEl, parentId?)
 * - window.sharePost(recipeId)
 * - window.editComment(commentId, recipeId, textEl)
 * - window.deleteComment(commentId, recipeId, commentEl, countSpan)
 * - window.editPost(recipeId)
 * - window.deletePost(recipeId)
 * - window.toggleCommentLike(commentId, likeBtn)
 * - window.openDayPickerModal(recipe)
 * - window.removeSpecificUser(username)
 * - window.addSpecificUser(username, displayName)
 */

declare global {
    interface Window {
        viewRecipe: (recipe: MainRecipe, isPublic?: boolean) => void;
        toggleLike: (recipeId: number, likesCountEl: HTMLElement, likeBtn: HTMLElement) => void;
        submitComment: (recipeId: number, text: string, cardEl: HTMLElement, parentId?: string) => void;
        sharePost: (recipeId: number) => void;
        editComment: (commentId: string, recipeId: number, textEl: HTMLElement) => void;
        deleteComment: (commentId: string, recipeId: number, commentEl: HTMLElement, countSpan: HTMLElement) => void;
        editPost: (recipeId: number) => void;
        deletePost: (recipeId: number) => void;
        toggleCommentLike: (commentId: string, likeBtn: HTMLElement) => void;
        openDayPickerModal: (recipe: MainRecipe) => void;
        removeSpecificUser: (username: string) => void;
        addSpecificUser: (username: string, displayName: string) => void;
    }
}

export {};
