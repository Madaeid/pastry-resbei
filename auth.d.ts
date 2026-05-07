// Type declarations for auth.js
// Authentication, session management, and user CRUD functions.

/** Login result */
interface AuthResult {
    success: boolean;
    error?: string;
    isAdmin?: boolean;
}

/** User record stored in localStorage */
interface LocalUser {
    username: string;
    displayName?: string;
    email?: string;
    phone?: string;
    profilePicture?: string;
    gallery?: string[];
    isAdmin?: boolean;
    [key: string]: unknown;
}

/** Profile fetch result */
interface ProfileResult {
    success: boolean;
    user?: LocalUser;
    error?: string;
}

/** Check if a user is currently logged in */
export function isLoggedIn(): boolean;

/** Log out the current user and redirect */
export function logout(): void;

/** Get the current user's username */
export function getCurrentUser(): string | null;

/** Check if the current user is an admin */
export function isAdmin(): boolean;

/** Get all users from localStorage (admin) */
export function getAllUsers(): Record<string, LocalUser>;

/** Delete a user by username (admin) */
export function deleteUser(username: string): AuthResult;

/** Toggle admin status for a user */
export function toggleAdminStatus(username: string): AuthResult;

/** Update a user's profile data */
export function updateUser(username: string, data: Partial<LocalUser>): AuthResult;

/** Get the current JWT auth token */
export function getAuthToken(): string | null;

/** Fetch the current user's profile from the backend */
export function fetchUserProfile(): Promise<ProfileResult>;

/** Login a user */
export function loginUser(username: string, password: string): Promise<AuthResult>;

/** Register a new user */
export function registerUser(username: string, email: string, phone: string, birthday: string, password: string): Promise<AuthResult>;

/** Send reset code */
export function sendResetCode(username: string, contactValue: string, method?: string): { success: boolean; error?: string; maskedContact?: string; method?: string };

/** Reset password with code */
export function resetPasswordWithCode(username: string, code: string, newPassword: string): Promise<{ success: boolean; error?: string }>;

/** Save credentials */
export function saveCredentials(username: string, password: string): void;

/** Load credentials */
export function loadCredentials(): { username: string; password: string } | null;

/** Clear credentials */
export function clearCredentials(): void;
