// Daily Menu - Single Day View
import './style.css';
import { jsPDF } from 'jspdf';
import { isLoggedIn, logout, getCurrentUser } from './auth.js';
import { isPremium } from './payment.js';
import { initLanguage, t, getCurrentLanguage } from './language.js';

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
let dayCoverPhoto = null;

// DOM Elements
let recipesGrid, emptyState;
let addRecipeModal, addRecipeForm, recipePhotoPreview, recipePhotoInput;
let recipeNameInput, recipeIngredientsInput, recipeInstructionsInput;
let viewRecipeModal, recipeModalBody;
let selectRecipeModal, selectRecipeList;
let dayCoverPreview, dayCoverInput, removeCoverBtn;

// Initialize app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

async function initApp() {
    // Initialize language system
    initLanguage();

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

    // Day Cover Photo elements
    dayCoverPreview = document.getElementById('dayCoverPreview');
    dayCoverInput = document.getElementById('dayCoverInput');
    removeCoverBtn = document.getElementById('removeCoverBtn');

    setupPage();
    setupEventListeners();
    loadDayCoverPhoto();
    await loadUserRecipes();
    await loadDayRecipes();
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

    // Download PDF Button
    document.getElementById('downloadPdfBtn').addEventListener('click', handleDownloadDayPdf);

    // Day Cover Photo
    dayCoverPreview.addEventListener('click', () => dayCoverInput.click());
    dayCoverInput.addEventListener('change', handleDayCoverUpload);
    removeCoverBtn.addEventListener('click', removeDayCoverPhoto);
}

// ===== Check User Limits =====
function getTotalUserRecipesCount() {
    // Return current day's recipes count - server enforces actual limits
    return dayRecipes.length;
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

// ===== Day Cover Photo Functions =====
function loadDayCoverPhoto() {
    const key = `dayCover_${currentDay}_${currentUser}`;
    const savedCover = localStorage.getItem(key);

    if (savedCover) {
        dayCoverPhoto = savedCover;
        updateDayCoverDisplay();
    }
}

function saveDayCoverPhoto() {
    const key = `dayCover_${currentDay}_${currentUser}`;
    try {
        if (dayCoverPhoto) {
            localStorage.setItem(key, dayCoverPhoto);
            console.log(`Saved day cover photo for ${currentDay}`);
        } else {
            localStorage.removeItem(key);
            console.log(`Removed day cover photo for ${currentDay}`);
        }
    } catch (e) {
        console.error('Error saving day cover:', e);
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            showNotification('❌ Image too large! Please use a smaller image.', 'error');
            dayCoverPhoto = null;
            updateDayCoverDisplay();
        }
    }
}

function handleDayCoverUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 500KB for cover photos)
    const maxSize = 500 * 1024;
    if (file.size > maxSize) {
        showNotification('Image is too large! Please choose an image under 500KB.', 'error');
        dayCoverInput.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
        dayCoverPhoto = event.target.result;
        updateDayCoverDisplay();
        saveDayCoverPhoto();
        showNotification('Cover photo added! 📸', 'success');
    };
    reader.readAsDataURL(file);
}

function removeDayCoverPhoto() {
    if (!confirm('Remove the cover photo for this day?')) return;

    dayCoverPhoto = null;
    updateDayCoverDisplay();
    saveDayCoverPhoto();
    dayCoverInput.value = '';
    showNotification('Cover photo removed', 'success');
}

function updateDayCoverDisplay() {
    if (dayCoverPhoto) {
        dayCoverPreview.innerHTML = `<img src="${dayCoverPhoto}" alt="${currentDay} Cover">`;
        dayCoverPreview.classList.add('has-cover');
        removeCoverBtn.style.display = 'inline-flex';
    } else {
        dayCoverPreview.innerHTML = `
            <span class="cover-upload-icon">🖼️</span>
            <span class="cover-upload-text">Click to add a cover photo for this day</span>
        `;
        dayCoverPreview.classList.remove('has-cover');
        removeCoverBtn.style.display = 'none';
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
        <div class="day-recipe-card" onclick="event.stopPropagation(); viewRecipe(${index})" style="animation-delay: ${index * 0.1}s">
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
            <div class="recipe-card-actions">
                <button class="btn-edit-recipe" onclick="event.stopPropagation(); editRecipe(${index})" title="Edit Recipe">
                    ✏️
                </button>
                <button class="btn-delete-recipe" onclick="event.stopPropagation(); deleteRecipe(${index})" title="Delete Recipe">
                    🗑️
                </button>
            </div>
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
        <div class="select-recipe-item" onclick="event.stopPropagation(); selectFromMyRecipes('${recipe.id}')">
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

// ===== Edit Recipe Functions =====
let editingRecipeIndex = null;

window.editRecipe = function (index) {
    const recipe = dayRecipes[index];
    if (!recipe) return;

    editingRecipeIndex = index;

    // Create edit modal if it doesn't exist
    let editModal = document.getElementById('editRecipeModal');
    if (!editModal) {
        editModal = document.createElement('div');
        editModal.id = 'editRecipeModal';
        editModal.className = 'modal';
        editModal.innerHTML = `
            <div class="modal-content modal-md">
                <button class="modal-close" id="closeEditRecipeModal">&times;</button>
                <div class="modal-header">
                    <h2>✏️ Edit Recipe</h2>
                </div>
                <form id="editRecipeForm">
                    <div class="form-group cover-upload">
                        <label>Recipe Photo</label>
                        <div class="cover-preview" id="editRecipePhotoPreview">
                            <span class="upload-icon">📷</span>
                            <span class="upload-text">Click to upload photo</span>
                        </div>
                        <input type="file" id="editRecipePhoto" accept="image/*" hidden>
                    </div>
                    <div class="form-group">
                        <label for="editRecipeName">Recipe Name *</label>
                        <input type="text" id="editRecipeName" placeholder="e.g., Chocolate Croissant" required>
                    </div>
                    <div class="form-group">
                        <label for="editRecipeIngredients">Ingredients (optional)</label>
                        <textarea id="editRecipeIngredients" rows="4" placeholder="e.g., 2 cups flour, 1 cup sugar, 3 eggs..."></textarea>
                    </div>
                    <div class="form-group">
                        <label for="editRecipeInstructions">Instructions (optional)</label>
                        <textarea id="editRecipeInstructions" rows="5" placeholder="e.g., Step 1: Preheat oven to 350°F..."></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="cancelEditRecipe">Cancel</button>
                        <button type="submit" class="btn btn-primary">
                            <span class="btn-icon">💾</span>
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(editModal);

        // Set up event listeners for the edit modal
        document.getElementById('closeEditRecipeModal').addEventListener('click', closeEditRecipeModal);
        document.getElementById('cancelEditRecipe').addEventListener('click', closeEditRecipeModal);
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) closeEditRecipeModal();
        });
        document.getElementById('editRecipeForm').addEventListener('submit', handleEditRecipeSubmit);

        // Photo upload for edit modal
        const editPhotoPreview = document.getElementById('editRecipePhotoPreview');
        const editPhotoInput = document.getElementById('editRecipePhoto');
        editPhotoPreview.addEventListener('click', () => editPhotoInput.click());
        editPhotoInput.addEventListener('change', handleEditPhotoUpload);
    }

    // Populate form with existing recipe data
    document.getElementById('editRecipeName').value = recipe.name || '';
    document.getElementById('editRecipeIngredients').value = recipe.ingredients || '';
    document.getElementById('editRecipeInstructions').value = recipe.instructions || '';

    // Set photo preview
    const editPhotoPreview = document.getElementById('editRecipePhotoPreview');
    if (recipe.photo) {
        editPhotoPreview.innerHTML = `<img src="${recipe.photo}" alt="Recipe Photo">`;
        editPhotoPreview.classList.add('has-image');
    } else {
        editPhotoPreview.innerHTML = `<span class="upload-icon">📷</span><span class="upload-text">Click to upload photo</span>`;
        editPhotoPreview.classList.remove('has-image');
    }

    // Clear file input
    document.getElementById('editRecipePhoto').value = '';

    // Show modal
    editModal.classList.add('show');
};

function closeEditRecipeModal() {
    const editModal = document.getElementById('editRecipeModal');
    if (editModal) {
        editModal.classList.remove('show');
    }
    editingRecipeIndex = null;
}

function handleEditPhotoUpload(e) {
    const file = e.target.files[0];
    if (file) {
        // Check file size (max 200KB)
        const maxSize = 200 * 1024;
        if (file.size > maxSize) {
            showNotification('Image is too large! Please choose an image under 200KB.', 'error');
            document.getElementById('editRecipePhoto').value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            const editPhotoPreview = document.getElementById('editRecipePhotoPreview');
            editPhotoPreview.innerHTML = `<img src="${event.target.result}" alt="Recipe Photo">`;
            editPhotoPreview.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    }
}

async function handleEditRecipeSubmit(e) {
    e.preventDefault();

    if (editingRecipeIndex === null || !dayRecipes[editingRecipeIndex]) {
        showNotification('Recipe not found', 'error');
        closeEditRecipeModal();
        return;
    }

    const name = document.getElementById('editRecipeName').value.trim();
    const ingredients = document.getElementById('editRecipeIngredients').value.trim();
    const instructions = document.getElementById('editRecipeInstructions').value.trim();
    const photoFile = document.getElementById('editRecipePhoto').files[0];

    if (!name) {
        showNotification('Please enter a recipe name', 'error');
        return;
    }

    // Get existing recipe
    const recipe = dayRecipes[editingRecipeIndex];

    // Update photo if a new one was uploaded
    let photo = recipe.photo;
    if (photoFile) {
        photo = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.readAsDataURL(photoFile);
        });
    }

    // Update recipe
    dayRecipes[editingRecipeIndex] = {
        ...recipe,
        name,
        photo,
        ingredients,
        instructions,
        updatedAt: new Date().toISOString()
    };

    saveRecipes();
    closeEditRecipeModal();
    renderRecipes();
    showNotification('Recipe updated successfully! ✨', 'success');
}

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

// ===== PDF Export Functions =====
function handleDownloadDayPdf() {
    if (dayRecipes.length === 0) {
        showNotification('No recipes to save! Add some recipes first.', 'error');
        return;
    }

    showNotification(`Creating PDF for ${currentDay}...`, 'success');

    // Initialize jsPDF
    const doc = new jsPDF();
    const config = DAYS_CONFIG[currentDay];

    // Title Page
    doc.setFillColor(hexToRgb(config.color).r, hexToRgb(config.color).g, hexToRgb(config.color).b);
    doc.rect(0, 0, 210, 297, 'F');

    // Add day cover photo if available
    if (dayCoverPhoto) {
        try {
            const imgProps = doc.getImageProperties(dayCoverPhoto);
            const imgWidth = 150;
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

            // Limit max height
            const maxHeight = 100;
            let finalWidth = imgWidth;
            let finalHeight = imgHeight;

            if (imgHeight > maxHeight) {
                finalHeight = maxHeight;
                finalWidth = (imgProps.width * finalHeight) / imgProps.height;
            }

            // Center the image horizontally
            const xOffset = (210 - finalWidth) / 2;

            // Add white rounded background for image
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(xOffset - 5, 25, finalWidth + 10, finalHeight + 10, 5, 5, 'F');

            doc.addImage(dayCoverPhoto, xOffset, 30, finalWidth, finalHeight);

            // Adjust text positions when there's a cover photo
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(36);
            doc.setFont('helvetica', 'bold');
            doc.text(currentDay, 105, 160, { align: 'center' });

            doc.setFontSize(20);
            doc.setFont('helvetica', 'normal');
            doc.text('Daily Menu', 105, 185, { align: 'center' });

            doc.setFontSize(16);
            doc.text(`${dayRecipes.length} Recipe${dayRecipes.length > 1 ? 's' : ''}`, 105, 210, { align: 'center' });
        } catch (err) {
            console.error('Error adding cover to PDF:', err);
            // Fallback to no-cover layout
            addPdfTitleWithoutCover(doc, config);
        }
    } else {
        addPdfTitleWithoutCover(doc, config);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(`Created: ${new Date().toLocaleDateString()}`, 105, 280, { align: 'center' });

    // Recipe Pages
    dayRecipes.forEach((recipe, index) => {
        doc.addPage();
        generateDayRecipePdfPage(doc, recipe, config);

        // Page number footer
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Recipe ${index + 1} of ${dayRecipes.length}`, 105, 290, { align: 'center' });
    });

    // Save PDF
    const fileName = `${currentDay.toLowerCase()}_menu_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    showNotification(`PDF saved: ${fileName} 📄`, 'success');
}

function generateDayRecipePdfPage(doc, recipe, dayConfig) {
    // Header with day color
    const rgb = hexToRgb(dayConfig.color);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(0, 0, 210, 40, 'F');

    // Recipe Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');

    // Truncate long recipe names
    let recipeName = recipe.name;
    if (recipeName.length > 35) {
        recipeName = recipeName.substring(0, 32) + '...';
    }
    doc.text(recipeName, 15, 25);

    // Category badge (if exists)
    if (recipe.category) {
        doc.setFontSize(10);
        doc.text(recipe.category.toUpperCase(), 195, 25, { align: 'right' });
    }

    // Day indicator
    doc.setFontSize(10);
    doc.text(`${dayConfig.emoji} ${currentDay}`, 195, 35, { align: 'right' });

    let y = 55;

    // Recipe Photo
    if (recipe.photo) {
        try {
            const imgProps = doc.getImageProperties(recipe.photo);
            const imgWidth = 180;
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

            const maxHeight = 80;
            let finalWidth = imgWidth;
            let finalHeight = imgHeight;

            if (imgHeight > maxHeight) {
                finalHeight = maxHeight;
                finalWidth = (imgProps.width * finalHeight) / imgProps.height;
            }

            const xOffset = 15 + (180 - finalWidth) / 2;
            doc.addImage(recipe.photo, xOffset, y, finalWidth, finalHeight);
            y += finalHeight + 15;
        } catch (err) {
            console.error('Error adding image to PDF:', err);
            y += 10;
        }
    } else {
        y += 10;
    }

    // Ingredients Section
    if (recipe.ingredients && recipe.ingredients.trim()) {
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.rect(15, y - 5, 4, 15, 'F');
        doc.setTextColor(rgb.r, rgb.g, rgb.b);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Ingredients', 25, y + 5);

        y += 18;
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const ingredients = recipe.ingredients.split('\n').filter(i => i.trim());
        ingredients.forEach(ing => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            doc.text(`• ${ing.trim()}`, 20, y);
            y += 7;
        });

        y += 10;
    }

    // Instructions Section
    if (recipe.instructions && recipe.instructions.trim()) {
        if (y > 230) {
            doc.addPage();
            y = 20;
        }

        doc.setFillColor(255, 179, 71);
        doc.rect(15, y - 5, 4, 15, 'F');
        doc.setTextColor(255, 179, 71);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Instructions', 25, y + 5);

        y += 18;
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const instructions = recipe.instructions.split('\n').filter(i => i.trim());
        instructions.forEach((inst, idx) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            const text = inst.replace(/^\d+\.\s*/, '');
            const lines = doc.splitTextToSize(`${idx + 1}. ${text}`, 170);
            lines.forEach(line => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(line, 20, y);
                y += 7;
            });
            y += 3;
        });
    }
}

// Helper function to convert hex color to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 107, b: 138 }; // fallback to pink
}

// Helper function for PDF title page without cover
function addPdfTitleWithoutCover(doc, config) {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(48);
    doc.setFont('helvetica', 'bold');
    doc.text(config.emoji, 105, 80, { align: 'center' });

    doc.setFontSize(36);
    doc.text(currentDay, 105, 120, { align: 'center' });

    doc.setFontSize(20);
    doc.setFont('helvetica', 'normal');
    doc.text('Daily Menu', 105, 145, { align: 'center' });

    doc.setFontSize(16);
    doc.text(`${dayRecipes.length} Recipe${dayRecipes.length > 1 ? 's' : ''}`, 105, 175, { align: 'center' });
}

