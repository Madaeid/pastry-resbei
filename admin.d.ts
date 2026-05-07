// Type declarations for admin.js
// Admin dashboard page module — no ES exports (page-entry script).

/** Admin user row in the management table */
interface AdminUserRow {
    id: number;
    username: string;
    displayName: string;
    email?: string;
    isAdmin: boolean;
    isPremium: boolean;
    is_public?: string;
    recipesCount?: number;
    createdAt?: string;
}

/** Admin dashboard stats */
interface DashboardStats {
    totalUsers: number;
    totalAdmins: number;
    totalRecipes: number;
    totalStoreRecipes?: number;
    totalBooks?: number;
}

// admin.js is a self-executing page module with no exports.
export {};
