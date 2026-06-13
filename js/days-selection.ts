// Days Selection Page - Choose a day to add recipes
import '../css/style.css';
import { isLoggedIn, logout } from './auth.js';
import { initLanguage } from './language.js';

/** Day configuration shape */
interface DayConfig {
    name: string;
    short: string;
    emoji: string;
    color: string;
}

// Days configuration (Saturday to Friday)
const DAYS: DayConfig[] = [
    { name: 'Saturday', short: 'Sat', emoji: '🌟', color: '#ff6b8a' },
    { name: 'Sunday', short: 'Sun', emoji: '☀️', color: '#ffb347' },
    { name: 'Monday', short: 'Mon', emoji: '🌙', color: '#a855f7' },
    { name: 'Tuesday', short: 'Tue', emoji: '🔥', color: '#ef4444' },
    { name: 'Wednesday', short: 'Wed', emoji: '💚', color: '#22c55e' },
    { name: 'Thursday', short: 'Thu', emoji: '⚡', color: '#3b82f6' },
    { name: 'Friday', short: 'Fri', emoji: '🎉', color: '#ec4899' }
];

// Initialize app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function initApp(): void {
    // Initialize language system
    initLanguage();

    if (!isLoggedIn()) {
        window.location.href = './auth.html';
        return;
    }

    setupEventListeners();
    renderDaysGrid();
}

function setupEventListeners(): void {
    document.getElementById('logoutBtn')!.addEventListener('click', logout);
}

function renderDaysGrid(): void {
    const daysGrid = document.getElementById('daysGrid')!;

    daysGrid.innerHTML = DAYS.map((day, index) => `
        <button class="day-btn" onclick="navigateToDay('${day.name}')" style="--day-color: ${day.color}; animation-delay: ${index * 0.1}s">
            <div class="day-btn-glow"></div>
            <div class="day-btn-content">
                <span class="day-emoji">${day.emoji}</span>
                <span class="day-name">${day.name}</span>
                <span class="day-arrow">→</span>
            </div>
        </button>
    `).join('');
}

(window as any).navigateToDay = function (dayName: string): void {
    // Navigate to daily-menu with the selected day
    window.location.href = `./daily-menu.html?day=${encodeURIComponent(dayName)}`;
};
