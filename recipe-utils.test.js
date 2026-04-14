import { describe, it, expect } from 'vitest';
import { getCategoryEmoji, getDifficultyText, formatRecipeTime } from './recipe-utils.js';

describe('Recipe Utilities', () => {
    describe('getCategoryEmoji', () => {
        it('should return correct emoji for known categories', () => {
            expect(getCategoryEmoji('cakes')).toBe('🎂');
            expect(getCategoryEmoji('cookies')).toBe('🍪');
            expect(getCategoryEmoji('pastries')).toBe('🥐');
        });

        it('should be case-insensitive', () => {
            expect(getCategoryEmoji('CAKES')).toBe('🎂');
            expect(getCategoryEmoji('Cookies')).toBe('🍪');
        });

        it('should return default emoji for unknown categories', () => {
            expect(getCategoryEmoji('unknown')).toBe('🧁');
        });

        it('should return default emoji for null/undefined', () => {
            expect(getCategoryEmoji(null)).toBe('🧁');
            expect(getCategoryEmoji(undefined)).toBe('🧁');
        });
    });

    describe('getDifficultyText', () => {
        it('should return correct text and emoji for known difficulties', () => {
            expect(getDifficultyText('easy')).toBe('🟢 Easy');
            expect(getDifficultyText('medium')).toBe('🟡 Medium');
            expect(getDifficultyText('hard')).toBe('🔴 Hard');
        });

        it('should be case-insensitive', () => {
            expect(getDifficultyText('EASY')).toBe('🟢 Easy');
        });

        it('should return default for unknown difficulty', () => {
            expect(getDifficultyText('extreme')).toBe('🟡 Medium');
        });
    });

    describe('formatRecipeTime', () => {
        it('should add prepTime and cookTime', () => {
            expect(formatRecipeTime(10, 20)).toBe(30);
        });

        it('should handle missing values', () => {
            expect(formatRecipeTime(10, null)).toBe(10);
            expect(formatRecipeTime(undefined, 20)).toBe(20);
            expect(formatRecipeTime(null, undefined)).toBe(0);
        });
    });
});
