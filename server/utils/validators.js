import { z } from 'zod';

// ===== Auth Schemas =====
export const registerSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters long'),
    email: z.string().email('Please enter a valid email address'),
    phone: z.string().optional().nullable(),
    birthday: z.string().optional().nullable(),
    password: z.string()
        .min(4, 'Password must be at least 4 characters long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
});

export const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required')
});

export const forgotPasswordSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    contactValue: z.string().min(1, 'Contact value is required'),
    method: z.enum(['email', 'phone']).default('email')
});

export const resetPasswordSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    code: z.string().length(6, 'Verification code must be 6 digits'),
    newPassword: z.string()
        .min(4, 'Password must be at least 4 characters long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
});

// ===== Wallet Schemas =====
export const depositSchema = z.object({
    amount: z.coerce.number().positive('Deposit amount must be positive').max(10000, 'Maximum deposit amount is $10,000'),
    cardLast4: z.string().optional().nullable(),
    cardBrand: z.string().optional().nullable()
});

export const transferSchema = z.object({
    recipientUsername: z.string().min(1, 'Recipient username is required'),
    amount: z.coerce.number().positive('Transfer amount must be positive').max(5000, 'Maximum transfer amount is $5,000'),
    note: z.string().optional().nullable()
});

export const changeCurrencySchema = z.object({
    newCurrency: z.string().length(3, 'Valid 3-letter currency code required')
});

// ===== Store Schemas =====
export const storeRecipeSchema = z.object({
    name: z.string().min(1, 'Recipe name is required'),
    description: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    difficulty: z.string().optional().nullable(),
    prepTime: z.coerce.number().min(0).optional().nullable(),
    cookTime: z.coerce.number().min(0).optional().nullable(),
    photo: z.any().optional().nullable(),
    video: z.any().optional().nullable(),
    ingredients: z.string().optional().nullable(),
    instructions: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    price: z.coerce.number().nonnegative('A valid price is required')
});

export const updateStoreRecipeSchema = storeRecipeSchema.partial();
