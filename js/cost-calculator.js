// Cost Calculator Module for Chef Book
import '../css/style.css';
import { isLoggedIn, logout, getCurrentUser } from './auth.js';
import { jsPDF } from 'jspdf';
import { initLanguage, t, getCurrentLanguage } from './language.js';

// ===== State =====
let ingredients = [];
let savedCalculations = [];

// ===== Currency Configuration =====
const currencies = {
    'USD': { symbol: '$', name: 'US Dollar', position: 'before' },
    'SAR': { symbol: 'ر.س', name: 'Saudi Riyal', position: 'after' },
    'EGP': { symbol: 'ج.م', name: 'Egyptian Pound', position: 'after' }
};

let currentCurrency = 'USD';

// ===== DOM Elements =====
document.addEventListener('DOMContentLoaded', () => {
    initUserHeader();
    initCalculator();
});

// ===== User Header Initialization =====
function initUserHeader() {
    const currentUser = getCurrentUser();
    const userHeader = document.getElementById('userHeader');
    const userName = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');
    const dailyMenuBtn = document.getElementById('dailyMenuBtn');

    if (currentUser && userHeader) {
        // Show user header
        userHeader.style.display = 'flex';

        // Get user data from localStorage
        const users = JSON.parse(localStorage.getItem('pastryUsers') || '{}');
        const userData = users[currentUser.toLowerCase()];

        if (userData) {
            userName.textContent = userData.displayName || currentUser;

            // Show profile picture if exists
            const profilePic = document.getElementById('userProfilePic');
            const defaultAvatar = document.getElementById('userDefaultAvatar');

            if (userData.profilePicture && profilePic) {
                profilePic.src = userData.profilePicture;
                profilePic.style.display = 'block';
                if (defaultAvatar) defaultAvatar.style.display = 'none';
            }

            // Check premium status and show daily menu button
            const premiumStatus = localStorage.getItem(`premium_${currentUser.toLowerCase()}`);
            if (premiumStatus === 'true' && dailyMenuBtn) {
                dailyMenuBtn.style.display = 'inline-flex';
            }
        }
    }

    // Logout button handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => logout());
    }
}

function initCalculator() {
    // Initialize language system
    initLanguage();

    // Load currency preference
    loadCurrencyPreference();

    // Load saved calculations from localStorage
    loadSavedCalculations();

    // Add initial empty ingredient row
    addIngredientRow();

    // Event Listeners
    document.getElementById('addIngredientBtn').addEventListener('click', () => addIngredientRow());
    document.getElementById('resetBtn').addEventListener('click', resetCalculator);
    document.getElementById('saveBtn').addEventListener('click', saveCalculation);
    document.getElementById('clearAllBtn').addEventListener('click', clearAllCalculations);

    // Profit margin slider
    const profitSlider = document.getElementById('profitMargin');
    const profitDisplay = document.getElementById('profitMarginValue');
    profitSlider.addEventListener('input', () => {
        profitDisplay.textContent = profitSlider.value;
        calculateAll();
    });

    // Additional costs inputs
    ['laborCost', 'overheadCost', 'packagingCost', 'servings'].forEach(id => {
        document.getElementById(id).addEventListener('input', calculateAll);
    });

    // Import from My Recipes button
    const importRecipeBtn = document.getElementById('importRecipeBtn');
    if (importRecipeBtn) {
        importRecipeBtn.addEventListener('click', openImportModal);
    }

    // Import modal event listeners
    setupImportModal();

    // Price Table button and modal
    const priceTableBtn = document.getElementById('priceTableBtn');
    if (priceTableBtn) {
        priceTableBtn.addEventListener('click', openPriceTableModal);
    }
    setupPriceTableModal();

    // Download PDF button
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', downloadPDF);
    }

    // Initial calculation
    calculateAll();
    renderSavedCalculations();
}

// ===== Import from My Recipes Functionality =====
function getUserRecipeKey() {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;
    return `pastryRecipes_${currentUser.toLowerCase()}`;
}

function getUserRecipes() {
    const key = getUserRecipeKey();
    if (!key) return [];
    return JSON.parse(localStorage.getItem(key) || '[]');
}

function setupImportModal() {
    const modal = document.getElementById('importRecipeModal');
    const closeBtn = document.getElementById('closeImportModal');
    const searchInput = document.getElementById('importRecipeSearch');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeImportModal);
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeImportModal();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterImportRecipes(searchTerm);
        });
    }
}

function openImportModal() {
    const modal = document.getElementById('importRecipeModal');
    const searchInput = document.getElementById('importRecipeSearch');

    if (searchInput) {
        searchInput.value = '';
    }

    loadImportRecipes();

    if (modal) {
        modal.classList.add('show');
    }
}

function closeImportModal() {
    const modal = document.getElementById('importRecipeModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function loadImportRecipes(filterTerm = '') {
    const recipes = getUserRecipes();
    const listContainer = document.getElementById('importRecipesList');
    const emptyState = document.getElementById('importEmptyState');

    if (!listContainer) return;

    // Filter recipes if search term provided
    const filteredRecipes = filterTerm
        ? recipes.filter(recipe =>
            recipe.name.toLowerCase().includes(filterTerm) ||
            recipe.category.toLowerCase().includes(filterTerm) ||
            recipe.ingredients.toLowerCase().includes(filterTerm)
        )
        : recipes;

    if (filteredRecipes.length === 0) {
        listContainer.innerHTML = '';
        if (emptyState) {
            emptyState.style.display = 'block';
            emptyState.querySelector('p').textContent = filterTerm
                ? `No recipes match "${filterTerm}"`
                : 'You have no saved recipes yet';
        }
        return;
    }

    if (emptyState) {
        emptyState.style.display = 'none';
    }

    listContainer.innerHTML = filteredRecipes.map(recipe => `
        <div class="import-recipe-item" data-id="${recipe.id}">
            <div class="import-recipe-image">
                ${recipe.photo
            ? `<img src="${recipe.photo}" alt="${recipe.name}">`
            : `<span class="placeholder-emoji">${getCategoryEmoji(recipe.category)}</span>`
        }
            </div>
            <div class="import-recipe-info">
                <div class="import-recipe-name">${recipe.name}</div>
                <div class="import-recipe-meta">
                    <span>📂 ${recipe.category}</span>
                    <span>🍽️ ${recipe.servings} servings</span>
                </div>
            </div>
            <button class="import-recipe-btn" data-id="${recipe.id}">
                📥 Import
            </button>
        </div>
    `).join('');

    // Add click handlers
    listContainer.querySelectorAll('.import-recipe-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const recipeId = parseInt(btn.dataset.id);
            importRecipe(recipeId);
        });
    });

    // Also allow clicking the whole item
    listContainer.querySelectorAll('.import-recipe-item').forEach(item => {
        item.addEventListener('click', () => {
            const recipeId = parseInt(item.dataset.id);
            importRecipe(recipeId);
        });
    });
}

function filterImportRecipes(searchTerm) {
    loadImportRecipes(searchTerm);
}

function getCategoryEmoji(category) {
    const emojis = {
        'Cakes': '🎂',
        'Cookies': '🍪',
        'Breads': '🍞',
        'Pastries': '🥐',
        'Desserts': '🍰',
        'Pies': '🥧',
        'Sauces': '🍯',
        'Other': '🧁'
    };
    return emojis[category] || '🧁';
}

function importRecipe(recipeId) {
    const recipes = getUserRecipes();
    const recipe = recipes.find(r => r.id === recipeId);

    if (!recipe) {
        showNotification('Recipe not found', 'error');
        return;
    }

    // Set recipe name
    document.getElementById('recipeName').value = recipe.name;

    // Set servings if available
    if (recipe.servings) {
        document.getElementById('servings').value = recipe.servings;
    }

    // Parse and import ingredients
    const ingredientLines = recipe.ingredients.split('\n').filter(line => line.trim());

    if (ingredientLines.length > 0) {
        // Clear existing ingredients
        ingredients = [];
        document.getElementById('ingredientsList').innerHTML = '';

        let pricesFound = 0;
        let pricesMissing = 0;

        // Parse each ingredient line and add as a row
        ingredientLines.forEach(line => {
            const parsed = parseIngredientLine(line.trim());

            // Try to get price from price table
            const priceFromTable = getPriceForIngredient(parsed.name, parsed.unit);

            if (priceFromTable > 0) {
                pricesFound++;
            } else {
                pricesMissing++;
            }

            const ingredientData = {
                id: Date.now() + Math.random(),
                name: parsed.name,
                quantity: parsed.quantity,
                unit: parsed.unit,
                unitPrice: priceFromTable // Auto-fill from price table
            };
            ingredients.push(ingredientData);
            addIngredientRow(ingredientData);
        });

        closeImportModal();
        calculateAll();

        // Show appropriate notification
        if (pricesFound > 0 && pricesMissing === 0) {
            showNotification(`✅ Imported "${recipe.name}" with all prices filled!`, 'success');
        } else if (pricesFound > 0) {
            showNotification(`✅ Imported "${recipe.name}" - ${pricesFound} prices found, ${pricesMissing} need to be added`, 'success');
        } else {
            showNotification(`✅ Imported "${recipe.name}" - Add prices from Price Table for auto-fill`, 'success');
        }
    } else {
        closeImportModal();
        showNotification(`✅ Imported "${recipe.name}" - No ingredients found`, 'success');
    }
}

function parseIngredientLine(line) {
    // Try to parse ingredient lines like:
    // "2 cups flour", "500g sugar", "1 tsp vanilla", "3 eggs"

    // Pattern to match quantity, unit, and ingredient name
    const patterns = [
        // Match: "2 cups flour" or "1/2 cup sugar"
        /^([\d./]+)\s*(cups?|cup|tbsp|tsp|teaspoons?|tablespoons?|g|kg|ml|L|liters?|oz|ounces?|lb|lbs|pounds?|pcs?|pieces?)\s+(.+)$/i,
        // Match: "500g sugar" (no space between number and unit)
        /^([\d./]+)(g|kg|ml|L|oz|lb)\s*(.+)$/i,
        // Match: "3 eggs" (just number and ingredient)
        /^([\d./]+)\s+(.+)$/,
        // Match: anything else
        /^(.+)$/
    ];

    for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
            if (match.length === 4) {
                // Matched quantity, unit, and name
                return {
                    quantity: parseQuantity(match[1]),
                    unit: normalizeUnit(match[2]),
                    name: match[3].trim()
                };
            } else if (match.length === 3) {
                // Matched quantity and name (no unit)
                return {
                    quantity: parseQuantity(match[1]),
                    unit: 'pcs',
                    name: match[2].trim()
                };
            } else if (match.length === 2) {
                // Just ingredient name
                return {
                    quantity: 1,
                    unit: 'pcs',
                    name: match[1].trim()
                };
            }
        }
    }

    // Fallback
    return {
        quantity: 1,
        unit: 'pcs',
        name: line
    };
}

function parseQuantity(str) {
    // Handle fractions like "1/2"
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 2) {
            return parseFloat(parts[0]) / parseFloat(parts[1]);
        }
    }
    return parseFloat(str) || 1;
}

function normalizeUnit(unit) {
    const unitMap = {
        'cup': 'cup',
        'cups': 'cup',
        'tbsp': 'tbsp',
        'tablespoon': 'tbsp',
        'tablespoons': 'tbsp',
        'tsp': 'tsp',
        'teaspoon': 'tsp',
        'teaspoons': 'tsp',
        'g': 'g',
        'gram': 'g',
        'grams': 'g',
        'kg': 'kg',
        'kilogram': 'kg',
        'kilograms': 'kg',
        'ml': 'ml',
        'milliliter': 'ml',
        'milliliters': 'ml',
        'l': 'L',
        'liter': 'L',
        'liters': 'L',
        'oz': 'pcs',
        'ounce': 'pcs',
        'ounces': 'pcs',
        'lb': 'kg',
        'lbs': 'kg',
        'pound': 'kg',
        'pounds': 'kg',
        'pc': 'pcs',
        'pcs': 'pcs',
        'piece': 'pcs',
        'pieces': 'pcs'
    };

    const normalized = unit.toLowerCase().trim();
    return unitMap[normalized] || 'pcs';
}

// ===== Currency Functions =====
function formatCurrency(amount) {
    const currency = currencies[currentCurrency];
    const formatted = parseFloat(amount).toFixed(2);
    if (currency.position === 'before') {
        return `${currency.symbol}${formatted}`;
    } else {
        return `${formatted} ${currency.symbol}`;
    }
}

function formatCurrencyWithPrecision(amount, decimals = 4) {
    const currency = currencies[currentCurrency];
    const formatted = parseFloat(amount).toFixed(decimals);
    if (currency.position === 'before') {
        return `${currency.symbol}${formatted}`;
    } else {
        return `${formatted} ${currency.symbol}`;
    }
}

function getCurrencyKey() {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;
    return `currency_${currentUser.toLowerCase()}`;
}

function loadCurrencyPreference() {
    const key = getCurrencyKey();
    if (!key) return;
    const saved = localStorage.getItem(key);
    if (saved && currencies[saved]) {
        currentCurrency = saved;
    }
    updateAllCurrencyDisplays();
}

function saveCurrencyPreference() {
    const key = getCurrencyKey();
    if (!key) return;
    localStorage.setItem(key, currentCurrency);
}

function setCurrency(currency) {
    if (currencies[currency]) {
        currentCurrency = currency;
        saveCurrencyPreference();
        updateAllCurrencyDisplays();
        calculateAll();
        renderPriceItems();
        showNotification(`🌐 Currency changed to ${currencies[currency].name} (${currencies[currency].symbol})`, 'success');
    }
}

function updateAllCurrencyDisplays() {
    const symbol = currencies[currentCurrency].symbol;
    const position = currencies[currentCurrency].position;

    // Update all currency symbols in the page
    document.querySelectorAll('.currency-symbol').forEach(el => {
        if (position === 'before') {
            el.textContent = symbol;
            el.classList.remove('after');
            el.classList.add('before');
        } else {
            el.textContent = symbol;
            el.classList.remove('before');
            el.classList.add('after');
        }
    });

    // Update currency selector if exists
    const currencySelect = document.getElementById('currencySelect');
    if (currencySelect) {
        currencySelect.value = currentCurrency;
    }
}

// ===== Price Table Functionality =====
let priceItems = [];

function getPriceTableKey() {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;
    return `ingredientPrices_${currentUser.toLowerCase()}`;
}

function loadPriceItems() {
    const key = getPriceTableKey();
    if (!key) return [];
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
}

function savePriceItems() {
    const key = getPriceTableKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(priceItems));
}

function setupPriceTableModal() {
    const modal = document.getElementById('priceTableModal');
    const closeBtn = document.getElementById('closePriceTableModal');
    const closeBtn2 = document.getElementById('closePriceTableDoneBtn');
    const addBtn = document.getElementById('addPriceItemBtn');
    const clearAllBtn = document.getElementById('clearAllPricesBtn');
    const searchInput = document.getElementById('priceTableSearch');

    // Load price items
    priceItems = loadPriceItems();

    if (closeBtn) {
        closeBtn.addEventListener('click', closePriceTableModal);
    }

    if (closeBtn2) {
        closeBtn2.addEventListener('click', closePriceTableModal);
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closePriceTableModal();
        });
    }

    if (addBtn) {
        addBtn.addEventListener('click', addPriceItem);
    }

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllPriceItems);
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            renderPriceItems(searchTerm);
        });
    }

    // Allow Enter key to add item
    const nameInput = document.getElementById('newItemName');
    const priceInput = document.getElementById('newItemPrice');
    [nameInput, priceInput].forEach(input => {
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    addPriceItem();
                }
            });
        }
    });

    // Currency selector event listener
    const currencySelect = document.getElementById('currencySelect');
    if (currencySelect) {
        currencySelect.value = currentCurrency;
        currencySelect.addEventListener('change', (e) => {
            setCurrency(e.target.value);
        });
    }
}

function openPriceTableModal() {
    const modal = document.getElementById('priceTableModal');
    const searchInput = document.getElementById('priceTableSearch');

    // Clear inputs
    document.getElementById('newItemName').value = '';
    document.getElementById('newItemUnit').value = 'pcs';
    document.getElementById('newItemPrice').value = '';
    if (searchInput) searchInput.value = '';

    // Reload price items
    priceItems = loadPriceItems();
    renderPriceItems();

    if (modal) {
        modal.classList.add('show');
    }
}

function closePriceTableModal() {
    const modal = document.getElementById('priceTableModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function addPriceItem() {
    const nameInput = document.getElementById('newItemName');
    const unitSelect = document.getElementById('newItemUnit');
    const priceInput = document.getElementById('newItemPrice');

    const name = nameInput.value.trim();
    const unit = unitSelect.value;
    const price = parseFloat(priceInput.value) || 0;

    if (!name) {
        showNotification('Please enter an ingredient name', 'error');
        nameInput.focus();
        return;
    }

    if (price <= 0) {
        showNotification('Please enter a valid price', 'error');
        priceInput.focus();
        return;
    }

    // Check for duplicate (same name and unit)
    const existingIndex = priceItems.findIndex(
        item => item.name.toLowerCase() === name.toLowerCase() && item.unit === unit
    );

    if (existingIndex !== -1) {
        // Update existing
        priceItems[existingIndex].price = price;
        showNotification(`Updated price for "${name}"`, 'success');
    } else {
        // Add new
        priceItems.push({
            id: Date.now(),
            name: name,
            unit: unit,
            price: price
        });
        showNotification(`Added "${name}" to price table`, 'success');
    }

    savePriceItems();
    renderPriceItems();

    // Clear inputs
    nameInput.value = '';
    priceInput.value = '';
    nameInput.focus();
}

function deletePriceItem(id) {
    priceItems = priceItems.filter(item => item.id !== id);
    savePriceItems();
    renderPriceItems();
    showNotification('Item removed from price table', 'success');
}

function editPriceItem(id) {
    const item = priceItems.find(i => i.id === id);
    if (!item) return;

    // Populate form with item data
    document.getElementById('newItemName').value = item.name;
    document.getElementById('newItemUnit').value = item.unit;
    document.getElementById('newItemPrice').value = item.price;

    // Remove the item (will be re-added when user clicks Add)
    priceItems = priceItems.filter(i => i.id !== id);
    savePriceItems();
    renderPriceItems();

    document.getElementById('newItemName').focus();
}

function clearAllPriceItems() {
    if (priceItems.length === 0) {
        showNotification('Price table is already empty', 'error');
        return;
    }

    if (confirm('Are you sure you want to delete all items from the price table?')) {
        priceItems = [];
        savePriceItems();
        renderPriceItems();
        showNotification('All items cleared from price table', 'success');
    }
}

function renderPriceItems(filterTerm = '') {
    const listContainer = document.getElementById('priceItemsList');
    const emptyState = document.getElementById('priceTableEmpty');
    const tableContainer = document.querySelector('.price-items-table');

    if (!listContainer) return;

    // Filter items if search term provided
    const filteredItems = filterTerm
        ? priceItems.filter(item =>
            item.name.toLowerCase().includes(filterTerm) ||
            item.unit.toLowerCase().includes(filterTerm)
        )
        : priceItems;

    if (filteredItems.length === 0) {
        listContainer.innerHTML = '';
        if (tableContainer) tableContainer.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'block';
            emptyState.querySelector('p').textContent = filterTerm
                ? `No items match "${filterTerm}"`
                : 'No ingredients added yet';
        }
        return;
    }

    if (tableContainer) tableContainer.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    // Sort by name
    const sortedItems = [...filteredItems].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );

    listContainer.innerHTML = sortedItems.map(item => `
        <div class="price-item-row" data-id="${item.id}">
            <span class="item-name">${item.name}</span>
            <span class="item-unit">${item.unit}</span>
            <span class="item-price">${formatCurrency(item.price)}</span>
            <div class="item-actions">
                <button class="btn-edit-item" data-id="${item.id}" title="Edit">✏️</button>
                <button class="btn-delete-item" data-id="${item.id}" title="Delete">🗑️</button>
            </div>
        </div>
    `).join('');

    // Add event listeners
    listContainer.querySelectorAll('.btn-edit-item').forEach(btn => {
        btn.addEventListener('click', () => editPriceItem(parseInt(btn.dataset.id)));
    });

    listContainer.querySelectorAll('.btn-delete-item').forEach(btn => {
        btn.addEventListener('click', () => deletePriceItem(parseInt(btn.dataset.id)));
    });
}

// Unit conversion rates
const unitConversions = {
    // Weight conversions (base: g)
    'kg': { base: 'g', toBase: 1000, fromBase: 0.001 },
    'g': { base: 'g', toBase: 1, fromBase: 1 },

    // Volume conversions (base: ml)
    'L': { base: 'ml', toBase: 1000, fromBase: 0.001 },
    'ml': { base: 'ml', toBase: 1, fromBase: 1 },
    'cup': { base: 'ml', toBase: 240, fromBase: 1 / 240 },
    'tbsp': { base: 'ml', toBase: 15, fromBase: 1 / 15 },
    'tsp': { base: 'ml', toBase: 5, fromBase: 1 / 5 },

    // Pieces (no conversion)
    'pcs': { base: 'pcs', toBase: 1, fromBase: 1 }
};

// Get compatible units (same base unit)
function getCompatibleUnits(unit) {
    const conversion = unitConversions[unit];
    if (!conversion) return [unit];

    return Object.keys(unitConversions).filter(u =>
        unitConversions[u].base === conversion.base
    );
}

// Convert price from one unit to another
function convertPrice(price, fromUnit, toUnit) {
    const fromConv = unitConversions[fromUnit];
    const toConv = unitConversions[toUnit];

    if (!fromConv || !toConv) return price;
    if (fromConv.base !== toConv.base) return price; // Can't convert between different bases

    // Convert: price per fromUnit -> price per base unit -> price per toUnit
    // price/fromUnit -> price/base = price / toBase (of fromUnit)
    // price/base -> price/toUnit = pricePerBase * toBase (of toUnit)

    const pricePerBase = price / fromConv.toBase;
    const pricePerToUnit = pricePerBase * toConv.toBase;

    return pricePerToUnit;
}

// Function to get price from price table for an ingredient
function getPriceForIngredient(ingredientName, unit) {
    priceItems = loadPriceItems();

    // Normalize the ingredient name for matching
    const normalizedName = ingredientName.toLowerCase().trim();

    // Try exact match first (same name and unit)
    let match = priceItems.find(item =>
        item.name.toLowerCase() === normalizedName && item.unit === unit
    );

    if (match) return match.price;

    // Try partial match with same unit
    match = priceItems.find(item => {
        const itemName = item.name.toLowerCase();
        return (normalizedName.includes(itemName) || itemName.includes(normalizedName))
            && item.unit === unit;
    });

    if (match) return match.price;

    // Try matching with unit conversion
    const compatibleUnits = getCompatibleUnits(unit);

    for (const compatUnit of compatibleUnits) {
        if (compatUnit === unit) continue; // Already checked

        // Exact name match with compatible unit
        match = priceItems.find(item =>
            item.name.toLowerCase() === normalizedName && item.unit === compatUnit
        );

        if (match) {
            // Convert price from stored unit to requested unit
            return convertPrice(match.price, match.unit, unit);
        }

        // Partial name match with compatible unit
        match = priceItems.find(item => {
            const itemName = item.name.toLowerCase();
            return (normalizedName.includes(itemName) || itemName.includes(normalizedName))
                && item.unit === compatUnit;
        });

        if (match) {
            return convertPrice(match.price, match.unit, unit);
        }
    }

    return 0; // No match found
}

// Get price with conversion info for notifications
function getPriceForIngredientWithInfo(ingredientName, unit) {
    priceItems = loadPriceItems();

    // Normalize the ingredient name for matching
    const normalizedName = ingredientName.toLowerCase().trim();

    // Try exact match first (same name and unit)
    let match = priceItems.find(item =>
        item.name.toLowerCase() === normalizedName && item.unit === unit
    );

    if (match) {
        return { price: match.price, converted: false };
    }

    // Try partial match with same unit
    match = priceItems.find(item => {
        const itemName = item.name.toLowerCase();
        return (normalizedName.includes(itemName) || itemName.includes(normalizedName))
            && item.unit === unit;
    });

    if (match) {
        return { price: match.price, converted: false };
    }

    // Try matching with unit conversion
    const compatibleUnits = getCompatibleUnits(unit);

    for (const compatUnit of compatibleUnits) {
        if (compatUnit === unit) continue; // Already checked

        // Exact name match with compatible unit
        match = priceItems.find(item =>
            item.name.toLowerCase() === normalizedName && item.unit === compatUnit
        );

        if (match) {
            const convertedPrice = convertPrice(match.price, match.unit, unit);
            return {
                price: convertedPrice,
                converted: true,
                originalPrice: match.price,
                originalUnit: match.unit
            };
        }

        // Partial name match with compatible unit
        match = priceItems.find(item => {
            const itemName = item.name.toLowerCase();
            return (normalizedName.includes(itemName) || itemName.includes(normalizedName))
                && item.unit === compatUnit;
        });

        if (match) {
            const convertedPrice = convertPrice(match.price, match.unit, unit);
            return {
                price: convertedPrice,
                converted: true,
                originalPrice: match.price,
                originalUnit: match.unit
            };
        }
    }

    return { price: 0, converted: false }; // No match found
}

// ===== Ingredient Management =====
function addIngredientRow(data = null) {
    const id = Date.now();
    const ingredient = data || {
        id,
        name: '',
        quantity: 1,
        unit: 'pcs',
        unitPrice: 0
    };

    if (!data) {
        ingredients.push(ingredient);
    }

    const row = document.createElement('div');
    row.className = 'ingredient-row';
    row.dataset.id = ingredient.id;
    row.innerHTML = `
        <input type="text" class="ing-name" placeholder="Ingredient" value="${ingredient.name}">
        <input type="number" class="ing-qty" value="${ingredient.quantity}" min="0" step="0.1">
        <select class="ing-unit">
            <option value="pcs" ${ingredient.unit === 'pcs' ? 'selected' : ''}>pcs</option>
            <option value="g" ${ingredient.unit === 'g' ? 'selected' : ''}>g</option>
            <option value="kg" ${ingredient.unit === 'kg' ? 'selected' : ''}>kg</option>
            <option value="ml" ${ingredient.unit === 'ml' ? 'selected' : ''}>ml</option>
            <option value="L" ${ingredient.unit === 'L' ? 'selected' : ''}>L</option>
            <option value="cup" ${ingredient.unit === 'cup' ? 'selected' : ''}>cup</option>
            <option value="tbsp" ${ingredient.unit === 'tbsp' ? 'selected' : ''}>tbsp</option>
            <option value="tsp" ${ingredient.unit === 'tsp' ? 'selected' : ''}>tsp</option>
        </select>
        <div class="currency-input small">
            <span class="currency-symbol">${currencies[currentCurrency].symbol}</span>
            <input type="number" class="ing-price" value="${ingredient.unitPrice}" min="0" step="0.01">
        </div>
        <span class="ing-total">${formatCurrency(ingredient.quantity * ingredient.unitPrice)}</span>
        <button type="button" class="btn-delete" title="Remove">🗑️</button>
    `;

    document.getElementById('ingredientsList').appendChild(row);

    // Add event listeners
    const nameInput = row.querySelector('.ing-name');
    const unitSelect = row.querySelector('.ing-unit');
    const priceInput = row.querySelector('.ing-price');

    // Auto-fill price when name changes (with debounce)
    let nameTimeout;
    nameInput.addEventListener('input', (e) => {
        updateIngredient(ingredient.id, 'name', e.target.value);

        // Debounce the price lookup
        clearTimeout(nameTimeout);
        nameTimeout = setTimeout(() => {
            autoFillPrice(ingredient.id, row);
        }, 500); // Wait 500ms after user stops typing
    });

    // Auto-fill price when unit changes (force update to recalculate with new unit)
    unitSelect.addEventListener('change', (e) => {
        updateIngredient(ingredient.id, 'unit', e.target.value);
        autoFillPrice(ingredient.id, row, true); // Force update for unit conversion
    });

    row.querySelector('.ing-qty').addEventListener('input', (e) => updateIngredient(ingredient.id, 'quantity', parseFloat(e.target.value) || 0));
    priceInput.addEventListener('input', (e) => updateIngredient(ingredient.id, 'unitPrice', parseFloat(e.target.value) || 0));
    row.querySelector('.btn-delete').addEventListener('click', () => removeIngredientRow(ingredient.id));
}

// Auto-fill price from Price Table
function autoFillPrice(ingredientId, row, forceUpdate = false) {
    const ingredient = ingredients.find(i => i.id === ingredientId);
    if (!ingredient || !ingredient.name.trim()) return;

    const priceInput = row.querySelector('.ing-price');
    const currentPrice = parseFloat(priceInput.value) || 0;

    // Auto-fill if current price is 0, or if forceUpdate is true (unit changed)
    if (currentPrice === 0 || forceUpdate) {
        const result = getPriceForIngredientWithInfo(ingredient.name, ingredient.unit);
        if (result.price > 0) {
            ingredient.unitPrice = result.price;
            priceInput.value = result.price.toFixed(4); // More decimal places for unit conversions

            // Update total
            const total = ingredient.quantity * ingredient.unitPrice;
            row.querySelector('.ing-total').textContent = formatCurrency(total);

            calculateAll();

            // Show subtle feedback (green flash)
            priceInput.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
            setTimeout(() => {
                priceInput.style.backgroundColor = '';
            }, 1000);

            // Show notification if unit was converted
            if (result.converted) {
                showNotification(`💱 Converted: ${formatCurrency(result.originalPrice)}/${result.originalUnit} → ${formatCurrencyWithPrecision(result.price)}/${ingredient.unit}`, 'success');
            }
        }
    }
}

function updateIngredient(id, field, value) {
    const ingredient = ingredients.find(i => i.id === id);
    if (ingredient) {
        ingredient[field] = value;

        // Update row total
        const row = document.querySelector(`.ingredient-row[data-id="${id}"]`);
        if (row) {
            const total = ingredient.quantity * ingredient.unitPrice;
            row.querySelector('.ing-total').textContent = formatCurrency(total);
        }

        calculateAll();
    }
}

function removeIngredientRow(id) {
    ingredients = ingredients.filter(i => i.id !== id);
    const row = document.querySelector(`.ingredient-row[data-id="${id}"]`);
    if (row) {
        row.remove();
    }
    calculateAll();
}

// ===== Calculations =====
function calculateAll() {
    // Ingredients subtotal
    const ingredientsTotal = ingredients.reduce((sum, ing) => sum + (ing.quantity * ing.unitPrice), 0);
    document.getElementById('ingredientsSubtotal').textContent = formatCurrency(ingredientsTotal);

    // Additional costs
    const laborCost = parseFloat(document.getElementById('laborCost').value) || 0;
    const overheadCost = parseFloat(document.getElementById('overheadCost').value) || 0;
    const packagingCost = parseFloat(document.getElementById('packagingCost').value) || 0;
    const servings = parseInt(document.getElementById('servings').value) || 1;
    const profitMargin = parseInt(document.getElementById('profitMargin').value) || 0;

    // Total cost
    const totalCost = ingredientsTotal + laborCost + overheadCost + packagingCost;
    document.getElementById('totalCost').textContent = formatCurrency(totalCost);

    // Cost per serving
    const costPerServing = totalCost / servings;
    document.getElementById('costPerServing').textContent = formatCurrency(costPerServing);

    // Selling price (with margin)
    const sellingPrice = totalCost * (1 + profitMargin / 100);
    document.getElementById('sellingPrice').textContent = formatCurrency(sellingPrice);

    // Profit
    const profit = sellingPrice - totalCost;
    document.getElementById('profitAmount').textContent = formatCurrency(profit);

    // Per serving values
    const sellPerServing = sellingPrice / servings;
    const profitPerServing = profit / servings;
    document.getElementById('sellPerServing').textContent = formatCurrency(sellPerServing);
    document.getElementById('profitPerServing').textContent = formatCurrency(profitPerServing);
}

// ===== Save/Load Functionality =====
function saveCalculation() {
    const recipeName = document.getElementById('recipeName').value.trim();
    if (!recipeName) {
        showNotification('Please enter a recipe name', 'error');
        return;
    }

    const calculation = {
        id: Date.now(),
        name: recipeName,
        ingredients: [...ingredients],
        laborCost: parseFloat(document.getElementById('laborCost').value) || 0,
        overheadCost: parseFloat(document.getElementById('overheadCost').value) || 0,
        packagingCost: parseFloat(document.getElementById('packagingCost').value) || 0,
        servings: parseInt(document.getElementById('servings').value) || 1,
        profitMargin: parseInt(document.getElementById('profitMargin').value) || 0,
        totalCost: document.getElementById('totalCost').textContent,
        sellingPrice: document.getElementById('sellingPrice').textContent,
        savedAt: new Date().toISOString()
    };

    savedCalculations.push(calculation);
    localStorage.setItem('costCalculations', JSON.stringify(savedCalculations));

    renderSavedCalculations();
    showNotification('Calculation saved successfully!', 'success');
}

function loadSavedCalculations() {
    const saved = localStorage.getItem('costCalculations');
    if (saved) {
        savedCalculations = JSON.parse(saved);
    }
}

function renderSavedCalculations() {
    const section = document.getElementById('savedCalculationsSection');
    const list = document.getElementById('savedList');

    if (savedCalculations.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    list.innerHTML = savedCalculations.map(calc => `
        <div class="saved-item" data-id="${calc.id}">
            <div class="saved-info">
                <span class="saved-name">${calc.name}</span>
                <span class="saved-details">
                    Cost: ${calc.totalCost} | Sell: ${calc.sellingPrice}
                </span>
            </div>
            <div class="saved-actions">
                <button class="btn-load" title="Load">📂</button>
                <button class="btn-remove" title="Delete">🗑️</button>
            </div>
        </div>
    `).join('');

    // Add event listeners
    list.querySelectorAll('.saved-item').forEach(item => {
        const id = parseInt(item.dataset.id);
        item.querySelector('.btn-load').addEventListener('click', () => loadCalculation(id));
        item.querySelector('.btn-remove').addEventListener('click', () => removeCalculation(id));
    });
}

function loadCalculation(id) {
    const calc = savedCalculations.find(c => c.id === id);
    if (!calc) return;

    // Set recipe name
    document.getElementById('recipeName').value = calc.name;

    // Clear and reload ingredients
    ingredients = [];
    document.getElementById('ingredientsList').innerHTML = '';
    calc.ingredients.forEach(ing => {
        ingredients.push({ ...ing });
        addIngredientRow(ing);
    });

    // Set additional costs
    document.getElementById('laborCost').value = calc.laborCost;
    document.getElementById('overheadCost').value = calc.overheadCost;
    document.getElementById('packagingCost').value = calc.packagingCost;
    document.getElementById('servings').value = calc.servings;
    document.getElementById('profitMargin').value = calc.profitMargin;
    document.getElementById('profitMarginValue').textContent = calc.profitMargin;

    calculateAll();
    showNotification(`Loaded: ${calc.name}`, 'success');
}

function removeCalculation(id) {
    savedCalculations = savedCalculations.filter(c => c.id !== id);
    localStorage.setItem('costCalculations', JSON.stringify(savedCalculations));
    renderSavedCalculations();
    showNotification('Calculation removed', 'success');
}

function clearAllCalculations() {
    if (confirm('Are you sure you want to delete all saved calculations?')) {
        savedCalculations = [];
        localStorage.removeItem('costCalculations');
        renderSavedCalculations();
        showNotification('All calculations cleared', 'success');
    }
}

function resetCalculator() {
    document.getElementById('recipeName').value = '';
    ingredients = [];
    document.getElementById('ingredientsList').innerHTML = '';
    addIngredientRow();

    document.getElementById('laborCost').value = 0;
    document.getElementById('overheadCost').value = 0;
    document.getElementById('packagingCost').value = 0;
    document.getElementById('servings').value = 1;
    document.getElementById('profitMargin').value = 50;
    document.getElementById('profitMarginValue').textContent = 50;

    calculateAll();
    showNotification('Calculator reset', 'success');
}

// ===== PDF Generation =====
function downloadPDF() {
    const recipeName = document.getElementById('recipeName').value.trim() || 'Recipe Calculation';

    // Check if there are ingredients
    if (ingredients.length === 0 || (ingredients.length === 1 && !ingredients[0].name)) {
        showNotification('Please add at least one ingredient', 'error');
        return;
    }

    // Create PDF document
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPosition = 20;

    // Get currency info
    const currency = currencies[currentCurrency];
    const currencyName = currency.name;

    // Helper function to format currency for PDF
    const formatPdfCurrency = (amount) => {
        const formatted = parseFloat(amount).toFixed(2);
        if (currency.position === 'before') {
            return `${currency.symbol} ${formatted}`;
        } else {
            return `${formatted} ${currency.symbol}`;
        }
    };

    // ===== Header Section =====
    doc.setFillColor(255, 107, 138);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Cost Calculator Report', pageWidth / 2, 18, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Recipe: ${recipeName}`, pageWidth / 2, 30, { align: 'center' });

    yPosition = 55;

    // ===== Date and Currency Info =====
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    doc.text(`Generated: ${today}`, margin, yPosition);
    doc.text(`Currency: ${currencyName} (${currentCurrency})`, pageWidth - margin, yPosition, { align: 'right' });

    yPosition += 15;

    // ===== Ingredients Section =====
    doc.setTextColor(255, 107, 138);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Ingredients', margin, yPosition);
    yPosition += 8;

    // Table header
    doc.setFillColor(245, 245, 250);
    doc.rect(margin, yPosition, pageWidth - (margin * 2), 10, 'F');

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Ingredient', margin + 3, yPosition + 7);
    doc.text('Qty', margin + 80, yPosition + 7);
    doc.text('Unit', margin + 100, yPosition + 7);
    doc.text('Unit Price', margin + 120, yPosition + 7);
    doc.text('Total', margin + 150, yPosition + 7);

    yPosition += 12;

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);

    let ingredientsTotal = 0;
    ingredients.forEach((ing, index) => {
        if (!ing.name) return;

        const total = ing.quantity * ing.unitPrice;
        ingredientsTotal += total;

        // Alternate row background
        if (index % 2 === 0) {
            doc.setFillColor(252, 252, 255);
            doc.rect(margin, yPosition - 5, pageWidth - (margin * 2), 8, 'F');
        }

        doc.text(ing.name.substring(0, 30), margin + 3, yPosition);
        doc.text(ing.quantity.toString(), margin + 80, yPosition);
        doc.text(ing.unit, margin + 100, yPosition);
        doc.text(formatPdfCurrency(ing.unitPrice), margin + 120, yPosition);
        doc.text(formatPdfCurrency(total), margin + 150, yPosition);

        yPosition += 8;

        // Check for page break
        if (yPosition > 260) {
            doc.addPage();
            yPosition = 20;
        }
    });

    // Subtotal
    yPosition += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text('Ingredients Subtotal:', margin + 100, yPosition);
    doc.setTextColor(255, 107, 138);
    doc.text(formatPdfCurrency(ingredientsTotal), margin + 150, yPosition);

    yPosition += 20;

    // ===== Additional Costs Section =====
    doc.setTextColor(255, 107, 138);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Additional Costs', margin, yPosition);
    yPosition += 10;

    const laborCost = parseFloat(document.getElementById('laborCost').value) || 0;
    const overheadCost = parseFloat(document.getElementById('overheadCost').value) || 0;
    const packagingCost = parseFloat(document.getElementById('packagingCost').value) || 0;
    const servings = parseInt(document.getElementById('servings').value) || 1;
    const profitMargin = parseInt(document.getElementById('profitMargin').value) || 0;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);

    const costs = [
        { label: 'Labor Cost', value: laborCost },
        { label: 'Overhead Cost', value: overheadCost },
        { label: 'Packaging Cost', value: packagingCost }
    ];

    costs.forEach(cost => {
        doc.text(`${cost.label}:`, margin + 3, yPosition);
        doc.text(formatPdfCurrency(cost.value), margin + 70, yPosition);
        yPosition += 7;
    });

    doc.text(`Servings:`, margin + 3, yPosition);
    doc.text(servings.toString(), margin + 70, yPosition);
    yPosition += 7;

    doc.text(`Profit Margin:`, margin + 3, yPosition);
    doc.text(`${profitMargin}%`, margin + 70, yPosition);

    yPosition += 20;

    // ===== Results Section =====
    const totalCost = ingredientsTotal + laborCost + overheadCost + packagingCost;
    const sellingPrice = totalCost * (1 + profitMargin / 100);
    const profit = sellingPrice - totalCost;
    const costPerServing = totalCost / servings;
    const sellPerServing = sellingPrice / servings;
    const profitPerServing = profit / servings;

    // Results box
    doc.setFillColor(255, 245, 247);
    doc.roundedRect(margin, yPosition, pageWidth - (margin * 2), 65, 5, 5, 'F');

    doc.setTextColor(255, 107, 138);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Calculation Results', margin + 5, yPosition + 12);

    yPosition += 20;

    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);

    const results = [
        { label: 'Total Cost', value: formatPdfCurrency(totalCost), highlight: false },
        { label: 'Cost per Serving', value: formatPdfCurrency(costPerServing), highlight: false },
        { label: 'Selling Price', value: formatPdfCurrency(sellingPrice), highlight: true },
        { label: 'Total Profit', value: formatPdfCurrency(profit), highlight: true, color: [74, 222, 128] }
    ];

    let xPos = margin + 5;
    results.forEach((result, index) => {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(result.label + ':', xPos, yPosition);

        doc.setFont('helvetica', 'bold');
        if (result.color) {
            doc.setTextColor(...result.color);
        } else if (result.highlight) {
            doc.setTextColor(255, 107, 138);
        } else {
            doc.setTextColor(50, 50, 50);
        }
        doc.text(result.value, xPos, yPosition + 8);

        xPos += 42;
    });

    yPosition += 25;

    // Per serving results
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Per Serving: Selling ${formatPdfCurrency(sellPerServing)} | Profit ${formatPdfCurrency(profitPerServing)}`, margin + 5, yPosition);

    // ===== Footer =====
    yPosition = 280;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Chef Book - Cost Calculator', pageWidth / 2, yPosition, { align: 'center' });

    // Save PDF
    const fileName = `${recipeName.replace(/[^a-z0-9]/gi, '_')}_Cost_Calculation.pdf`;
    doc.save(fileName);

    showNotification(`PDF saved: ${fileName}`, 'success');
}

// ===== Notification =====
function showNotification(message, type = 'success') {
    // Remove existing notification
    const existing = document.querySelector('.calc-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `calc-notification ${type}`;
    notification.innerHTML = `
        <span>${type === 'success' ? '✅' : '⚠️'}</span>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 2500);
}
