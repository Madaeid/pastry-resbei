// Daily Menu - Single Day View
import './style.css';
import { isLoggedIn, logout, getCurrentUser } from './auth.js';
import { isPremium } from './payment.js';

// API Base URL
const API_BASE = 'http://localhost:3001/api';

// Days configuration
const DAYS_CONFIG = {
    'Saturday': { emoji: '🌟', color: '#ff6b8a' },
    'Sunday': { emoji: '☀️', color: '#ffb347' },
    'Monday': { emoji: '🌙', color: '#a855f7' },
    'Tuesday': { emoji: '🔥', color: '#ef4444' },
    'Wednesday': { emoji: '💚', color: '#22c55e' },
    'Thursday': { emoji: '⚡', color: '#3b82f6' },
    'Friday': { emoji: '🎉', color: '#ec4899' }
};

// State
let currentDay = null;
let dayRecipes = [];
let userRecipes = [];
let currentUser = null;
let userIsPremium = false;

// DOM Elements
let recipesGrid, emptyState;
let addRecipeModal, addRecipeForm, recipePhotoPreview, recipePhotoInput;
let recipeNameInput, recipeIngredientsInput, recipeInstructionsInput;
let viewRecipeModal, recipeModalBody;
let selectRecipeModal, selectRecipeList;

// Initialize app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

async function initApp() {
    if (!isLoggedIn()) {
        window.location.href = './auth.html';
        return;
    }

    currentUser = getCurrentUser();
    userIsPremium = isPremium();

    console.log('=== Daily Menu Init ===');
    console.log('Current User:', currentUser);
    console.log('Is Premium:', userIsPremium);

    // Get day from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentDay = urlParams.get('day');

    if (!currentDay || !DAYS_CONFIG[currentDay]) {
        window.location.href = './days-selection.html';
        return;
    }

    // Initialize DOM elements
    recipesGrid = document.getElementById('recipesGrid');
    emptyState = document.getElementById('emptyState');

    addRecipeModal = document.getElementById('addRecipeModal');
    addRecipeForm = document.getElementById('addRecipeForm');
    recipePhotoPreview = document.getElementById('recipePhotoPreview');
    recipePhotoInput = document.getElementById('recipePhoto');
    recipeNameInput = document.getElementById('recipeName');
    recipeIngredientsInput = document.getElementById('recipeIngredients');
    recipeInstructionsInput = document.getElementById('recipeInstructions');

    viewRecipeModal = document.getElementById('viewRecipeModal');
    recipeModalBody = document.getElementById('recipeModalBody');

    selectRecipeModal = document.getElementById('selectRecipeModal');
    selectRecipeList = document.getElementById('selectRecipeList');

    setupPage();
    setupEventListeners();
    await loadUserRecipes();
    loadDayRecipes();
}

function setupPage() {
    const config = DAYS_CONFIG[currentDay];

    document.getElementById('dayTitle').textContent = currentDay;
    document.getElementById('dayEmoji').textContent = config.emoji;
    document.getElementById('modalDayName').textContent = currentDay;
    document.title = `📅 ${currentDay} - Daily Menu`;

    document.documentElement.style.setProperty('--day-accent-color', config.color);

    // Show limit info for free users
    if (!userIsPremium) {
        const limitInfo = document.createElement('div');
        limitInfo.className = 'free-user-limit-info';
        limitInfo.innerHTML = `<span>⚠️</span> Free users can add only 1 recipe. <a href="./payment.html">Upgrade to Premium</a> for unlimited!`;
        document.querySelector('.add-recipe-section').after(limitInfo);
    }

}

function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Add Recipe Button
    document.getElementById('addRecipeBtn').addEventListener('click', checkAndOpenAddModal);

    // Add Recipe Modal
    document.getElementById('closeAddRecipeModal').addEventListener('click', closeAddRecipeModal);
    document.getElementById('cancelAddRecipe').addEventListener('click', closeAddRecipeModal);
    addRecipeModal.addEventListener('click', (e) => {
        if (e.target === addRecipeModal) closeAddRecipeModal();
    });
    addRecipeForm.addEventListener('submit', handleAddRecipe);

    // Photo upload
    recipePhotoPreview.addEventListener('click', () => recipePhotoInput.click());
    recipePhotoInput.addEventListener('change', handlePhotoUpload);

    // View Recipe Modal
    document.getElementById('closeViewRecipeModal').addEventListener('click', closeViewRecipeModal);
    viewRecipeModal.addEventListener('click', (e) => {
        if (e.target === viewRecipeModal) closeViewRecipeModal();
    });

    // Select Recipe Modal
    document.getElementById('closeSelectRecipeModal').addEventListener('click', closeSelectRecipeModal);
    document.getElementById('selectFromMyRecipesBtn').addEventListener('click', openSelectRecipeModal);
    selectRecipeModal.addEventListener('click', (e) => {
        if (e.target === selectRecipeModal) closeSelectRecipeModal();
    });

    // Search in select modal
    document.getElementById('selectRecipeSearch').addEventListener('input', filterSelectRecipes);
}

// ===== Check User Limits =====
function getTotalUserRecipesCount() {
    let total = 0;
    const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    days.forEach(day => {
        const key = `dayRecipes_${day}_${currentUser}`;
        const recipes = localStorage.getItem(key);
        if (recipes) {
            total += JSON.parse(recipes).length;
        }
    });

    return total;
}

function checkAndOpenAddModal() {
    console.log('=== checkAndOpenAddModal ===');
    console.log('User is Premium:', userIsPremium);

    if (!userIsPremium) {
        const totalRecipes = getTotalUserRecipesCount();
        console.log('Total recipes count for free user:', totalRecipes);
        if (totalRecipes >= 1) {
            console.log('Blocked: Free user limit reached');
            showPremiumUpgradeModal('Free users can only add 1 recipe to the Daily Menu. Upgrade to Premium for unlimited recipes!');
            return;
        }
    }

    console.log('Opening Add Recipe Modal...');
    openAddRecipeModal();
}

function showPremiumUpgradeModal(message) {
    const existing = document.getElementById('premiumUpgradeModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'premiumUpgradeModal';
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content modal-sm premium-upgrade-modal">
            <div class="premium-icon">👑</div>
            <h2>Upgrade to Premium</h2>
            <p class="premium-message">${message}</p>
            <div class="premium-benefits">
                <div class="benefit-item">✅ Unlimited recipes in Daily Menu</div>
                <div class="benefit-item">✅ Plan meals for the entire week</div>
                <div class="benefit-item">✅ Access all premium features</div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closePremiumModal()">Maybe Later</button>
                <button class="btn btn-primary btn-premium" onclick="window.location.href='./payment.html'">
                    ⭐ Upgrade Now
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePremiumModal();
    });
}

window.closePremiumModal = function () {
    const modal = document.getElementById('premiumUpgradeModal');
    if (modal) modal.remove();
};

// ===== Storage Functions =====
async function loadUserRecipes() {
    try {
        const token = sessionStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            userRecipes = [];
            return;
        }

        const response = await fetch(`${API_BASE}/daily-menu/recipes`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch recipes');
        }

        userRecipes = await response.json();
        console.log(`Loaded ${userRecipes.length} user recipes from API`);
    } catch (error) {
        console.error('Failed to load user recipes:', error);
        userRecipes = [];
    }
}

function loadDayRecipes() {
    try {
        const key = `dayRecipes_${currentDay}_${currentUser}`;
        const storedRecipes = localStorage.getItem(key);
        dayRecipes = storedRecipes ? JSON.parse(storedRecipes) : [];
        console.log(`Loaded ${dayRecipes.length} day recipes from key: ${key}`);
        renderRecipes();
    } catch (error) {
        console.error('Load recipes error:', error);
        showNotification('Failed to load recipes', 'error');
    }
}

function saveRecipes() {
    const key = `dayRecipes_${currentDay}_${currentUser}`;
    try {
        localStorage.setItem(key, JSON.stringify(dayRecipes));
        console.log(`Saved ${dayRecipes.length} recipes to key: ${key}`);
    } catch (e) {
        console.error('Error saving recipes:', e);
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            showNotification('❌ Storage full! Recipe not saved. Try deleting old items.', 'error');
        } else {
            showNotification('❌ Error saving recipe.', 'error');
        }
    }
}

// ===== Render Functions =====
function renderRecipes() {
    if (dayRecipes.length === 0) {
        recipesGrid.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';
    recipesGrid.style.display = 'grid';

    recipesGrid.innerHTML = dayRecipes.map((recipe, index) => `
        <div class="day-recipe-card" onclick="viewRecipe(${index})" style="animation-delay: ${index * 0.1}s">
            <div class="recipe-card-image">
                ${recipe.photo
            ? `<img src="${recipe.photo}" alt="${recipe.name}">`
            : `<div class="placeholder-image">🍰</div>`
        }
            </div>
            <div class="recipe-card-content">
                <h3 class="recipe-card-title">${recipe.name}</h3>
                ${recipe.ingredients ? `<p class="recipe-card-preview">${recipe.ingredients.substring(0, 60)}${recipe.ingredients.length > 60 ? '...' : ''}</p>` : ''}
            </div>
            <button class="btn-delete-recipe" onclick="event.stopPropagation(); deleteRecipe(${index})" title="Delete Recipe">
                🗑️
            </button>
        </div>
    `).join('');
}

// ===== Modal Functions =====
function openAddRecipeModal() {
    addRecipeForm.reset();
    recipePhotoPreview.innerHTML = `<span class="upload-icon">📷</span><span class="upload-text">Click to upload photo</span>`;
    recipePhotoPreview.classList.remove('has-image');
    addRecipeModal.classList.add('show');
}

function closeAddRecipeModal() {
    addRecipeModal.classList.remove('show');
}

function closeViewRecipeModal() {
    viewRecipeModal.classList.remove('show');
}

function openSelectRecipeModal() {
    closeAddRecipeModal();
    console.log('Opening select modal with', userRecipes.length, 'recipes');
    renderSelectRecipeList(userRecipes);
    selectRecipeModal.classList.add('show');
}

function closeSelectRecipeModal() {
    selectRecipeModal.classList.remove('show');
}

function renderSelectRecipeList(recipes) {
    if (recipes.length === 0) {
        selectRecipeList.innerHTML = `
            <div class="empty-select-state">
                <div class="empty-icon">📖</div>
                <h3>No recipes found</h3>
                <p>Add some recipes to "My Recipes" first!</p>
            </div>
        `;
        return;
    }

    selectRecipeList.innerHTML = recipes.map(recipe => `
        <div class="select-recipe-item" onclick="selectFromMyRecipes('${recipe.id}')">
            <div class="select-recipe-content">
                <div class="select-recipe-image">
                    ${recipe.photo ? `<img src="${recipe.photo}" alt="${recipe.name}">` : '<span>🍰</span>'}
                </div>
                <div class="select-recipe-info">
                    <h4>${recipe.name}</h4>
                    <span class="select-recipe-category">${recipe.category || 'Recipe'}</span>
                </div>
            </div>
            <div class="select-recipe-action">
                <span class="add-icon">➕</span>
            </div>
        </div>
    `).join('');
}

function filterSelectRecipes(e) {
    const term = e.target.value.toLowerCase();
    const filtered = userRecipes.filter(r => r.name.toLowerCase().includes(term));
    renderSelectRecipeList(filtered);
}

// ===== Add Recipe from My Recipes =====
function addRecipeFromMyRecipes(recipeId) {
    console.log('=== addRecipeFromMyRecipes ===');
    console.log('Recipe ID:', recipeId);
    console.log('User recipes count:', userRecipes.length);

    // Check limits for free users
    if (!userIsPremium) {
        const totalRecipes = getTotalUserRecipesCount();
        console.log('Total recipes for free user:', totalRecipes);
        if (totalRecipes >= 1) {
            closeSelectRecipeModal();
            showPremiumUpgradeModal('Free users can only add 1 recipe to the Daily Menu. Upgrade to Premium for unlimited recipes!');
            return;
        }
    }


    // Find the recipe (handle both string and number IDs)
    const recipe = userRecipes.find(r => String(r.id) === String(recipeId));

    if (!recipe) {
        console.error('Recipe not found with ID:', recipeId);
        console.log('Available IDs:', userRecipes.map(r => r.id));
        showNotification('Recipe not found', 'error');
        return;
    }

    console.log('Found recipe:', recipe.name);

    const newRecipe = {
        id: Date.now(),
        sourceRecipeId: recipe.id,
        name: recipe.name,
        photo: recipe.photo || null,
        ingredients: recipe.ingredients || '',
        instructions: recipe.instructions || '',
        category: recipe.category || 'Recipe',
        createdAt: new Date().toISOString()
    };

    dayRecipes.push(newRecipe);
    saveRecipes();

    closeSelectRecipeModal();
    renderRecipes();
    showNotification('Recipe added from My Recipes!', 'success');
    console.log('=== Recipe added successfully ===');
}

// Make it available globally as backup
window.selectFromMyRecipes = function (recipeId) {
    addRecipeFromMyRecipes(recipeId);
};

// ===== Recipe Operations =====
async function handleAddRecipe(e) {
    e.preventDefault();

    // Check limits for free users
    if (!userIsPremium) {
        const totalRecipes = getTotalUserRecipesCount();
        if (totalRecipes >= 1) {
            closeAddRecipeModal();
            showPremiumUpgradeModal('Free users can only add 1 recipe to the Daily Menu. Upgrade to Premium for unlimited recipes!');
            return;
        }
    }


    const name = recipeNameInput.value.trim();
    const ingredients = recipeIngredientsInput.value.trim();
    const instructions = recipeInstructionsInput.value.trim();
    const photoFile = recipePhotoInput.files[0];

    if (!name) {
        showNotification('Please enter a recipe name', 'error');
        return;
    }

    let photo = null;
    if (photoFile) {
        photo = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(photoFile);
        });
    }

    const newRecipe = {
        id: Date.now(),
        name,
        photo,
        ingredients,
        instructions,
        userId: currentUser,
        createdAt: new Date().toISOString()
    };

    dayRecipes.push(newRecipe);
    saveRecipes();

    closeAddRecipeModal();
    renderRecipes();
    showNotification('Recipe added successfully!', 'success');
}

function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (file) {
        // Check file size (max 200KB)
        const maxSize = 200 * 1024; // 200KB in bytes
        if (file.size > maxSize) {
            showNotification('Image is too large! Please choose an image under 200KB.', 'error');
            recipePhotoInput.value = ''; // Clear the input
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            recipePhotoPreview.innerHTML = `<img src="${e.target.result}" alt="Recipe Photo">`;
            recipePhotoPreview.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    }
}

window.viewRecipe = function (index) {
    const recipe = dayRecipes[index];
    if (!recipe) return;

    recipeModalBody.innerHTML = `
        <div class="recipe-detail-view">
            ${recipe.photo
            ? `<div class="recipe-detail-image"><img src="${recipe.photo}" alt="${recipe.name}"></div>`
            : ''
        }
            <h2 class="recipe-detail-title">${recipe.name}</h2>
            
            ${recipe.ingredients ? `
                <div class="recipe-detail-section">
                    <h3>🥄 Ingredients</h3>
                    <p>${recipe.ingredients.replace(/\n/g, '<br>')}</p>
                </div>
            ` : ''}
            
            ${recipe.instructions ? `
                <div class="recipe-detail-section">
                    <h3>📝 Instructions</h3>
                    <p>${recipe.instructions.replace(/\n/g, '<br>')}</p>
                </div>
            ` : ''}
        </div>
    `;

    viewRecipeModal.classList.add('show');
};

window.deleteRecipe = function (index) {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    dayRecipes.splice(index, 1);
    saveRecipes();
    renderRecipes();
    showNotification('Recipe deleted', 'success');
};

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<span class="notification-icon">${type === 'success' ? '✅' : '⚠️'}</span><span>${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
