// Type declarations for admin-analytics.js
// Admin analytics page module — no ES exports (page-entry script).

/** Analytics data point */
interface AnalyticsDataPoint {
    date: string;
    value: number;
    label?: string;
}

/** Analytics summary */
interface AnalyticsSummary {
    totalUsers: number;
    activeUsers: number;
    totalRecipes: number;
    totalRevenue: number;
    premiumUsers: number;
    registrationTrend: AnalyticsDataPoint[];
    recipeTrend: AnalyticsDataPoint[];
    [key: string]: unknown;
}

// admin-analytics.js is a self-executing page module with no exports.
export {};
