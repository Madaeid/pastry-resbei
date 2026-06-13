// Days Selection Page - Choose a day to add recipes
import '../css/style.css';
import { isLoggedIn, logout, getCurrentUser } from './auth.js';
import { initLanguage, t, getCurrentLanguage } from './language.js';

// Days configuration (Saturday to Friday)
const DAYS = [
    { name: 'Saturday', short: 'Sat', emoji: '🌟', color: '#ff6b8a' },
    { name: 'Sunday', short: 'Sun', emoji: '☀️', color: '#ffb347' },
    { name: 'Monday', short: 'Mon', emoji: '🌙', color: '#a855f7' },
    { name: 'Tuesday', short: 'Tue', emoji: '🔥', color: '#ef4444' },
    { name: 'Wednesday', short: 'Wed', emoji: '💚', color: '#22c55e' },
    { name: 'Thursday', short: 'Thu', emoji: '⚡', color: '#3b82f6' },
    { name: 'Friday', short: 'Fri', emoji: '🎉', color: '#ec4899' }
];

// Ingredient category rules for auto-classification
const CATEGORY_RULES = [
    { name: 'Dairy & Eggs', emoji: '🥛', keywords: ['milk', 'cream', 'butter', 'cheese', 'yogurt', 'egg', 'eggs', 'whipping', 'sour cream', 'buttermilk', 'curd', 'ghee', 'paneer', 'mozzarella', 'parmesan', 'cheddar', 'ricotta', 'mascarpone', 'condensed milk'] },
    { name: 'Produce', emoji: '🥬', keywords: ['tomato', 'onion', 'garlic', 'lettuce', 'spinach', 'carrot', 'potato', 'pepper', 'lemon', 'lime', 'apple', 'banana', 'berry', 'berries', 'strawberr', 'blueberr', 'raspberr', 'orange', 'avocado', 'cucumber', 'celery', 'broccoli', 'mushroom', 'ginger', 'herb', 'basil', 'cilantro', 'parsley', 'mint', 'thyme', 'rosemary', 'oregano', 'chive', 'dill', 'sage', 'scallion', 'shallot', 'zucchini', 'squash', 'corn', 'pea', 'bean', 'asparagus', 'kale', 'cabbage', 'fennel', 'peach', 'pear', 'mango', 'pineapple', 'watermelon', 'grape', 'cherry', 'plum', 'fig', 'pomegranate', 'date'] },
    { name: 'Meat & Seafood', emoji: '🥩', keywords: ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'shrimp', 'prawn', 'tuna', 'sausage', 'bacon', 'ham', 'steak', 'ground meat', 'mince', 'veal', 'duck', 'crab', 'lobster', 'meatball', 'fillet'] },
    { name: 'Baking & Grains', emoji: '🌾', keywords: ['flour', 'sugar', 'baking', 'yeast', 'bread', 'rice', 'pasta', 'noodle', 'oat', 'cereal', 'cornstarch', 'cocoa', 'chocolate', 'vanilla', 'extract', 'powder', 'soda', 'cake', 'tortilla', 'crumb', 'semolina', 'polenta', 'couscous', 'quinoa', 'barley', 'rye', 'wheat'] },
    { name: 'Oils & Condiments', emoji: '🫒', keywords: ['oil', 'olive', 'vinegar', 'soy sauce', 'ketchup', 'mustard', 'mayonnaise', 'sauce', 'dressing', 'honey', 'syrup', 'molasses', 'jam', 'pesto', 'salsa', 'worcestershire', 'hot sauce', 'sriracha', 'tahini', 'hummus'] },
    { name: 'Spices & Seasonings', emoji: '🧂', keywords: ['salt', 'pepper', 'cinnamon', 'cumin', 'paprika', 'turmeric', 'chili', 'nutmeg', 'clove', 'cardamom', 'coriander', 'saffron', 'bay leaf', 'allspice', 'curry', 'seasoning', 'spice', 'cayenne', 'anise'] },
    { name: 'Nuts & Seeds', emoji: '🥜', keywords: ['almond', 'walnut', 'peanut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'nut', 'seed', 'sesame', 'sunflower', 'pumpkin seed', 'flax', 'chia', 'coconut'] },
    { name: 'Canned & Packaged', emoji: '🥫', keywords: ['can ', 'canned', 'tin ', 'tinned', 'broth', 'stock', 'bouillon', 'tomato paste', 'tomato sauce', 'coconut milk', 'chickpea', 'lentil'] },
    { name: 'Beverages', emoji: '🥤', keywords: ['water', 'juice', 'coffee', 'tea', 'wine', 'beer', 'soda', 'sparkling', 'lemonade', 'smoothie'] },
    { name: 'Frozen', emoji: '🧊', keywords: ['frozen', 'ice cream', 'puff pastry', 'phyllo', 'filo'] },
];

// Initialize app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function initApp() {
    // Initialize language system
    initLanguage();

    if (!isLoggedIn()) {
        window.location.href = './auth.html';
        return;
    }

    setupEventListeners();
    renderDaysGrid();
}

function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Shopping list
    const shoppingBtn = document.getElementById('shoppingListBtn');
    if (shoppingBtn) {
        shoppingBtn.addEventListener('click', openShoppingList);
    }

    const closeBtn = document.getElementById('closeShoppingListModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeShoppingList);
    }

    const modal = document.getElementById('shoppingListModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeShoppingList();
        });
    }

    // Shopping list actions
    const copyBtn = document.getElementById('shoppingCopyBtn');
    if (copyBtn) copyBtn.addEventListener('click', copyShoppingList);

    const exportBtn = document.getElementById('shoppingExportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportShoppingList);

    const shareBtn = document.getElementById('shoppingShareBtn');
    if (shareBtn) shareBtn.addEventListener('click', shareShoppingList);

    const clearBtn = document.getElementById('shoppingClearChecked');
    if (clearBtn) clearBtn.addEventListener('click', clearCheckedItems);

    // Show share button if Web Share API is available
    if (navigator.share) {
        const sb = document.getElementById('shoppingShareBtn');
        if (sb) sb.style.display = 'inline-flex';
    }
}

function renderDaysGrid() {
    const daysGrid = document.getElementById('daysGrid');

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

window.navigateToDay = function (dayName) {
    // Navigate to daily-menu with the selected day
    window.location.href = `./daily-menu.html?day=${encodeURIComponent(dayName)}`;
};

// ===== Shopping List Feature =====
let shoppingItems = []; // { text, category, checked, fromDay, fromRecipe }
let activeFilter = 'all';

function openShoppingList() {
    const modal = document.getElementById('shoppingListModal');
    if (!modal) return;

    // Parse ingredients from all days
    shoppingItems = collectAllIngredients();

    if (shoppingItems.length === 0) {
        document.getElementById('shoppingListSubtitle').textContent =
            'No recipes found in your meal plan. Add some recipes to your daily menu first!';
        document.getElementById('shoppingListBody').innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <div style="font-size: 4rem; margin-bottom: 15px; opacity: 0.5;">🛒</div>
                <h3 style="color: var(--text-primary); margin-bottom: 8px;">Your Cart is Empty</h3>
                <p>Plan meals for the week first, then come back to generate your shopping list.</p>
            </div>
        `;
        document.getElementById('shoppingFilterTabs').innerHTML = '';
    } else {
        const totalRecipes = DAYS.reduce((sum, day) => {
            const key = `dayRecipes_${day.name}_${getCurrentUser()}`;
            const stored = localStorage.getItem(key);
            if (stored) {
                try { return sum + JSON.parse(stored).length; } catch { return sum; }
            }
            return sum;
        }, 0);

        document.getElementById('shoppingListSubtitle').textContent =
            `${shoppingItems.length} ingredients from ${totalRecipes} recipe${totalRecipes !== 1 ? 's' : ''} across your week`;

        renderFilterTabs();
        renderShoppingList();
    }

    modal.classList.add('show');
}

function closeShoppingList() {
    const modal = document.getElementById('shoppingListModal');
    if (modal) modal.classList.remove('show');
}

function collectAllIngredients() {
    const user = getCurrentUser();
    const allItems = [];

    DAYS.forEach(day => {
        const key = `dayRecipes_${day.name}_${user}`;
        const stored = localStorage.getItem(key);
        if (!stored) return;

        let recipes;
        try { recipes = JSON.parse(stored); } catch { return; }

        recipes.forEach(recipe => {
            if (!recipe.ingredients || !recipe.ingredients.trim()) return;

            const lines = recipe.ingredients.split('\n').filter(l => l.trim());
            lines.forEach(line => {
                const cleaned = line.trim()
                    .replace(/^[-•*]\s*/, '')  // Remove bullet markers
                    .replace(/^\d+\.\s*/, ''); // Remove numbered markers

                if (!cleaned || cleaned.length < 2) return;

                const category = categorizeIngredient(cleaned);
                allItems.push({
                    text: cleaned,
                    category: category.name,
                    categoryEmoji: category.emoji,
                    fromDay: day.name,
                    fromRecipe: recipe.name,
                    checked: false
                });
            });
        });
    });

    // Sort by category, then alphabetically
    allItems.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.text.localeCompare(b.text);
    });

    return allItems;
}

function categorizeIngredient(text) {
    const lower = text.toLowerCase();

    for (const rule of CATEGORY_RULES) {
        if (rule.keywords.some(kw => lower.includes(kw))) {
            return { name: rule.name, emoji: rule.emoji };
        }
    }

    return { name: 'Other', emoji: '📦' };
}

function renderFilterTabs() {
    const tabsContainer = document.getElementById('shoppingFilterTabs');
    if (!tabsContainer) return;

    // Get unique categories
    const categories = [...new Set(shoppingItems.map(i => i.category))];

    let html = `<button class="shopping-tab ${activeFilter === 'all' ? 'active' : ''}" data-filter="all" onclick="filterShoppingList('all')">📋 All (${shoppingItems.length})</button>`;

    categories.forEach(cat => {
        const count = shoppingItems.filter(i => i.category === cat).length;
        const emoji = shoppingItems.find(i => i.category === cat)?.categoryEmoji || '📦';
        html += `<button class="shopping-tab ${activeFilter === cat ? 'active' : ''}" data-filter="${cat}" onclick="filterShoppingList('${cat}')">${emoji} ${cat} (${count})</button>`;
    });

    tabsContainer.innerHTML = html;
}

function renderShoppingList() {
    const body = document.getElementById('shoppingListBody');
    if (!body) return;

    const filtered = activeFilter === 'all'
        ? shoppingItems
        : shoppingItems.filter(i => i.category === activeFilter);

    if (filtered.length === 0) {
        body.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No items in this category.</div>`;
        return;
    }

    // Group by category
    const grouped = {};
    filtered.forEach(item => {
        if (!grouped[item.category]) {
            grouped[item.category] = { emoji: item.categoryEmoji, items: [] };
        }
        grouped[item.category].items.push(item);
    });

    let html = '';
    Object.entries(grouped).forEach(([catName, catData]) => {
        html += `
            <div class="shopping-category-group">
                <div class="shopping-category-header">
                    <span class="shopping-category-emoji">${catData.emoji}</span>
                    <span class="shopping-category-name">${catName}</span>
                    <span class="shopping-category-count">${catData.items.length}</span>
                </div>
                <div class="shopping-items-list">
        `;

        catData.items.forEach((item) => {
            const globalIdx = shoppingItems.indexOf(item);
            html += `
                <label class="shopping-item ${item.checked ? 'checked' : ''}" for="item-${globalIdx}">
                    <input type="checkbox" id="item-${globalIdx}" ${item.checked ? 'checked' : ''} 
                           onchange="toggleShoppingItem(${globalIdx})">
                    <span class="shopping-item-check"></span>
                    <span class="shopping-item-text">${escapeHtml(item.text)}</span>
                    <span class="shopping-item-source" title="${item.fromDay} — ${item.fromRecipe}">${DAYS.find(d => d.name === item.fromDay)?.emoji || '📅'}</span>
                </label>
            `;
        });

        html += `</div></div>`;
    });

    body.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.filterShoppingList = function (filter) {
    activeFilter = filter;
    renderFilterTabs();
    renderShoppingList();
};

window.toggleShoppingItem = function (index) {
    if (shoppingItems[index]) {
        shoppingItems[index].checked = !shoppingItems[index].checked;
        renderShoppingList();
    }
};

function getShoppingListText() {
    const filtered = activeFilter === 'all'
        ? shoppingItems
        : shoppingItems.filter(i => i.category === activeFilter);

    const grouped = {};
    filtered.forEach(item => {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
    });

    let text = '🛒 WEEKLY SHOPPING LIST — Chef Book\n';
    text += '═'.repeat(40) + '\n\n';

    Object.entries(grouped).forEach(([catName, items]) => {
        const emoji = items[0]?.categoryEmoji || '📦';
        text += `${emoji} ${catName.toUpperCase()}\n`;
        text += '─'.repeat(30) + '\n';
        items.forEach(item => {
            const check = item.checked ? '✅' : '☐';
            text += `  ${check} ${item.text}\n`;
        });
        text += '\n';
    });

    text += `\nGenerated: ${new Date().toLocaleDateString()}\n`;
    return text;
}

function copyShoppingList() {
    const text = getShoppingListText();
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('shoppingCopyBtn');
        const orig = btn.innerHTML;
        btn.innerHTML = '<span>✅</span> Copied!';
        setTimeout(() => { btn.innerHTML = orig; }, 2000);
    });
}

function exportShoppingList() {
    const text = getShoppingListText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `shopping_list_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();

    URL.revokeObjectURL(url);

    const btn = document.getElementById('shoppingExportBtn');
    const orig = btn.innerHTML;
    btn.innerHTML = '<span>✅</span> Exported!';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
}

function shareShoppingList() {
    const text = getShoppingListText();
    navigator.share({
        title: '🛒 Weekly Shopping List — Chef Book',
        text: text
    }).catch(() => { /* User cancelled share */ });
}

function clearCheckedItems() {
    shoppingItems = shoppingItems.filter(item => !item.checked);
    renderFilterTabs();
    renderShoppingList();

    // Update subtitle
    document.getElementById('shoppingListSubtitle').textContent =
        `${shoppingItems.length} ingredient${shoppingItems.length !== 1 ? 's' : ''} remaining`;
}
