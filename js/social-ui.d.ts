// Type declarations for social-ui.js
// Provides full type-checking for consumers without rewriting the 560-line module.

/** Shape of a comment in the social feed */
export interface SocialComment {
    id: number;
    userId: number;
    text: string;
    parentId?: number | null;
    authorName: string;
    authorUsername: string;
    authorPic?: string;
    likes?: number;
    isLikedByMe?: boolean;
    createdAt?: string;
}

/** Shape of a shared/reshared recipe within a post */
export interface SharedPost {
    id: number;
    name?: string;
    instructions?: string;
    photo?: string;
    video?: string;
    isStore?: boolean;
    author?: {
        name?: string;
        pic?: string;
        username?: string;
    };
}

/** Shape of a social post passed to createPostCard */
export interface SocialPost {
    id: number;
    name?: string;
    category?: string;
    instructions?: string;
    photo?: string;
    video?: string;
    likes?: number;
    shares?: number;
    dateAdded?: string;
    createdAt?: string;
    comments?: SocialComment[];
    sharedFrom?: SharedPost | null;
    author?: {
        userId?: number;
        name?: string;
        username?: string;
        pic?: string;
        isPremium?: boolean;
    };
    authorName?: string;
    authorUsername?: string;
    isPremium?: boolean;
    difficulty?: string;
    servings?: number;
    prepTime?: number;
    cookTime?: number;
}

/**
 * Formats a date string to a relative time (e.g. "2h ago", "Just now")
 */
export function formatTimeAgo(dateString?: string): string;

/**
 * Renders the HTML for the comments list (Supports Threaded)
 */
export function renderCommentsList(
    commentsList: SocialComment[],
    postAuthorId: number | null | undefined,
    currentUserId: number | null
): string;

/**
 * Creates a social post card element
 */
export function createPostCard(post: SocialPost): HTMLDivElement;
