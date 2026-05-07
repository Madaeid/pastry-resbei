// Type declarations for daily-menu.js
// Daily menu page module — no ES exports (page-entry script).

/** A recipe entry within a day's menu */
interface DailyMenuEntry {
    id?: number;
    recipeId?: number;
    name: string;
    category?: string;
    photo?: string;
    ingredients?: string;
    instructions?: string;
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

/** Day name type */
type DayName = 'Saturday' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

// daily-menu.js is a self-executing page module with no exports.
export {};
