// Shared type definitions for Chef Book API services
// These types describe the shapes of data passed to and returned from the API.

// ─── API Response Wrappers ────────────────────────────────────────────────────

/** Standard wrapper returned by most service functions. */
export interface ApiResult<T = unknown> {
  response: Response;
  data: T;
}

/** Headers object used by fetch() */
export type HeadersInit = Record<string, string>;

// ─── Recipe Types ─────────────────────────────────────────────────────────────

export interface RecipeData {
  name: string;
  category?: string;
  ingredients: string;
  instructions: string;
  photo?: string;
  video?: string;
  visibility?: 'private' | 'public';
  notes?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: number;
  /** Used for quick-post social sharing */
  [key: string]: unknown;
}

export interface Recipe extends RecipeData {
  id: number;
  userId: number;
  author?: {
    username: string;
    name: string;
    pic?: string;
  };
  likes?: number;
  commentsCount?: number;
  sharedFrom?: Recipe | null;
  shared_from_id?: number | null;
  shared_from_store_id?: number | null;
  shared_notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Comment {
  id: number;
  recipeId: number;
  userId: number;
  text: string;
  parentId?: number | null;
  author?: {
    username: string;
    name: string;
    pic?: string;
  };
  likes?: number;
  createdAt?: string;
}

// ─── User Types ───────────────────────────────────────────────────────────────

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  email?: string;
  profilePicture?: string;
  bio?: string;
  isAdmin?: boolean;
  isPremium?: boolean;
  is_public?: string;
  gallery?: string[];
  cvFile?: string;
  recipesCount?: number;
}

export interface UserProfile extends PublicUser {
  phoneNumber?: string;
  allowed_viewers?: string[];
  createdAt?: string;
}

// ─── Wallet Types ─────────────────────────────────────────────────────────────

export interface WalletBalance {
  balance: number;
}

export interface WalletTransaction {
  id: number;
  type: string;
  amount: number;
  description?: string;
  createdAt?: string;
}

export interface TransferResult {
  message: string;
  newBalance?: number;
}

export interface DepositResult {
  message: string;
  newBalance?: number;
}

export interface WalletPurchaseBody {
  plan?: string;
  amount?: number;
  [key: string]: unknown;
}

export interface WalletPurchaseResult {
  message: string;
  newBalance?: number;
}

// ─── Store Types ──────────────────────────────────────────────────────────────

export interface StoreRecipeData {
  name: string;
  category?: string;
  ingredients: string;
  instructions: string;
  photo?: string;
  price: number;
  notes?: string;
  [key: string]: unknown;
}

export interface StoreRecipe extends StoreRecipeData {
  id: number;
  sellerId: number;
  seller?: {
    username: string;
    name: string;
    pic?: string;
  };
  salesCount?: number;
  createdAt?: string;
}

export interface CheckoutSessionResult {
  sessionId?: string;
  url?: string;
  error?: string;
}

// ─── Book Types ───────────────────────────────────────────────────────────────

export interface Book {
  id: number;
  title: string;
  description?: string;
  coverPhoto?: string;
  cover_photo?: string;
  price?: number;
  isPublic?: boolean;
  is_public?: boolean;
  theme?: string;
  author?: {
    username: string;
    name: string;
    pic?: string;
  };
  recipes?: Recipe[];
  createdAt?: string;
}

export interface BookMetadata {
  title?: string;
  description?: string;
  coverPhoto?: string;
  price?: number;
  isPublic?: boolean;
  theme?: string;
  [key: string]: unknown;
}

// ─── Subscription Types ──────────────────────────────────────────────────────

export interface SubscriptionStatus {
  isPremium: boolean;
  plan?: string;
  endDate?: string;
  isAdminPrivilege?: boolean;
  error?: string;
}

export interface SubscriptionCheckoutBody {
  plan?: string;
  successUrl?: string;
  cancelUrl?: string;
  [key: string]: unknown;
}

// ─── Admin Types ──────────────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  totalAdmins: number;
  totalRecipes: number;
  totalStoreRecipes?: number;
  totalBooks?: number;
}

export interface AdminAnalytics {
  [key: string]: unknown;
}

export interface AdminUserUpdate {
  username?: string;
  displayName?: string;
  email?: string;
  password?: string;
  isAdmin?: boolean;
  [key: string]: unknown;
}

// ─── Daily Menu Types ────────────────────────────────────────────────────────

export interface DailyMenuRecipe {
  id: number;
  name: string;
  category?: string;
  photo?: string;
}

// ─── Fetch Options ───────────────────────────────────────────────────────────

export interface AdminFetchOptions extends RequestInit {
  headers?: Record<string, string>;
}
