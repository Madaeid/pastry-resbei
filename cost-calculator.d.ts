// Type declarations for cost-calculator.js
// Cost calculator page module — no ES exports (page-entry script).

/** An ingredient row in the cost calculator */
interface CostIngredient {
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
}

/** Saved calculation */
interface SavedCalculation {
    id: string;
    recipeName: string;
    ingredients: CostIngredient[];
    laborCost: number;
    overheadCost: number;
    packagingCost: number;
    servings: number;
    profitMargin: number;
    totalCost: number;
    sellingPrice: number;
    savedAt: string;
}

// cost-calculator.js is a self-executing page module with no exports.
export {};
