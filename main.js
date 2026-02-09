// Pastry Recipe Book - ES Module Version
import './style.css';
import { jsPDF } from 'jspdf';
import { isLoggedIn, logout, getCurrentUser, isAdmin, getAllUsers, updateUser } from './auth.js';
import { isPremium, getSubscriptionStatus, syncSubscriptionFromServer } from './payment.js';
import { initLanguage, t, getCurrentLanguage } from './language.js';

// Free tier limits
const FREE_RECIPE_LIMIT = 10;

// DOM Elements - will be initialized after DOM is ready
let tabs, tabContents, form, photoPreview, photoInput, recipesGrid, emptyState, recipeCount;
let downloadPdfBtn, clearAllBtn, modal, closeModal, modalBody, recipeSearch;
let editUserBtn, editUserModal, closeEditUserModal, editUserForm, modalLogoutBtn;
let editProfilePreview, editProfilePhoto;
let dayPickerModal, closeDayPickerModalBtn;
let themeToggle;
let editingRecipeId = null;
let selectedRecipeForMenu = null;


// Wait for DOM to be fully loaded, or run immediately if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // DOM is already ready (loading, interactive, or complete)
    initApp();
}

async function initApp() {
    // Initialize DOM Elements
    tabs = document.querySelectorAll('.tab');
    tabContents = document.querySelectorAll('.tab-content');
    form = document.getElementById('addRecipeForm');
    photoPreview = document.getElementById('photoPreview');
    photoInput = document.getElementById('recipePhoto');
    recipesGrid = document.getElementById('recipesGrid');
    emptyState = document.getElementById('emptyState');
    recipeCount = document.getElementById('recipeCount');

    downloadPdfBtn = document.getElementById('downloadPdfBtn');
    clearAllBtn = document.getElementById('clearAllBtn');
    modal = document.getElementById('recipeModal');
    closeModal = document.getElementById('closeModal');
    modalBody = document.getElementById('modalBody');
    recipeSearch = document.getElementById('recipeSearch');

    editUserBtn = document.getElementById('editUserBtn');
    editUserModal = document.getElementById('editUserModal');
    closeEditUserModal = document.getElementById('closeEditUserModal');
    editUserForm = document.getElementById('editUserForm');
    editUserForm = document.getElementById('editUserForm');
    modalLogoutBtn = document.getElementById('modalLogoutBtn');
    editProfilePreview = document.getElementById('editProfilePreview');
    editProfilePhoto = document.getElementById('editProfilePhoto');
    dayPickerModal = document.getElementById('dayPickerModal');
    closeDayPickerModalBtn = document.getElementById('closeDayPickerModal');
    themeToggle = document.getElementById('themeToggle');


    // Setup all event listeners
    setupEventListeners();

    // Initialize theme
    initTheme();

    // Initialize language system
    initLanguage();

    // Sync subscription status from server to ensure premium status is up-to-date
    // This fixes issues where payment happens but localStorage isn't updated
    await syncSubscriptionFromServer();

    // Initialize app
    checkAuth();
    loadRecipes();
}

// ===== User-specific Storage Functions =====
// Get storage key for current user's recipes
function getUserRecipeKey() {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;
    // Use lowercase username to ensure consistency
    return `pastryRecipes_${currentUser.toLowerCase()}`;
}

// Get current user's recipes
function getUserRecipes() {
    const key = getUserRecipeKey();
    if (!key) return [];
    return JSON.parse(localStorage.getItem(key) || '[]');
}

// Save current user's recipes
// Save current user's recipes
function saveUserRecipes(recipes) {
    const key = getUserRecipeKey();
    if (!key) return;

    try {
        localStorage.setItem(key, JSON.stringify(recipes));
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            alert('Storage full! The recipe image might be too large. Please try a smaller image or delete some old recipes.');
            showNotification('❌ Storage full! Image too large.', 'error');
        } else {
            console.error('Error saving recipes:', e);
            showNotification('❌ Error saving recipe.', 'error');
        }
        return false;
    }
}

function setupEventListeners() {
    // Search Recipes
    if (recipeSearch) {
        recipeSearch.addEventListener('input', function (e) {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterRecipes(searchTerm);
        });
    }

    // Tab Navigation
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update active content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetTab) {
                    content.classList.add('active');
                }
            });

            // Refresh recipes when switching to My Recipes tab
            if (targetTab === 'my-recipes') {
                loadRecipes();
            }


        });
    });

    // Photo Upload
    if (photoPreview && photoInput) {
        photoPreview.addEventListener('click', () => photoInput.click());

        photoInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                // Check file size (max 200KB)
                const maxSize = 200 * 1024; // 200KB in bytes
                if (file.size > maxSize) {
                    showNotification('❌ Image is too large! Please choose an image under 200KB.', 'error');
                    photoInput.value = ''; // Clear the input
                    return;
                }

                const reader = new FileReader();
                reader.onload = function (e) {
                    const existingImg = photoPreview.querySelector('img');
                    if (existingImg) existingImg.remove();

                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.alt = 'Recipe Photo';
                    photoPreview.appendChild(img);
                    photoPreview.classList.add('has-image');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Form Submission
    if (form) {
        form.addEventListener('submit', handleFormSubmit);

        // Form validation feedback
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('blur', function () {
                if (this.hasAttribute('required') && !this.value) {
                    this.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                } else {
                    this.style.borderColor = '';
                }
            });

            input.addEventListener('input', function () {
                this.style.borderColor = '';
            });
        });
    }

    // Close Modal
    if (closeModal && modal) {
        closeModal.addEventListener('click', () => modal.classList.remove('show'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('show');
        });
    }

    // Download Book as PDF
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', handleDownloadPdf);
    }

    // Clear All Recipes
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', handleClearAll);
    }



    // Edit User Modal Triggers
    if (editUserBtn) {
        editUserBtn.addEventListener('click', openEditUserModal);
    }

    if (closeEditUserModal && editUserModal) {
        closeEditUserModal.addEventListener('click', () => editUserModal.classList.remove('show'));
        editUserModal.addEventListener('click', (e) => {
            if (e.target === editUserModal) editUserModal.classList.remove('show');
        });
    }

    if (editUserForm) {
        editUserForm.addEventListener('submit', handleEditUserSubmit);
    }

    if (modalLogoutBtn) {
        modalLogoutBtn.addEventListener('click', logout);
    }

    // Edit Profile Picture Upload
    if (editProfilePreview && editProfilePhoto) {
        editProfilePreview.addEventListener('click', () => editProfilePhoto.click());

        editProfilePhoto.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    editProfilePreview.innerHTML = `<img src="${e.target.result}" alt="Profile Preview">`;
                    editProfilePreview.style.border = '2px solid var(--accent-pink)';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Theme Toggle
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Day Picker Modal Triggers
    setupDayPickerModal();
}

// ===== Theme Functions =====
function initTheme() {
    // Get saved theme or use system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');

    setTheme(theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
    if (!themeToggle) return;

    const icon = themeToggle.querySelector('.theme-icon');
    if (icon) {
        // Sun for dark mode (click to switch to light), Moon for light mode (click to switch to dark)
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
        themeToggle.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }
}

// Open Edit User Modal
function openEditUserModal() {
    const currentUser = getCurrentUser();
    const users = getAllUsers();
    const user = users.find(u => u.username === currentUser);

    if (!user) return;

    // Populate form
    document.getElementById('editUsername').value = user.username;
    document.getElementById('editDisplayName').value = user.displayName;
    document.getElementById('editEmail').value = user.email || '';
    document.getElementById('editPhoneNumber').value = user.phoneNumber || '';
    document.getElementById('editPassword').value = '';

    // Handle profile picture preview
    if (user.profilePicture) {
        editProfilePreview.innerHTML = `<img src="${user.profilePicture}" alt="Profile">`;
    } else {
        editProfilePreview.innerHTML = '<span class="upload-icon">📷</span>';
    }

    editUserModal.classList.add('show');
}

// Handle Edit User Submit
async function handleEditUserSubmit(e) {
    e.preventDefault();

    const currentUser = getCurrentUser();
    const newUsername = document.getElementById('editUsername').value.trim();
    const displayName = document.getElementById('editDisplayName').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const phoneNumber = document.getElementById('editPhoneNumber').value.trim();
    const password = document.getElementById('editPassword').value;
    const profilePhotoInput = document.getElementById('editProfilePhoto');

    const updateData = {
        displayName: displayName,
        email: email,
        phoneNumber: phoneNumber
    };

    if (newUsername !== currentUser) {
        updateData.newUsername = newUsername;
    }

    if (password) {
        updateData.password = password;
    }

    // Function to proceed with update
    const proceedWithUpdate = async () => {
        const result = await updateUser(currentUser, updateData);

        if (result.success) {
            showNotification('✅ Profile updated successfully!', 'success');
            editUserModal.classList.remove('show');

            if (updateData.newUsername) {
                setTimeout(() => window.location.reload(), 1500);
                return;
            }

            // Update header display
            const userNameElement = document.getElementById('userName');
            const userProfilePic = document.getElementById('userProfilePic');
            const userDefaultAvatar = document.getElementById('userDefaultAvatar');

            if (userNameElement) userNameElement.textContent = displayName;

            if (updateData.profilePicture && userProfilePic && userDefaultAvatar) {
                userProfilePic.src = updateData.profilePicture;
                userProfilePic.style.display = 'block';
                userDefaultAvatar.style.display = 'none';
            }
            // If data didn't have new picture but user previously had one, we don't necessarily clear it here unless we explicity support removing it.
        } else {
            showNotification(result.error || 'Failed to update profile', 'error');
        }
    };

    // Handle Profile Picture
    if (profilePhotoInput.files && profilePhotoInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            updateData.profilePicture = e.target.result;
            proceedWithUpdate();
        };
        reader.readAsDataURL(profilePhotoInput.files[0]);
    } else {
        proceedWithUpdate();
    }
}

// Show Notification Helper (if not already accessible, duplicate here or ensure it's available)
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${type === 'success' ? '✅' : '⚠️'}</span>
        <span class="notification-message">${message}</span>
    `;

    // Add to body
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===== Day Picker Modal Functions =====
function setupDayPickerModal() {
    if (!dayPickerModal) return;

    // Close button
    if (closeDayPickerModalBtn) {
        closeDayPickerModalBtn.addEventListener('click', closeDayPickerModal);
    }

    // Click outside to close
    dayPickerModal.addEventListener('click', (e) => {
        if (e.target === dayPickerModal) closeDayPickerModal();
    });

    // Day button clicks
    const dayButtons = dayPickerModal.querySelectorAll('.day-picker-btn');
    dayButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const day = btn.getAttribute('data-day');
            if (selectedRecipeForMenu) {
                addRecipeToDay(selectedRecipeForMenu, day);
            }
        });
    });
}

function openDayPickerModal(recipe) {
    selectedRecipeForMenu = recipe;

    // Check free user limit first
    if (!isPremium()) {
        const totalRecipes = getTotalDailyMenuRecipesCount();
        if (totalRecipes >= 1) {
            showPremiumUpgradeModal('Free users can only add 1 recipe to the Daily Menu. Upgrade to Premium for unlimited recipes!');
            return;
        }
    }

    // Update modal with recipe name
    const recipeName = document.getElementById('dayPickerRecipeName');
    if (recipeName) {
        recipeName.textContent = `Select a day for "${recipe.name}"`;
    }

    dayPickerModal.classList.add('show');
}

function closeDayPickerModal() {
    dayPickerModal.classList.remove('show');
    selectedRecipeForMenu = null;
}

function getTotalDailyMenuRecipesCount() {
    const currentUser = getCurrentUser();
    if (!currentUser) return 0;

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

function addRecipeToDay(recipe, day) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    // Get existing day recipes
    const key = `dayRecipes_${day}_${currentUser}`;
    let dayRecipes = [];
    const stored = localStorage.getItem(key);
    if (stored) {
        dayRecipes = JSON.parse(stored);
    }

    // Create new recipe entry for daily menu
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

    // Add to array and save
    dayRecipes.push(newRecipe);
    localStorage.setItem(key, JSON.stringify(dayRecipes));

    closeDayPickerModal();
    showNotification(`✅ "${recipe.name}" added to ${day}'s menu!`, 'success');
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
                <button class="btn btn-secondary" onclick="document.getElementById('premiumUpgradeModal').remove()">Maybe Later</button>
                <button class="btn btn-primary btn-premium" onclick="window.location.href='./payment.html'">
                    ⭐ Upgrade Now
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function checkAuth() {
    if (!isLoggedIn()) {
        window.location.href = './auth.html';
        return;
    }

    // Show user info
    const userHeader = document.getElementById('userHeader');
    const userNameElement = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');

    if (userHeader && userNameElement) {
        userHeader.style.display = 'flex';

        // Lookup display name
        const currentUsername = getCurrentUser();
        const users = getAllUsers();
        const currentUserObj = users.find(u => u.username === currentUsername);
        userNameElement.textContent = currentUserObj ? currentUserObj.displayName : currentUsername;

        // Profile Picture Display
        const userProfilePic = document.getElementById('userProfilePic');
        const userDefaultAvatar = document.getElementById('userDefaultAvatar');

        if (userProfilePic && userDefaultAvatar) {
            if (currentUserObj && currentUserObj.profilePicture) {
                userProfilePic.src = currentUserObj.profilePicture;
                userProfilePic.style.display = 'block';
                userDefaultAvatar.style.display = 'none';
            } else {
                userProfilePic.style.display = 'none';
                userDefaultAvatar.style.display = 'block';
            }
        }

        // Show dashboard button if admin
        const adminDashboardBtn = document.getElementById('adminDashboardBtn');
        if (adminDashboardBtn) {
            if (isAdmin()) {
                adminDashboardBtn.style.display = 'inline-flex';
            } else {
                adminDashboardBtn.style.display = 'none';
            }
        }

        // Handle premium status display
        const upgradeBtn = document.getElementById('upgradeBtn');
        const premiumBadge = document.getElementById('premiumBadge');
        const dailyMenuBtn = document.getElementById('dailyMenuBtn');

        if (isPremium()) {
            // User is premium - hide upgrade button, show badge
            if (upgradeBtn) upgradeBtn.style.display = 'none';
            if (premiumBadge) premiumBadge.style.display = 'inline-flex';
        } else {
            // User is not premium - show upgrade button, hide badge
            if (upgradeBtn) upgradeBtn.style.display = 'inline-flex';
            if (premiumBadge) premiumBadge.style.display = 'none';
        }

        // Always show Daily Menu button if logged in
        if (dailyMenuBtn) dailyMenuBtn.style.display = 'inline-flex';
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// Form Submission Handler
function handleFormSubmit(e) {
    e.preventDefault();

    const recipe = {
        id: Date.now(),
        name: document.getElementById('recipeName').value,
        category: document.getElementById('category').value,
        prepTime: parseInt(document.getElementById('prepTime').value),
        cookTime: parseInt(document.getElementById('cookTime').value),
        servings: parseInt(document.getElementById('servings').value),
        difficulty: document.getElementById('difficulty').value,
        ingredients: document.getElementById('ingredients').value,
        instructions: document.getElementById('instructions').value,
        notes: document.getElementById('notes').value,
        dateAdded: new Date().toISOString(),
        photo: null
    };

    // Get photo as base64
    const photoFile = photoInput.files[0];
    if (photoFile) {
        // Check file size (limit to 200KB)
        if (photoFile.size > 200 * 1024) {
            showNotification('❌ Image is too large! Please choose an image under 200KB.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            recipe.photo = e.target.result;
            saveRecipe(recipe);
        };
        reader.readAsDataURL(photoFile);
    } else {
        // Prepare recipe object for saving
        // If editing, preserve existing photo if no new one selected
        if (editingRecipeId) {
            const recipes = getUserRecipes();
            const existingRecipe = recipes.find(r => r.id === editingRecipeId);
            if (existingRecipe) {
                recipe.photo = existingRecipe.photo;
            }
        }
        saveRecipe(recipe);
    }
}

// Filter recipes by search term
function filterRecipes(searchTerm) {
    const recipes = getUserRecipes();

    if (searchTerm === '') {
        // Show all recipes if search is empty
        loadRecipes();
        return;
    }

    const filteredRecipes = recipes.filter(recipe => {
        const name = recipe.name.toLowerCase();
        const category = recipe.category.toLowerCase();
        const ingredients = recipe.ingredients.toLowerCase();

        return name.includes(searchTerm) ||
            category.includes(searchTerm) ||
            ingredients.includes(searchTerm);
    });

    recipesGrid.innerHTML = '';
    recipeCount.textContent = filteredRecipes.length;

    if (filteredRecipes.length === 0) {
        emptyState.classList.add('show');
        emptyState.querySelector('h3').textContent = 'No recipes found';
        emptyState.querySelector('p').textContent = `No recipes match "${searchTerm}"`;
        recipesGrid.style.display = 'none';
    } else {
        emptyState.classList.remove('show');
        recipesGrid.style.display = 'grid';

        filteredRecipes.forEach(recipe => {
            const card = createRecipeCard(recipe);
            recipesGrid.appendChild(card);
        });
    }
}

// Save Recipe
function saveRecipe(recipe) {
    let recipes = getUserRecipes();
    let isNew = false;

    if (editingRecipeId) {
        // Update existing recipe
        const index = recipes.findIndex(r => r.id === editingRecipeId);
        if (index !== -1) {
            recipe.id = editingRecipeId; // Keep original ID
            recipe.dateAdded = recipes[index].dateAdded; // Keep original date
            recipes[index] = recipe;
        }
        editingRecipeId = null; // Reset editing state
    } else {
        // Check recipe limit for free users
        if (!isPremium() && recipes.length >= FREE_RECIPE_LIMIT) {
            showUpgradePrompt('recipe_limit');
            return;
        }

        // Add new recipe
        recipes.push(recipe);
        isNew = true;
    }

    // Try to save to storage
    const saveSuccess = saveUserRecipes(recipes);

    if (saveSuccess) {
        if (isNew) {
            showNotification('✅ Recipe saved to your collection! 🧁', 'success');
        } else {
            showNotification('✅ Recipe updated successfully! 🧁', 'success');
        }

        // Reset form
        form.reset();
        photoPreview.classList.remove('has-image');
        const img = photoPreview.querySelector('img');
        if (img) img.remove();

        // Reset button text
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<span class="btn-icon">✨</span> Add Recipe';

        // Switch to My Recipes tab
        setTimeout(() => {
            document.querySelector('[data-tab="my-recipes"]').click();
        }, 1000);
    } else {
        // If save failed, restore editing state if needed so user doesn't lose data
        // For new recipes, they just stay on the form
        if (!isNew) {
            // If update failed, we might want to let them stay in "edit mode".
            // But we already set editingRecipeId = null above.
            // Ideally we should warn them. The saveUserRecipes already alerted.
        }
    }
}

// Load Recipes
function loadRecipes() {
    const recipes = getUserRecipes();

    recipesGrid.innerHTML = '';
    recipeCount.textContent = recipes.length;

    if (recipes.length === 0) {
        emptyState.classList.add('show');
        recipesGrid.style.display = 'none';
    } else {
        emptyState.classList.remove('show');
        recipesGrid.style.display = 'grid';

        recipes.forEach(recipe => {
            const card = createRecipeCard(recipe);
            recipesGrid.appendChild(card);
        });
    }
}

// Create Recipe Card
function createRecipeCard(recipe) {
    const card = document.createElement('div');
    card.className = 'recipe-card';

    const categoryEmoji = getCategoryEmoji(recipe.category);
    const difficultyText = getDifficultyText(recipe.difficulty);
    const totalTime = recipe.prepTime + recipe.cookTime;

    card.innerHTML = `
        <div class="recipe-card-image">
            <div class="recipe-checkbox-container">
                <input type="checkbox" class="recipe-checkbox" data-id="${recipe.id}">
            </div>
            ${recipe.photo
            ? `<img src="${recipe.photo}" alt="${recipe.name}">`
            : categoryEmoji}
        </div>
        <div class="recipe-card-content">
            <span class="recipe-card-category">${recipe.category}</span>
            <h3 class="recipe-card-title">${recipe.name}</h3>
            <div class="recipe-card-meta">
                <span>⏱️ ${totalTime} min</span>
                <span>👥 ${recipe.servings} servings</span>
                <span>${difficultyText}</span>
            </div>
            <div class="recipe-card-actions">
                <button class="btn-view" data-action="view" data-id="${recipe.id}">View</button>
                <button class="btn-menu" data-action="menu" data-id="${recipe.id}">Menu</button>
                <button class="btn-view" data-action="pdf" data-id="${recipe.id}">PDF</button>
                <button class="btn-edit" data-action="edit" data-id="${recipe.id}">Edit</button>
                <button class="btn-delete" data-action="delete" data-id="${recipe.id}">Delete</button>
            </div>
        </div>
    `;

    // Add event listeners
    card.querySelector('[data-action="view"]').addEventListener('click', () => viewRecipe(recipe.id));
    card.querySelector('[data-action="menu"]').addEventListener('click', (e) => {
        e.stopPropagation();
        openDayPickerModal(recipe);
    });
    card.querySelector('[data-action="pdf"]').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click if any
        saveRecipeAsPdf(recipe);
    });
    card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteRecipe(recipe.id);
    });
    card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
        e.stopPropagation();
        editRecipe(recipe.id);
    });

    // Checkbox click event
    card.querySelector('.recipe-checkbox').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    return card;
}

// Edit Recipe
function editRecipe(id) {
    const recipes = getUserRecipes();
    const recipe = recipes.find(r => r.id === id);

    if (!recipe) return;

    editingRecipeId = id;

    // Populate form fields
    document.getElementById('recipeName').value = recipe.name;
    document.getElementById('category').value = recipe.category;
    document.getElementById('prepTime').value = recipe.prepTime;
    document.getElementById('cookTime').value = recipe.cookTime;
    document.getElementById('servings').value = recipe.servings;
    document.getElementById('difficulty').value = recipe.difficulty;
    document.getElementById('ingredients').value = recipe.ingredients;
    document.getElementById('instructions').value = recipe.instructions;
    document.getElementById('notes').value = recipe.notes || '';

    // Handle photo preview
    if (recipe.photo) {
        const existingImg = photoPreview.querySelector('img');
        if (existingImg) existingImg.remove();

        const img = document.createElement('img');
        img.src = recipe.photo;
        img.alt = 'Recipe Photo';
        photoPreview.appendChild(img);
        photoPreview.classList.add('has-image');
    } else {
        photoPreview.classList.remove('has-image');
        const img = photoPreview.querySelector('img');
        if (img) img.remove();
    }

    // Change submit button text
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<span class="btn-icon">💾</span> Update Recipe';

    // Switch to Add Recipe tab
    document.querySelector('[data-tab="add-recipe"]').click();
}

// Helper Functions
function getCategoryEmoji(category) {
    const emojis = {
        'cakes': '🎂',
        'cookies': '🍪',
        'pastries': '🥐',
        'pies': '🥧',
        'breads': '🍞',
        'desserts': '🍰',
        'chocolates': '🍫',
        'other': '✨'
    };
    return emojis[category] || '🧁';
}

function getDifficultyText(difficulty) {
    const levels = {
        'easy': '🟢 Easy',
        'medium': '🟡 Medium',
        'hard': '🔴 Hard'
    };
    return levels[difficulty] || '🟡 Medium';
}

// View Recipe
function viewRecipe(id) {
    const recipes = getUserRecipes();
    const recipe = recipes.find(r => r.id === id);

    if (!recipe) return;

    const categoryEmoji = getCategoryEmoji(recipe.category);
    const difficultyText = getDifficultyText(recipe.difficulty);
    const totalTime = recipe.prepTime + recipe.cookTime;

    modalBody.innerHTML = `
        <div class="modal-recipe-image">
            ${recipe.photo
            ? `<img src="${recipe.photo}" alt="${recipe.name}">`
            : `<span class="placeholder-icon">${categoryEmoji}</span>`}
        </div>
        <div class="modal-header-actions" style="margin-top: 1rem; display: flex; justify-content: flex-end;">
           <button class="btn btn-primary" id="modalSavePdf" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                <span class="btn-icon">📄</span> Save as PDF
           </button>
        </div>
        <h2 class="modal-recipe-title">${recipe.name}</h2>
        <div class="modal-recipe-meta">
            <div class="meta-item">
                <span class="meta-icon">📁</span>
                ${recipe.category}
            </div>
            <div class="meta-item">
                <span class="meta-icon">⏱️</span>
                Prep: ${recipe.prepTime} min
            </div>
            <div class="meta-item">
                <span class="meta-icon">🔥</span>
                Cook: ${recipe.cookTime} min
            </div>
            <div class="meta-item">
                <span class="meta-icon">👥</span>
                ${recipe.servings} servings
            </div>
            <div class="meta-item">
                ${difficultyText}
            </div>
        </div>
        
        <div class="modal-section">
            <h3>🥄 Ingredients</h3>
            <ul>
                ${recipe.ingredients.split('\n').filter(i => i.trim()).map(i => `<li>${i}</li>`).join('')}
            </ul>
        </div>
        
        <div class="modal-section">
            <h3>📝 Instructions</h3>
            <ol>
                ${recipe.instructions.split('\n').filter(i => i.trim()).map(i => `<li>${i.replace(/^\d+\.\s*/, '')}</li>`).join('')}
            </ol>
        </div>
        
        ${recipe.notes ? `
            <div class="modal-section modal-notes">
                <h3>💡 Chef's Notes</h3>
                <p>${recipe.notes}</p>
            </div>
        ` : ''}
    `;

    // Add event listener for the modal PDF button
    document.getElementById('modalSavePdf').addEventListener('click', () => saveRecipeAsPdf(recipe));

    modal.classList.add('show');
}

// Delete Recipe
function deleteRecipe(id) {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    let recipes = getUserRecipes();
    recipes = recipes.filter(r => r.id !== id);
    saveUserRecipes(recipes);

    showNotification('Recipe deleted!', 'success');
    loadRecipes();
}

// Download Book as PDF
function handleDownloadPdf() {
    // Check for premium access
    if (!isPremium()) {
        showUpgradePrompt('pdf_export');
        return;
    }

    const recipes = getUserRecipes();

    if (recipes.length === 0) {
        showNotification('No recipes to save!', 'error');
        return;
    }

    // Check for selected recipes
    const selectedCheckboxes = document.querySelectorAll('.recipe-checkbox:checked');
    let recipesToSave = recipes;

    if (selectedCheckboxes.length > 0) {
        const selectedIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.id));
        recipesToSave = recipes.filter(r => selectedIds.includes(r.id));
        showNotification(`Saving ${recipesToSave.length} selected recipes...`, 'success');
    } else {
        showNotification(`Saving all ${recipes.length} recipes...`, 'success');
    }

    // Initialize jsPDF
    const doc = new jsPDF();

    // Title Page
    doc.setFillColor(255, 107, 138);
    doc.rect(0, 0, 210, 297, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.text('My Pastry', 105, 100, { align: 'center' });
    doc.text('Recipe Book', 105, 120, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(`${recipesToSave.length} Delicious Recipes`, 105, 150, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Created: ${new Date().toLocaleDateString()}`, 105, 280, { align: 'center' });

    // Recipe Pages
    recipesToSave.forEach((recipe, index) => {
        doc.addPage();
        generateRecipePdfPage(doc, recipe);

        // Page number footer
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Recipe ${index + 1} of ${recipesToSave.length}`, 105, 290, { align: 'center' });
    });

    // Save PDF
    doc.save('my_pastry_recipe_book.pdf');
    showNotification('PDF Recipe Book saved to your PC! 📄', 'success');
}

// Helper to generate a single recipe page
function generateRecipePdfPage(doc, recipe) {
    // Header with gradient-like effect
    doc.setFillColor(255, 107, 138);
    doc.rect(0, 0, 210, 40, 'F');

    // Recipe Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(recipe.name, 15, 25);

    // Category badge
    doc.setFontSize(10);
    doc.text(recipe.category.toUpperCase(), 195, 25, { align: 'right' });

    // Recipe Info
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    let y = 55;

    // Meta info
    doc.setFillColor(255, 240, 245);
    doc.roundedRect(15, y - 8, 180, 25, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.text(`Prep: ${recipe.prepTime} min`, 25, y + 3);
    doc.text(`Cook: ${recipe.cookTime} min`, 75, y + 3);
    doc.text(`Servings: ${recipe.servings}`, 125, y + 3);
    doc.text(`${recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}`, 175, y + 3);

    y += 25;

    // Recipe Photo
    if (recipe.photo) {
        try {
            // Add image (keep aspect ratio, max height 80mm)
            const imgProps = doc.getImageProperties(recipe.photo);
            const imgWidth = 180; // Full width inside margins
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

            // Limit height if too tall
            const maxHeight = 80;
            let finalWidth = imgWidth;
            let finalHeight = imgHeight;

            if (imgHeight > maxHeight) {
                finalHeight = maxHeight;
                finalWidth = (imgProps.width * finalHeight) / imgProps.height;
            }

            // Center image if width was reduced
            const xOffset = 15 + (180 - finalWidth) / 2;

            doc.addImage(recipe.photo, xOffset, y, finalWidth, finalHeight);
            y += finalHeight + 15;
        } catch (err) {
            console.error('Error adding image to PDF:', err);
            // Fallback if image fails
            y += 10;
        }
    } else {
        y += 10;
    }

    // Ingredients Section
    doc.setFillColor(255, 107, 138);
    doc.rect(15, y - 5, 4, 15, 'F');
    doc.setTextColor(255, 107, 138);
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
        doc.text(`• ${ing}`, 20, y);
        y += 7;
    });

    y += 10;

    // Instructions Section
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

    // Notes Section
    if (recipe.notes && recipe.notes.trim()) {
        y += 10;
        if (y > 250) {
            doc.addPage();
            y = 20;
        }

        doc.setFillColor(168, 85, 247);
        doc.rect(15, y - 5, 4, 15, 'F');
        doc.setTextColor(168, 85, 247);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("Chef's Notes", 25, y + 5);

        y += 15;
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        const noteLines = doc.splitTextToSize(recipe.notes, 170);
        noteLines.forEach(line => {
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
            doc.text(line, 20, y);
            y += 7;
        });
    }
}

// Save Single Recipe as PDF
function saveRecipeAsPdf(recipe) {
    // Check for premium access
    if (!isPremium()) {
        showUpgradePrompt('pdf_export');
        return;
    }

    // Initialize jsPDF
    const doc = new jsPDF();

    // Generate content
    generateRecipePdfPage(doc, recipe);

    // Add date footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const date = new Date().toLocaleDateString();
    doc.text(`Saved on ${date}`, 105, 290, { align: 'center' });

    // Save PDF
    const filename = `${recipe.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    doc.save(filename);
    showNotification('Recipe saved as PDF! 📄', 'success');
}

// Clear All Recipes
function handleClearAll() {
    if (!confirm('Are you sure you want to delete ALL your recipes? This cannot be undone!')) return;

    const key = getUserRecipeKey();
    if (key) {
        localStorage.removeItem(key);
    }
    loadRecipes();
    showNotification('All your recipes have been deleted!', 'success');
}

// Show Upgrade Prompt Modal
function showUpgradePrompt(feature) {
    const featureMessages = {
        'pdf_export': {
            title: '📄 PDF Export is a Premium Feature',
            description: 'Upgrade to Premium to export your recipes as beautiful PDF documents!',
            benefits: [
                'Export individual recipes as PDF',
                'Download your entire recipe book',
                'Share recipes with friends and family'
            ]
        },
        'recipe_limit': {
            title: '📝 Recipe Limit Reached',
            description: `You've reached the free limit of ${FREE_RECIPE_LIMIT} recipes. Upgrade to Premium for unlimited recipes!`,
            benefits: [
                'Store unlimited recipes',
                'Never lose a recipe again',
                'Organize your entire collection'
            ]
        },
        'default': {
            title: '💎 Premium Feature',
            description: 'This feature is available for Premium members only.',
            benefits: [
                'Unlimited recipes',
                'PDF export',
                'Priority support'
            ]
        }
    };

    const message = featureMessages[feature] || featureMessages['default'];

    // Create modal
    const existingModal = document.getElementById('upgradePromptModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'upgradePromptModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content upgrade-modal-content">
            <button class="modal-close" id="closeUpgradeModal">&times;</button>
            <div class="upgrade-icon" style="font-size: 4rem; text-align: center; margin-bottom: 20px;">💎</div>
            <h2 style="text-align: center; margin-bottom: 15px;">${message.title}</h2>
            <p style="text-align: center; color: var(--text-secondary); margin-bottom: 25px;">${message.description}</p>
            <ul class="upgrade-features" style="list-style: none; padding: 0; margin-bottom: 30px;">
                ${message.benefits.map(b => `<li style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);"><span style="margin-right: 10px;">✅</span>${b}</li>`).join('')}
            </ul>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button class="btn btn-secondary" id="maybeLaterBtn">
                    <span>⏰</span> Maybe Later
                </button>
                <a href="./payment.html" class="btn btn-upgrade" style="text-decoration: none;">
                    <span>💎</span> Upgrade Now
                </a>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('closeUpgradeModal').addEventListener('click', () => modal.remove());
    document.getElementById('maybeLaterBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// End of main.js
