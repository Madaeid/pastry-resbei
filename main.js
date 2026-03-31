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
let editUserBtn, editUserModal, closeEditUserModal, editUserForm, modalLogoutBtn, profileLogoutBtn;
let editProfilePreview, editProfilePhoto;
let dayPickerModal, closeDayPickerModalBtn;
let themeToggle;
let myChefsGrid, myChefsEmptyState, myChefsSearch;
let editingRecipeId = null;
let selectedRecipeForMenu = null;
let currentUserRecipes = []; // Store recipes in memory


// Wait for DOM to be fully loaded, or run immediately if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // DOM is already ready (loading, interactive, or complete)
    initApp();
}

async function initApp() {
    // Initialize DOM Elements
    tabs = document.querySelectorAll('.nav-btn');
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
    profileLogoutBtn = document.getElementById('profileLogoutBtn');
    editProfilePreview = document.getElementById('editProfilePreview');
    editProfilePhoto = document.getElementById('editProfilePhoto');
    dayPickerModal = document.getElementById('dayPickerModal');
    closeDayPickerModalBtn = document.getElementById('closeDayPickerModal');
    themeToggle = document.getElementById('themeToggle');
    myChefsGrid = document.getElementById('myChefsGrid');
    myChefsEmptyState = document.getElementById('myChefsEmptyState');
    myChefsSearch = document.getElementById('myChefsSearch');

    // CV Upload Elements
    const editCvUploadBtn = document.getElementById('editCvUploadBtn');
    const editCvFile = document.getElementById('editCvFile');
    const cvUploadStatus = document.getElementById('cvUploadStatus');
    const viewUserCvBtn = document.getElementById('viewUserCvBtn');

    if (editCvUploadBtn && editCvFile) {
        editCvUploadBtn.addEventListener('click', () => editCvFile.click());
        editCvFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.type !== 'application/pdf') {
                    showNotification('❌ Please upload a PDF file for your CV.', 'error');
                    editCvFile.value = '';
                    if (cvUploadStatus) cvUploadStatus.textContent = '';
                    return;
                }
                const maxSize = 2 * 1024 * 1024; // 2MB
                if (file.size > maxSize) {
                    showNotification('❌ CV file is too large! Please choose a file under 2MB.', 'error');
                    editCvFile.value = '';
                    if (cvUploadStatus) cvUploadStatus.textContent = '';
                    return;
                }
                if (cvUploadStatus) cvUploadStatus.textContent = `Selected: ${file.name}`;
            } else {
                if (cvUploadStatus) cvUploadStatus.textContent = '';
            }
        });
    }



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

    // Handle initial tab from hash or default to home
    handleHashRouting();
}

/**
 * Handle routing based on URL hash
 */
function handleHashRouting() {
    const hash = window.location.hash.substring(1);
    const validTabs = ['chefs', 'my-chefs', 'add-recipe', 'my-recipes'];

    // If we have a hash and it's a valid tab, switch to it
    if (hash && validTabs.includes(hash)) {
        const tabButton = document.querySelector(`.nav-btn[data-tab="${hash}"]`);
        if (tabButton) {
            tabButton.click();
            return;
        }
    }

    // Default fallback: Load My Recipes
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'my-recipes') {
        loadRecipes();
    } else if (activeTab && activeTab.id === 'chefs') {
        loadChefs();
    } else if (activeTab && activeTab.id === 'my-chefs') {
        loadMyChefs();
    }
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

    // Search Chefs
    const chefsSearch = document.getElementById('chefsSearch');
    if (chefsSearch) {
        chefsSearch.addEventListener('input', function (e) {
            loadChefs();
        });
    }

    // Search My Chefs
    if (myChefsSearch) {
        myChefsSearch.addEventListener('input', function (e) {
            loadMyChefs();
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
            } else if (targetTab === 'chefs') {
                loadChefs();
            } else if (targetTab === 'my-chefs') {
                loadMyChefs();
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

    // Quick Add from My Recipes
    const myRecipesAddBtn = document.getElementById('myRecipesAddBtn');
    if (myRecipesAddBtn) {
        myRecipesAddBtn.addEventListener('click', () => {
            const addTabBtn = document.querySelector('.nav-btn[data-tab="add-recipe"]');
            if (addTabBtn) addTabBtn.click();
        });
    }



    // Edit User Modal Triggers
    const userDisplay = document.getElementById('sidebarUserDisplay');
    if (userDisplay) {
        userDisplay.addEventListener('click', openEditUserModal);
        userDisplay.style.cursor = 'pointer'; // Ensure it looks clickable
        userDisplay.title = 'Edit Profile';
    }

    if (editUserBtn) {
        // Kept for backward compatibility if button exists in other views
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

    if (profileLogoutBtn) {
        profileLogoutBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent opening edit profile
            logout();
        });
    }

    // Edit Profile Picture Upload
    if (editProfilePreview && editProfilePhoto) {
        editProfilePreview.addEventListener('click', () => editProfilePhoto.click());

        editProfilePhoto.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                // Check file size (max 100KB)
                const maxSize = 100 * 1024; // 100KB in bytes
                if (file.size > maxSize) {
                    showNotification('❌ Image is too large! Please choose an image under 100KB.', 'error');
                    editProfilePhoto.value = ''; // Clear the input
                    return;
                }

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

    // Premium Badge Click
    if (premiumBadge) {
        premiumBadge.style.cursor = 'pointer';
        premiumBadge.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent opening edit profile
            showPremiumProfileModal();
        });
    }

    // Visibility Checkbox Logic
    // Visibility Checkbox Logic
    const isPrivateCheckbox = document.getElementById('isPrivate');
    const privacyLabel = document.getElementById('privacyLabel');
    const premiumLabel = document.getElementById('premiumLabel');

    if (isPrivateCheckbox) {
        // Initial state check
        if (privacyLabel) {
            privacyLabel.textContent = isPrivateCheckbox.checked ? 'Private 🔒' : 'Public 🌍';
        }

        isPrivateCheckbox.addEventListener('change', function () {
            // Update label based on state
            if (privacyLabel) {
                privacyLabel.textContent = this.checked ? 'Private 🔒' : 'Public 🌍';
            }
        });
    }

    // Header Add Photo Button
    // Note: These now navigate to profile-photo.html via href
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

    // Handle CV presentation
    const editCvFile = document.getElementById('editCvFile');
    const cvUploadStatus = document.getElementById('cvUploadStatus');
    const viewUserCvBtn = document.getElementById('viewUserCvBtn');

    if (editCvFile) editCvFile.value = '';
    if (cvUploadStatus) cvUploadStatus.textContent = '';

    if (viewUserCvBtn) {
        if (user.cvFile) {
            viewUserCvBtn.href = user.cvFile;
            viewUserCvBtn.style.display = 'inline-block';
        } else {
            viewUserCvBtn.style.display = 'none';
        }
    }

    // Set Visibility Toggle
    const editIsPublic = document.getElementById('userIsPublic');
    if (editIsPublic) {
        // Users are public by default
        editIsPublic.checked = user.isPublic !== false;
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
    const cvFileInput = document.getElementById('editCvFile');

    const updateData = {
        displayName: displayName,
        email: email,
        phoneNumber: phoneNumber,
        isPublic: document.getElementById('userIsPublic')?.checked
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

            if (updateData.profilePicture && userProfilePic) {
                userProfilePic.src = updateData.profilePicture;
                userProfilePic.style.display = 'block';
                if (userDefaultAvatar) userDefaultAvatar.style.display = 'none';
            }
            // If data didn't have new picture but user previously had one, we don't necessarily clear it here unless we explicity support removing it.
        } else {
            showNotification(result.error || 'Failed to update profile', 'error');
        }
    };

    // Handle Profile Picture
    const handleProfilePic = () => {
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
    };

    // Handle CV File Upload
    if (cvFileInput && cvFileInput.files && cvFileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            updateData.cvFile = e.target.result;
            handleProfilePic();
        };
        reader.readAsDataURL(cvFileInput.files[0]);
    } else {
        handleProfilePic();
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
        const displayName = currentUserObj ? currentUserObj.displayName : currentUsername;

        if (userProfilePic && userDefaultAvatar) {
            let picSrc = currentUserObj && currentUserObj.profilePicture;

            if (!picSrc) {
                // Generate avatar if no profile picture
                picSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff&size=64`;
            }

            userProfilePic.src = picSrc;
            userProfilePic.style.display = 'block';
            userDefaultAvatar.style.display = 'none';
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
        ingredients: document.getElementById('ingredients').value,
        instructions: document.getElementById('instructions').value,
        notes: document.getElementById('notes').value,
        visibility: document.getElementById('isPrivate').checked ? 'private' : 'public',
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
    if (!searchTerm) {
        // Show all recipes if search is empty
        renderRecipes(currentUserRecipes);
        return;
    }

    const filteredRecipes = currentUserRecipes.filter(recipe => {
        const name = recipe.name.toLowerCase();
        const category = recipe.category.toLowerCase();
        const ingredients = recipe.ingredients.toLowerCase();

        return name.includes(searchTerm) ||
            category.includes(searchTerm) ||
            ingredients.includes(searchTerm);
    });

    renderRecipes(filteredRecipes);
}

// Save Recipe
async function saveRecipe(recipe) {
    const token = sessionStorage.getItem('authToken');

    // Check limit if not editing (approximate check, backend enforced too)
    if (!editingRecipeId && !isPremium() && currentUserRecipes.length >= FREE_RECIPE_LIMIT) {
        showUpgradePrompt('recipe_limit');
        return;
    }

    try {
        let url = 'http://localhost:3001/api/recipes';
        let method = 'POST';

        if (editingRecipeId) {
            url = `http://localhost:3001/api/recipes/${editingRecipeId}`;
            method = 'PUT';
        }

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(recipe)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to save recipe');
        }

        if (data.requiresPremium) {
            showUpgradePrompt('recipe_limit');
            return;
        }

        showNotification(editingRecipeId ? '✅ Recipe updated successfully! 🧁' : '✅ Recipe saved to your collection! 🧁', 'success');

        editingRecipeId = null;

        // Reset form
        form.reset();
        photoPreview.classList.remove('has-image');
        const img = photoPreview.querySelector('img');
        if (img) img.remove();

        // Reset button text
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<span class="btn-icon">✨</span> Add Recipe';

        // Reload recipes
        await loadRecipes();

        // Switch to My Recipes tab
        setTimeout(() => {
            document.querySelector('.nav-btn[data-tab="my-recipes"]').click();
        }, 500);

    } catch (error) {
        console.error('Error saving recipe:', error);
        showNotification(error.message || '❌ Error saving recipe.', 'error');
    }
}

// Load Recipes
async function loadRecipes() {
    recipesGrid.innerHTML = '<div class="loading">Loading recipes...</div>';

    try {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch('http://localhost:3001/api/recipes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load recipes');

        currentUserRecipes = await response.json();
        renderRecipes(currentUserRecipes);

    } catch (error) {
        console.error('Error loading recipes:', error);
        // Fallback or empty state
        currentUserRecipes = [];
        renderRecipes([]);
    }
}

function renderRecipes(recipes) {
    recipesGrid.innerHTML = '';
    recipeCount.textContent = recipes.length;

    if (recipes.length === 0) {
        emptyState.classList.add('show');
        recipesGrid.style.display = 'none';

        // Update empty state text based on search/filter
        const searchTerm = recipeSearch ? recipeSearch.value.trim() : '';
        if (searchTerm) {
            emptyState.querySelector('h3').textContent = 'No recipes found';
            emptyState.querySelector('p').textContent = `No recipes match "${searchTerm}"`;
        } else {
            emptyState.querySelector('h3').textContent = 'Your recipe book is empty';
            emptyState.querySelector('p').textContent = 'Start adding your favorite recipes!';
        }
    } else {
        emptyState.classList.remove('show');
        recipesGrid.style.display = 'grid';

        recipes.forEach(recipe => {
            const card = createRecipeCard(recipe);
            recipesGrid.appendChild(card);
        });
    }
}



// Load Chefs
async function loadChefs() {
    const grid = document.getElementById('chefsGrid');
    const empty = document.getElementById('chefsEmptyState');
    const searchInput = document.getElementById('chefsSearch');

    if (!grid) return;

    try {
        grid.innerHTML = '<div class="loading">Loading chefs...</div>';

        // Fetch all users from real database
        const response = await fetch('http://localhost:3001/api/users/public');
        let chefs = response.ok ? await response.json() : [];

        // Extra filtering (already done on server but client-side for redundancy)
        chefs = chefs.filter(c => c.username !== 'admin' && c.isPublic !== false);

        // Search logic
        if (searchInput && searchInput.value.trim()) {
            const term = searchInput.value.toLowerCase().trim();
            chefs = chefs.filter(c =>
                c.displayName.toLowerCase().includes(term) ||
                c.username.toLowerCase().includes(term)
            );
        }

        grid.innerHTML = '';

        if (chefs.length === 0) {
            empty.style.display = 'block';
            grid.style.display = 'none';
        } else {
            empty.style.display = 'none';
            grid.style.display = 'grid';

            // Get all public recipes to count them per author
            const token = sessionStorage.getItem('authToken');
            const pubResponse = await fetch('http://localhost:3001/api/recipes/public', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const publicRecipes = pubResponse.ok ? await pubResponse.json() : [];

            chefs.forEach(chef => {
                // Count this chef's public recipes
                chef.recipesCount = publicRecipes.filter(r => r.author?.username === chef.username).length;
                const card = createChefCard(chef);
                grid.appendChild(card);
            });
        }
    } catch (e) {
        console.error('Error loading chefs:', e);
        grid.innerHTML = '<div class="error">Failed to load chefs.</div>';
    }
}

// Create Chef Card
function createChefCard(chef) {
    const card = document.createElement('div');
    card.className = 'recipe-card public-recipe-card chef-card';

    let picUrl = chef.profilePicture;
    if (!picUrl) {
        picUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(chef.displayName)}&background=random&color=fff&size=150`;
    }

    card.innerHTML = `
        <div class="recipe-card-image" style="height: 200px;">
            <img src="${picUrl}" alt="${chef.displayName}" style="object-fit: cover; height: 100%; width: 100%;">
            <div class="chef-badge">
                ⭐ Top Chef
            </div>
        </div>
        
        <div class="public-card-overlay">
            <h3 class="recipe-title">${chef.displayName}</h3>
            <p class="author-username">@${chef.username}</p>
            
            <div class="recipe-meta">
                <span>📖 <b>${chef.recipesCount}</b> Recipes</span>
                <span>👥 <b>${Math.floor(Math.random() * 500) + 50}</b> Followers</span>
            </div>
            
            <div class="chef-actions" style="display: flex; gap: 8px; width: 100%; margin-top: 10px;">
                <button class="btn btn-primary btn-sm view-chef-recipes" style="flex: 1; padding: 8px; font-size: 0.75rem; white-space: nowrap;">
                    View Profile
                </button>
                ${chef.cvFile ? `
                <a href="${chef.cvFile}" target="_blank" class="btn btn-outline btn-sm view-cv" style="padding: 8px; font-size: 0.75rem;" title="View Chef's CV">
                    📄 CV
                </a>` : ''}
                <button class="btn btn-outline btn-sm follow-chef" style="padding: 8px; font-size: 0.75rem;">
                    Follow
                </button>
            </div>
        </div>
    `;

    // Add click event for "View Profile" to show chef's recipes in a modal
    const viewBtn = card.querySelector('.view-chef-recipes');
    viewBtn.onclick = (e) => {
        e.stopPropagation();
        showChefRecipesModal(chef);
    };

    // Make whole card clickable too
    card.onclick = () => {
        showChefRecipesModal(chef);
    };

    // Follow button logic
    const followBtn = card.querySelector('.follow-chef');
    const updateFollowBtnStyle = () => {
        const isFollowing = isChefFollowed(chef.username);
        followBtn.textContent = isFollowing ? 'Following' : 'Follow';
        followBtn.style.background = isFollowing ? 'var(--accent-pink)' : 'rgba(255,255,255,0.1)';
        followBtn.classList.toggle('active', isFollowing);
    };

    updateFollowBtnStyle();

    followBtn.onclick = (e) => {
        e.stopPropagation();
        const success = toggleFollowChef(chef);
        if (success) {
            updateFollowBtnStyle();
            const isFollowing = isChefFollowed(chef.username);
            showNotification(isFollowing ? `Following ${chef.displayName}!` : `Unfollowed ${chef.displayName}`, 'success');

            // If we are on the My Chefs tab, reload it
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab && activeTab.id === 'my-chefs') {
                loadMyChefs();
            }
        }
    };

    return card;
}

// ===== Show Chef Recipes Modal =====
async function showChefRecipesModal(chef) {
    // Remove existing modal if any
    const existing = document.getElementById('chefRecipesModal');
    if (existing) existing.remove();

    let picUrl = chef.profilePicture;
    if (!picUrl) {
        picUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(chef.displayName)}&background=random&color=fff&size=150`;
    }

    const isFollowing = isChefFollowed(chef.username);

    // Create modal
    const modalEl = document.createElement('div');
    modalEl.id = 'chefRecipesModal';
    modalEl.className = 'modal show';
    modalEl.innerHTML = `
        <div class="modal-content chef-recipes-modal-content">
            <button class="modal-close" id="closeChefRecipesModal">&times;</button>
            
            <!-- Chef Profile Header -->
            <div class="chef-modal-header">
                <div class="chef-modal-avatar">
                    <img src="${picUrl}" alt="${chef.displayName}">
                </div>
                <div class="chef-modal-info">
                    <h2 class="chef-modal-name">${chef.displayName}</h2>
                    <p class="chef-modal-username">@${chef.username}</p>
                    <div class="chef-modal-stats">
                        <span class="chef-stat">📖 <b id="chefModalRecipeCount">...</b> Recipes</span>
                        ${chef.isPremium ? '<span class="chef-stat chef-stat-premium">💎 Premium Chef</span>' : ''}
                    </div>
                    <div class="chef-modal-actions-row">
                        <button class="btn btn-primary btn-sm chef-modal-follow" id="chefModalFollowBtn">
                            ${isFollowing ? '💖 Following' : '➕ Follow'}
                        </button>
                        ${chef.cvFile ? `<a href="${chef.cvFile}" target="_blank" class="btn btn-outline btn-sm">📄 View CV</a>` : ''}
                    </div>
                </div>
            </div>
            
            <!-- Gallery Section -->
            <div class="chef-modal-gallery-section" ${!chef.gallery || chef.gallery.length === 0 ? 'style="display:none;"' : ''}>
                <h3 class="chef-modal-section-title">📸 Chef's Gallery</h3>
                <div class="chef-modal-gallery-grid">
                    ${chef.gallery ? chef.gallery.map(img => `
                        <div class="chef-modal-gallery-item">
                            <img src="${img}" alt="Chef Photo" class="chef-gallery-img" loading="lazy">
                        </div>
                    `).join('') : ''}
                </div>
            </div>
            
            <!-- Recipes Grid -->
            <div class="chef-modal-recipes-section">
                <h3 class="chef-modal-section-title">🍽️ Public Recipes</h3>
                <div id="chefModalRecipesGrid" class="chef-modal-recipes-grid">
                    <div class="loading" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                        <span style="font-size: 2rem;">👨‍🍳</span>
                        <p>Loading recipes...</p>
                    </div>
                </div>
                <div id="chefModalEmptyState" class="chef-modal-empty" style="display: none;">
                    <span style="font-size: 3rem;">📭</span>
                    <h4>No public recipes yet</h4>
                    <p>This chef hasn't shared any recipes publicly.</p>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalEl);

    // Close handlers
    document.getElementById('closeChefRecipesModal').addEventListener('click', () => modalEl.remove());
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) modalEl.remove();
    });

    // Follow button in modal
    const followBtn = document.getElementById('chefModalFollowBtn');
    followBtn.onclick = () => {
        const success = toggleFollowChef(chef);
        if (success) {
            const nowFollowing = isChefFollowed(chef.username);
            followBtn.innerHTML = nowFollowing ? '💖 Following' : '➕ Follow';
            followBtn.style.background = nowFollowing ? 'var(--accent-pink)' : '';
            showNotification(nowFollowing ? `Following ${chef.displayName}!` : `Unfollowed ${chef.displayName}`, 'success');
        }
    };

    // Gallery Lightbox in Modal
    const galleryItems = modalEl.querySelectorAll('.chef-modal-gallery-item');
    galleryItems.forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            const imgSrc = item.querySelector('img').src;
            showGalleryLightbox(imgSrc);
        };
    }); function showGalleryLightbox(src) {
        const existing = document.getElementById('globalGalleryLightbox');
        if (existing) existing.remove();

        const lightbox = document.createElement('div');
        lightbox.id = 'globalGalleryLightbox';
        lightbox.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        cursor: zoom-out;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;

        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
        box-shadow: 0 0 50px rgba(0,0,0,0.5);
        border-radius: 8px;
        transform: scale(0.9);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

        lightbox.appendChild(img);
        document.body.appendChild(lightbox);

        // Fade in
        setTimeout(() => {
            lightbox.style.opacity = '1';
            img.style.transform = 'scale(1)';
        }, 10);

        const closeLightbox = () => {
            lightbox.style.opacity = '0';
            img.style.transform = 'scale(0.9)';
            setTimeout(() => lightbox.remove(), 300);
        };

        lightbox.onclick = closeLightbox;
        window.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                closeLightbox();
                window.removeEventListener('keydown', escHandler);
            }
        });
    }

    // Fetch and render recipes
    try {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch('http://localhost:3001/api/recipes/public', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const allRecipes = response.ok ? await response.json() : [];
        const chefRecipes = allRecipes.filter(r =>
            r.author?.username === chef.username ||
            r.author?.name === chef.displayName
        );

        const grid = document.getElementById('chefModalRecipesGrid');
        const emptyEl = document.getElementById('chefModalEmptyState');
        const countEl = document.getElementById('chefModalRecipeCount');

        if (countEl) countEl.textContent = chefRecipes.length;

        if (chefRecipes.length === 0) {
            grid.style.display = 'none';
            emptyEl.style.display = 'flex';
        } else {
            grid.innerHTML = '';
            emptyEl.style.display = 'none';

            chefRecipes.forEach(recipe => {
                const recipeCard = document.createElement('div');
                recipeCard.className = 'chef-modal-recipe-card';

                let photoDisplay = '';
                if (recipe.photo) {
                    photoDisplay = `<img src="${recipe.photo}" alt="${recipe.name}" loading="lazy">`;
                } else {
                    const emoji = getCategoryEmoji(recipe.category);
                    photoDisplay = `<div class="no-photo" style="display:flex; align-items:center; justify-content:center; height:100%; font-size:3rem; background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);">${emoji}</div>`;
                }

                const totalTime = recipe.prepTime + recipe.cookTime;
                const difficultyIcon = recipe.difficulty === 'easy' ? '🟢' : recipe.difficulty === 'medium' ? '🟡' : '🔴';

                recipeCard.innerHTML = `
                    <div class="chef-recipe-card-img">
                        ${photoDisplay}
                    </div>
                    <div class="chef-recipe-card-body">
                        <span class="chef-recipe-category">${recipe.category}</span>
                        <h4 class="chef-recipe-name">${recipe.name}</h4>
                        <div class="chef-recipe-meta">
                            <span>⏱️ ${totalTime}m</span>
                            <span>🍽️ ${recipe.servings}</span>
                            <span>${difficultyIcon}</span>
                        </div>
                        <button class="btn-view-chef-recipe">View Recipe</button>
                    </div>
                `;

                // Click to view recipe details
                recipeCard.querySelector('.btn-view-chef-recipe').onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    viewRecipe(recipe, true);
                };

                recipeCard.onclick = (e) => {
                    e.stopPropagation();
                    viewRecipe(recipe, true);
                };

                grid.appendChild(recipeCard);
            });
        }
    } catch (e) {
        console.error('Error loading chef recipes:', e);
        const grid = document.getElementById('chefModalRecipesGrid');
        if (grid) grid.innerHTML = '<div class="error" style="grid-column: 1 / -1; text-align: center; padding: 20px;">Failed to load recipes. Please try again.</div>';
    }
}

// Create Recipe Card (User's)
function createRecipeCard(recipe) {
    const card = document.createElement('div');
    // Use public card base style
    card.className = 'recipe-card public-recipe-card';

    const categoryEmoji = getCategoryEmoji(recipe.category);
    const difficultyText = getDifficultyText(recipe.difficulty);
    const totalTime = recipe.prepTime + recipe.cookTime;

    // Image logic for full card
    let photoDisplay = '';
    if (recipe.photo) {
        photoDisplay = `<img src="${recipe.photo}" alt="${recipe.name}">`;
    } else {
        photoDisplay = `<div class="no-photo" style="display:flex; align-items:center; justify-content:center; height:100%; font-size:4rem; background:linear-gradient(135deg, #eee 0%, #ddd 100%);">${categoryEmoji}</div>`;
    }

    card.innerHTML = `
        <div class="recipe-card-image">
            ${photoDisplay}
        </div>

        <div class="recipe-toggle-container">
            <label class="switch">
                <input type="checkbox" class="recipe-privacy-toggle" data-id="${recipe.id}" ${recipe.visibility === 'private' ? 'checked' : ''}>
                <span class="slider round"></span>
            </label>
            <span class="toggle-status-label" style="color: white; font-size: 0.8rem; font-weight: bold; margin-left: 5px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">
                ${recipe.visibility === 'private' ? 'Private 🔒' : 'Public 🌍'}
            </span>
        </div>

        <div class="recipe-category-tag" style="left: 15px; right: auto;">${recipe.category}</div>

        <div class="public-card-overlay">
            <h3 class="recipe-title">${recipe.name}</h3>
            
            <div class="recipe-meta">
                <span>⏱️ ${totalTime} min</span>
                <span>👥 ${recipe.servings}</span>
                <span>${difficultyText}</span>
            </div>

            <div class="overlay-actions">
                <button class="btn-overlay-action" data-action="view" title="View Recipe">👁️</button>
                <button class="btn-overlay-action" data-action="menu" title="Add to Menu">📅</button>
                <button class="btn-overlay-action" data-action="pdf" title="Save PDF">📄</button>
                <button class="btn-overlay-action" data-action="edit" title="Edit Recipe">✏️</button>
                <button class="btn-overlay-action btn-delete" data-action="delete" title="Delete Recipe">🗑️</button>
            </div>
        </div>
    `;

    // Add event listeners
    card.querySelector('[data-action="view"]').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        viewRecipe(recipe.id);
    });
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

    // Checkbox click event (Toggle Privacy)
    const privacyToggle = card.querySelector('.recipe-privacy-toggle');
    const statusLabel = card.querySelector('.toggle-status-label');

    privacyToggle.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    privacyToggle.addEventListener('change', async (e) => {
        e.stopPropagation();

        // Premium check
        if (e.target.checked && !isPremium()) {
            e.target.checked = false; // Revert
            showPremiumUpgradeModal('Private recipes are a premium feature. Upgrade to keep your secret family recipes safe! 🤫');
            return;
        }

        const newVisibility = e.target.checked ? 'private' : 'public';

        // Optimistic UI Update
        statusLabel.textContent = newVisibility === 'private' ? 'Private 🔒' : 'Public 🌍';

        // Call Update API
        try {
            const token = sessionStorage.getItem('authToken');
            const response = await fetch(`http://localhost:3001/api/recipes/${recipe.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    visibility: newVisibility,
                    name: recipe.name // Ensure name is sent as required by some implementations
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update');
            }

            // Update local model in memory
            recipe.visibility = newVisibility;
            const idx = currentUserRecipes.findIndex(r => r.id === recipe.id);
            if (idx !== -1) currentUserRecipes[idx].visibility = newVisibility;

            showNotification(newVisibility === 'private' ? '🔒 Recipe is now Private' : '🌍 Recipe is now Public');

        } catch (err) {
            console.error('Error updating privacy:', err);
            // Revert UI on failure
            e.target.checked = !e.target.checked;
            statusLabel.textContent = !e.target.checked ? 'Private 🔒' : 'Public 🌍';
            showNotification('❌ Error updating privacy', 'error');
        }
    });

    return card;
}

// Edit Recipe
function editRecipe(id) {
    const recipe = currentUserRecipes.find(r => r.id === id);
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

    // Set visibility
    const isPrivate = recipe.visibility === 'private';
    const isPrivateCheckbox = document.getElementById('isPrivate');
    const privacyLabel = document.getElementById('privacyLabel');

    if (isPrivateCheckbox) {
        isPrivateCheckbox.checked = isPrivate;
    }

    if (privacyLabel) {
        privacyLabel.textContent = isPrivate ? 'Private 🔒' : 'Public 🌍';
    }

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
function viewRecipe(idOrRecipe, isPublic = false) {
    let recipe;

    if (typeof idOrRecipe === 'object') {
        recipe = idOrRecipe;
    } else {
        recipe = currentUserRecipes.find(r => r.id === idOrRecipe);
    }

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
           ${!isPublic ? `<button class="btn btn-primary" id="modalSavePdf" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                <span class="btn-icon">📄</span> Save as PDF
           </button>` : ''}
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
    const savePdfBtn = document.getElementById('modalSavePdf');
    if (savePdfBtn) {
        savePdfBtn.addEventListener('click', () => saveRecipeAsPdf(recipe));
    }

    modal.classList.add('show');
}

// Delete Recipe
async function deleteRecipe(id) {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    try {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch(`http://localhost:3001/api/recipes/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete recipe');

        showNotification('Recipe deleted!', 'success');
        await loadRecipes(); // Reload from server

    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Failed to delete recipe', 'error');
    }
}

// Download Book as PDF
function handleDownloadPdf() {
    // Check for premium access
    if (!isPremium()) {
        showUpgradePrompt('pdf_export');
        return;
    }

    // Use current in-memory recipes
    const recipes = currentUserRecipes;

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
async function handleClearAll() {
    if (!confirm('Are you sure you want to delete ALL your recipes? This cannot be undone!')) return;

    try {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch('http://localhost:3001/api/recipes', {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete all recipes');

        showNotification('All your recipes have been deleted!', 'success');
        await loadRecipes();

    } catch (error) {
        console.error('Clear all error:', error);
        showNotification('Failed to clear recipes', 'error');
    }
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

// Using global function for cleaner modal handling
function showPremiumProfileModal() {
    const existing = document.getElementById('premiumProfileModal');
    if (existing) existing.remove();

    const currentUser = getCurrentUser();
    const users = getAllUsers();
    const user = users.find(u => u.username === currentUser);
    const subStatus = getSubscriptionStatus();

    let expiryText = 'Never';
    if (subStatus.endDate) {
        expiryText = new Date(subStatus.endDate).toLocaleDateString();
    } else if (subStatus.isAdminPrivilege) {
        expiryText = 'Lifetime (Admin)';
    }

    const modal = document.createElement('div');
    modal.id = 'premiumProfileModal';
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content modal-sm premium-profile-modal">
            <button class="modal-close" id="closePremiumProfileModal">&times;</button>
            <div class="premium-header">
                <div class="premium-avatar">${user.profilePicture ? `<img src="${user.profilePicture}">` : '👑'}</div>
                <h2>${user.displayName}</h2>
                <div class="premium-tag">💎 PREMIUM MEMBER</div>
            </div>
            <div class="premium-details">
                <div class="detail-item">
                    <span class="label">📧 Email</span>
                    <span class="value">${user.email || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="label">📅 Plan</span>
                    <span class="value">${subStatus.plan ? subStatus.plan.toUpperCase() : 'PREMIUM'}</span>
                </div>
                <div class="detail-item">
                    <span class="label">⏳ Expires</span>
                    <span class="value">${expiryText}</span>
                </div>
            </div>
            <div class="modal-actions" style="justify-content: center;">
                <button class="btn btn-primary" onclick="window.location.href='./payment.html'">
                    ⚙️ Manage Subscription
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('closePremiumProfileModal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// ===== Followed Chefs Storage =====
function getFollowedChefsKey() {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;
    return `followedChefs_${currentUser.toLowerCase()}`;
}

function getFollowedChefs() {
    const key = getFollowedChefsKey();
    if (!key) return [];
    return JSON.parse(localStorage.getItem(key) || '[]');
}

function isChefFollowed(username) {
    const followed = getFollowedChefs();
    return followed.some(c => c.username === username);
}

function toggleFollowChef(chef) {
    const key = getFollowedChefsKey();
    if (!key) return false;

    let followed = getFollowedChefs();
    const index = followed.findIndex(c => c.username === chef.username);

    if (index === -1) {
        // Add chef
        followed.push({
            username: chef.username,
            displayName: chef.displayName,
            profilePicture: chef.profilePicture,
            cvFile: chef.cvFile,
            gallery: chef.gallery || [],
            recipesCount: chef.recipesCount || 0
        });
    } else {
        // Remove chef
        followed.splice(index, 1);
    }

    localStorage.setItem(key, JSON.stringify(followed));
    return true;
}

// ===== Load & Render My Chefs =====
async function loadMyChefs() {
    if (!myChefsGrid) return;

    myChefsGrid.innerHTML = '<div class="loading">Loading followed chefs...</div>';

    try {
        let followed = getFollowedChefs();
        
        // Sync with server for latest info (gallery, pic, etc.)
        const pubResponse = await fetch('http://localhost:3001/api/users/public');
        if (pubResponse.ok) {
            const allProfiles = await pubResponse.json();
            
            // Re-fetch all public recipes to update recipe counts
            const recipesResponse = await fetch('http://localhost:3001/api/recipes/public');
            const allPublicRecipes = recipesResponse.ok ? await recipesResponse.json() : [];

            followed = followed.map(f => {
                const latest = allProfiles.find(p => p.username === f.username);
                if (latest) {
                    // Update count too
                    latest.recipesCount = allPublicRecipes.filter(r => r.author?.username === latest.username).length;
                    return latest;
                }
                return f;
            });
        }
        
        let chefs = followed;

        // Filter by search
        const searchTerm = myChefsSearch ? myChefsSearch.value.trim().toLowerCase() : '';
        if (searchTerm) {
            chefs = chefs.filter(c =>
                c.displayName.toLowerCase().includes(searchTerm) ||
                c.username.toLowerCase().includes(searchTerm)
            );
        }

        renderMyChefs(chefs);
    } catch (e) {
        console.error('Error loading my chefs:', e);
        myChefsGrid.innerHTML = '<div class="error">Failed to load followed chefs.</div>';
    }
}

function renderMyChefs(chefs) {
    myChefsGrid.innerHTML = '';

    if (chefs.length === 0) {
        myChefsGrid.style.display = 'none';
        myChefsEmptyState.style.display = 'block';
    } else {
        myChefsGrid.style.display = 'grid';
        myChefsEmptyState.style.display = 'none';

        chefs.forEach(chef => {
            const card = createChefCard(chef);
            myChefsGrid.appendChild(card);
        });
    }
}
