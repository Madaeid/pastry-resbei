// Type declarations for payment.js
// Subscription management, Stripe checkout, and premium gating.

/** Subscription plan definition */
interface SubscriptionPlan {
    name: string;
    price: number;
    displayPrice: string;
    durationDays: number;
    features?: string[];
}

/** Map of plan IDs to plan definitions */
type PlansMap = Record<string, SubscriptionPlan>;

/** Subscription status from server/localStorage */
interface SubscriptionInfo {
    plan: string;
    status: 'active' | 'cancelled' | 'expired' | 'none';
    endDate?: string;
    startDate?: string;
    autoRenew?: boolean;
    grantedByAdmin?: boolean;
    syncedAt?: string;
    isPremium?: boolean;
    message?: string;
    isAdminPrivilege?: boolean;
}

/** Admin grant/revoke result */
interface PremiumResult {
    success: boolean;
    message?: string;
    error?: string;
}

/** Plan definitions (monthly, yearly, lifetime) */
export const PLANS: PlansMap;

/** Check if the current user has an active premium subscription */
export function isPremium(): boolean;

/** Get the current user's subscription status */
export function getSubscriptionStatus(): SubscriptionInfo;

/** Get the raw subscription object from localStorage */
export function getSubscription(): SubscriptionInfo | null;

/** Save a subscription to localStorage */
export function saveSubscription(subscription: SubscriptionInfo): void;

/** Check if a specific user has premium (admin use) */
export function isUserPremium(username: string): boolean;

/** Grant premium to a user (admin function) */
export function grantPremiumToUser(username: string, plan?: string): PremiumResult;

/** Revoke premium from a user (admin function) */
export function revokePremiumFromUser(username: string): PremiumResult;

/** Sync subscription status from server to localStorage */
export function syncSubscriptionFromServer(): Promise<boolean>;
