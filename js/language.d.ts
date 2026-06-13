// Type declarations for language.js
// Provides type safety for the i18n system without duplicating the large translation data.

/** All supported translation keys (based on the English locale) */
export type TranslationKey =
    | 'appTitle' | 'appSubtitle' | 'footer'
    | 'homeTab' | 'welcomeBadge' | 'heroTitle' | 'heroSubtitle'
    | 'browseStore' | 'addRecipeTab' | 'myRecipesTab' | 'upgrade'
    | 'dailyMenu' | 'calculator' | 'myCv' | 'editCv' | 'addCv'
    | 'dashboard' | 'logout' | 'store' | 'book' | 'editProfile'
    | 'premiumBadge' | 'whatsOnYourMind' | 'postBtn' | 'share' | 'video'
    | 'communityFeed' | 'noCommunityRecipes' | 'beFirstToShare'
    | 'chefsTab' | 'myChefsTab' | 'searchMyChefs'
    | 'noFollowedChefsTitle' | 'followedChefsEmptyDesc'
    | 'addPhoto' | 'myPhoto' | 'myGallery' | 'add'
    | 'signIn' | 'register' | 'username' | 'password' | 'confirmPassword'
    | 'email' | 'emailAddress' | 'phoneNumber' | 'birthday'
    | 'rememberMe' | 'forgotPassword' | 'createAccount'
    | 'recipeName' | 'category' | 'ingredients' | 'instructions'
    | 'prepTime' | 'cookTime' | 'servings' | 'difficulty'
    | 'searchRecipes' | 'recipes' | 'saveAsPdf' | 'clearAll'
    | 'view' | 'edit' | 'delete' | 'cancel' | 'confirm'
    | 'language' | 'english' | 'arabic'
    | string; // Allow arbitrary keys for extensibility

/** Supported language codes */
export type LanguageCode = 'en' | 'ar';

/** Translation dictionary shape */
export type TranslationDict = Record<string, string>;

/** Full translations object */
export const translations: Record<LanguageCode, TranslationDict>;

/** Get current language code from localStorage */
export function getCurrentLanguage(): LanguageCode;

/** Set and apply a language */
export function setLanguage(lang: LanguageCode): void;

/** Toggle between en/ar */
export function toggleLanguage(): void;

/** Get a translated string by key */
export function t(key: string): string;

/** Apply language to page (direction, data-i18n elements, etc.) */
export function applyLanguage(lang: LanguageCode): void;

/** Initialize the language system (apply + create toggle button) */
export function initLanguage(): void;

/** Create language toggle button in the DOM */
export function createLanguageToggle(): void;
