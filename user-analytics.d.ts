// Type declarations for user-analytics.js
// User analytics page module — no ES exports (page-entry script).

/** User activity stats */
interface UserActivityStats {
    recipesCreated: number;
    recipesShared: number;
    likesReceived: number;
    commentsReceived: number;
    storeListings: number;
    totalSales: number;
    totalEarnings: number;
}

/** Weekly activity data */
interface WeeklyActivity {
    day: string;
    recipes: number;
    interactions: number;
}

// user-analytics.js is a self-executing page module with no exports.
export {};
