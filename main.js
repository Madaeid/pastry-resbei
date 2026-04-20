// Chef Book - ES Module Version
import './style.css';
import { jsPDF } from 'jspdf';
import { isLoggedIn, logout, getCurrentUser, isAdmin, getAllUsers, updateUser } from './auth.js';
import { isPremium, getSubscriptionStatus, syncSubscriptionFromServer } from './payment.js';
import { initLanguage, t, getCurrentLanguage } from './language.js';
import { createPostCard, formatTimeAgo, renderCommentsList } from './social-ui.js';
import { getCategoryEmoji, getDifficultyText } from './recipe-utils.js';

// Free tier limits
const FREE_RECIPE_LIMIT = 10;

// DOM Elements - will be initialized after DOM is ready
let tabs, tabContents, recipesGrid, emptyState, recipeCount;
let downloadPdfBtn, clearAllBtn, modal, closeModal, modalBody, recipeSearch;
let editUserBtn, editUserModal, closeEditUserModal, editUserForm, modalLogoutBtn, profileLogoutBtn;
const API_URL = '/api';
let editProfilePreview, editProfilePhoto;
let dayPickerModal, closeDayPickerModalBtn;
let themeToggle;
let myChefsGrid, myChefsEmptyState, myChefsSearch;
let editingRecipeId = null;
let selectedRecipeForMenu = null;
let currentUserRecipes = []; // Store recipes in memory
let addRecipePhoto = null; // Store currently selected/uploaded photo
let addRecipeVideo = null; // Store currently selected/uploaded video
let currentVisibilityFilter = 'all'; // 'all', 'public', or 'private'
let quickPostInput, quickPostBtn, quickPostPhotoInput, quickPostVideoInput;
let quickPostMediaPreview, qpPhotoPreview, qpVideoPreview, qpRemoveMedia;



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

    const likesModal = document.getElementById('likesModal');
    const closeLikesModal = document.getElementById('closeLikesModal');
    const likesListBody = document.getElementById('likesListBody');
    if (closeLikesModal && likesModal) {
        closeLikesModal.onclick = () => likesModal.style.display = 'none';
    }

    // Add Recipe Modal Elements
    const sidebarAddRecipeBtn = document.getElementById('sidebarAddRecipeBtn');
    const addRecipeModal = document.getElementById('addRecipeModal');
    const closeAddRecipeModal = document.getElementById('closeAddRecipeModal');
    const addRecipeForm = document.getElementById('addRecipeForm');
    const recipeImageUpload = document.getElementById('recipeImageUpload');
    const addRecipePhotoInput = document.getElementById('addRecipePhotoInput');
    const addRecipePreview = document.getElementById('addRecipePreview');
    const addUploadPlaceholder = document.getElementById('addUploadPlaceholder');
    const recipeVideoUpload = document.getElementById('recipeVideoUpload');
    const addRecipeVideoInput = document.getElementById('addRecipeVideoInput');
    const addRecipeVideoPreview = document.getElementById('addRecipeVideoPreview');
    const addVideoUploadPlaceholder = document.getElementById('addVideoUploadPlaceholder');
    // addRecipePhoto/addRecipeVideo are now top-level


    if (addRecipeModal) {
        if (sidebarAddRecipeBtn) {
            sidebarAddRecipeBtn.addEventListener('click', () => {
                addRecipeModal.style.display = 'flex';
            });
        }

        const myRecipesAddBtn = document.getElementById('myRecipesAddBtn');
        if (myRecipesAddBtn && addRecipeModal) {
            myRecipesAddBtn.addEventListener('click', () => {
                editingRecipeId = null;
                addRecipeForm.reset();
                addRecipePreview.style.display = 'none';
                addUploadPlaceholder.style.display = 'block';
                addRecipePhoto = null;
                if (addRecipeVideoPreview) addRecipeVideoPreview.style.display = 'none';
                if (addVideoUploadPlaceholder) addVideoUploadPlaceholder.style.display = 'block';
                addRecipeVideo = null;
                const submitBtn = addRecipeForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.querySelector('span:not(.btn-icon)').textContent = 'Add Recipe';
                }
                document.querySelector('#addRecipeModal h2 span').textContent = 'Add New Recipe';
                addRecipeModal.style.display = 'flex';
            });
        }

        if (closeAddRecipeModal) {
            closeAddRecipeModal.addEventListener('click', () => {
                addRecipeModal.style.display = 'none';
            });
        }

        // Form Photo Upload Preview
        if (recipeImageUpload && addRecipePhotoInput) {
            recipeImageUpload.onclick = () => addRecipePhotoInput.click();
            addRecipePhotoInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        addRecipePhoto = event.target.result;
                        addRecipePreview.src = addRecipePhoto;
                        addRecipePreview.style.display = 'block';
                        addUploadPlaceholder.style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                }
            };
        }

        // Form Video Upload Preview
        if (recipeVideoUpload && addRecipeVideoInput) {
            recipeVideoUpload.onclick = () => addRecipeVideoInput.click();
            addRecipeVideoInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    // 5MB Limit for videos to prevent storage issues
                    const maxSize = 5 * 1024 * 1024;
                    if (file.size > maxSize) {
                        showNotification('❌ Video file is too large! Please choose a file under 5MB.', 'error');
                        addRecipeVideoInput.value = '';
                        return;
                    }

                    const reader = new FileReader();
                    reader.onload = (event) => {
                        addRecipeVideo = event.target.result;
                        addRecipeVideoPreview.src = addRecipeVideo;
                        addRecipeVideoPreview.style.display = 'block';
                        addVideoUploadPlaceholder.style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                }
            };
        }

        // Difficulty Selection
        const diffBtns = addRecipeModal.querySelectorAll('.diff-btn');
        const diffInput = document.getElementById('addRecipeDifficulty');
        diffBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                diffBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (diffInput) diffInput.value = btn.getAttribute('data-value');
            });
        });

        // Form Submission
        if (addRecipeForm) {
            addRecipeForm.onsubmit = async (e) => {
                e.preventDefault();

                const recipeData = {
                    name: document.getElementById('addRecipeName').value.trim(),
                    category: document.getElementById('addRecipeCategory').value,
                    difficulty: diffInput ? diffInput.value : 'Medium',
                    prepTime: parseInt(document.getElementById('addPrepTime').value) || 0,
                    cookTime: parseInt(document.getElementById('addCookTime').value) || 0,
                    ingredients: document.getElementById('addRecipeIngredients').value.trim(),
                    instructions: document.getElementById('addRecipeInstructions').value.trim(),
                    notes: document.getElementById('addRecipeNotes').value.trim(),
                    photo: addRecipePhoto,
                    video: addRecipeVideo,
                    visibility: document.getElementById('addRecipeIsPublic')?.checked ? 'public' : 'private',
                    createdAt: new Date().toISOString()
                };

                const token = sessionStorage.getItem('authToken');
                if (!token) {
                    showNotification('❌ Session expired. Please log in again.', 'error');
                    window.location.href = 'auth.html';
                    return;
                }

                try {
                    const url = editingRecipeId ? `${API_URL}/recipes/${editingRecipeId}` : `${API_URL}/recipes`;
                    const method = editingRecipeId ? 'PUT' : 'POST';

                    const response = await fetch(url, {
                        method: method,
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(recipeData)
                    });

                    const data = await response.json();

                    if (response.ok) {
                        if (data.requiresPremium) {
                            showNotification('❌ Free tier limit reached! Upgrade to premium.', 'error');
                            setTimeout(() => window.location.href = 'payment.html', 2000);
                            return;
                        }

                        showNotification(editingRecipeId ? '✅ Recipe updated successfully! 🧁' : '✅ Recipe added successfully! 🧁', 'success');
                        addRecipeModal.style.display = 'none';
                        editingRecipeId = null;
                        addRecipeForm.reset();
                        addRecipePreview.style.display = 'none';
                        addUploadPlaceholder.style.display = 'block';
                        addRecipePhoto = null;
                        if (addRecipeVideoPreview) addRecipeVideoPreview.style.display = 'none';
                        if (addVideoUploadPlaceholder) addVideoUploadPlaceholder.style.display = 'block';
                        addRecipeVideo = null;

                        await loadRecipes();
                        if (document.getElementById('home').classList.contains('active')) {
                            await loadHomeFeed();
                        }
                    } else {
                        showNotification(data.error || '❌ Failed to save recipe', 'error');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    showNotification('❌ Connection error. Please try again.', 'error');
                }
            };
        }
    }

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
    loadHomeFeed();
    loadTrendingCarousel();

    // Trending "View All" button → navigate to Store tab
    const trendingViewAllBtn = document.getElementById('trendingViewAllBtn');
    if (trendingViewAllBtn) {
        trendingViewAllBtn.addEventListener('click', () => {
            const storeTabBtn = document.querySelector('[data-tab="store"]');
            if (storeTabBtn) storeTabBtn.click();
        });
    }

    // Quick Post Logic
    initQuickPost();

    // Setup Store Marketplace listeners
    setupStoreListeners();

    // Handle initial tab from hash or default to home
    handleHashRouting();

    // Check for open_recipe in URL
    const urlParams = new URLSearchParams(window.location.search);
    const openRecipeId = urlParams.get('open_recipe');
    if (openRecipeId) {
        // Switch to store tab
        const storeTabBtn = document.querySelector('[data-tab="store"]');
        if (storeTabBtn) storeTabBtn.click();

        // Open the specific recipe
        setTimeout(() => typeof viewStoreRecipe === 'function' && viewStoreRecipe(openRecipeId), 500);
    }

    // Expose social functions to window for social-ui.js
    window.editPost = editPost;
    window.deletePost = deleteRecipe;
    window.toggleLike = toggleLike;
    window.sharePost = sharePost;
    window.handleShareRecipe = handleShareRecipe;
    window.submitComment = submitComment;
    window.editComment = editPostComment;
    window.deleteComment = deletePostComment;
}

/**
 * Handle routing based on URL hash
 */
function handleHashRouting() {
    const hash = window.location.hash.substring(1);
    const validTabs = ['home', 'chefs', 'my-chefs', 'store', 'book', 'add-recipe', 'my-recipes'];

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
    } else if (activeTab && activeTab.id === 'home') {
        loadHomeFeed();
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

    // Recipe Visibility Filter Tabs (All / Public / Private)
    const filterAllBtn = document.getElementById('filterAllRecipesBtn');
    const filterPublicBtn = document.getElementById('filterPublicRecipesBtn');
    const filterPrivateBtn = document.getElementById('filterPrivateRecipesBtn');
    const filterBtns = [filterAllBtn, filterPublicBtn, filterPrivateBtn].filter(Boolean);

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Set filter
            if (btn === filterAllBtn) currentVisibilityFilter = 'all';
            else if (btn === filterPublicBtn) currentVisibilityFilter = 'public';
            else if (btn === filterPrivateBtn) currentVisibilityFilter = 'private';

            // Re-apply filter with current search term
            const searchTerm = recipeSearch ? recipeSearch.value.toLowerCase().trim() : '';
            filterRecipes(searchTerm);
        });
    });

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

            // Refresh recipes when switching to tabs
            if (targetTab === 'my-recipes') {
                loadRecipes();
            } else if (targetTab === 'chefs') {
                loadChefs();
            } else if (targetTab === 'my-chefs') {
                loadMyChefs();
            } else if (targetTab === 'home') {
                loadHomeFeed();
            } else if (targetTab === 'store') {
                loadStoreRecipes();
            }


            // Update hero image based on tab
            const heroImg = document.getElementById('heroChefImg');
            if (heroImg) {
                let newSrc = '/new-chef-hero.png'; // Default (Home tab)
                if (targetTab === 'chefs') newSrc = '/chef-group.png';
                else if (targetTab === 'my-chefs') newSrc = '/my-chefs.png';
                else if (targetTab === 'store') newSrc = '/chef-store.png';
                else if (targetTab === 'my-recipes' || targetTab === 'add-recipe') newSrc = '/chef-book.png';
                else if (targetTab === 'book') newSrc = '/chef-portfolio.png';

                // Simple fade effect
                heroImg.style.opacity = '0.5';
                setTimeout(() => {
                    heroImg.src = newSrc;
                    heroImg.style.opacity = '1';
                }, 200);
            }
        });
    });



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

    const addRecipeModal = document.getElementById('addRecipeModal');
    if (addRecipeModal) {
        addRecipeModal.addEventListener('click', (e) => {
            if (e.target === addRecipeModal) addRecipeModal.classList.remove('show');
        });
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
    const premiumBadge = document.getElementById('premiumBadge');
    if (premiumBadge) {
        premiumBadge.style.cursor = 'pointer';
        premiumBadge.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent opening edit profile
            showPremiumProfileModal();
        });
    }



    // Note: These now navigate to profile-photo.html via href

    // Handle URL Hash for deep linking (e.g. from chef-profile.html)
    if (window.location.hash === '#edit-profile') {
        openEditUserModal();
        // Clean up hash for better UX
        if (window.history.replaceState) {
            window.history.replaceState(null, null, window.location.pathname);
        }
    }
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

            // Make avatar clickable
            userProfilePic.style.cursor = 'pointer';
            userProfilePic.onclick = () => {
                window.location.href = `./chef-profile.html?username=${currentUsername}`;
            };
        }

        // Make user name clickable to show "my page" (premium profile card)
        if (userNameElement) {
            userNameElement.style.cursor = 'pointer';
            userNameElement.title = "View my public profile";
            userNameElement.onclick = () => {
                window.location.href = `./chef-profile.html?username=${currentUsername}`;
            };
        }

        // Also make the whole sidebar user container clickable for better UX
        const sidebarUserDisplay = document.getElementById('sidebarUserDisplay');
        const sidebarBalanceContainer = document.getElementById('sidebarBalanceContainer');

        if (sidebarBalanceContainer) {
            sidebarBalanceContainer.onclick = (e) => {
                e.stopPropagation();
                window.location.href = './wallet.html';
            };
        }

        if (sidebarUserDisplay) {
            sidebarUserDisplay.style.cursor = 'pointer';
            sidebarUserDisplay.onclick = (e) => {
                // Don't trigger if clicking logout button or balance specifically
                if (e.target.id === 'profileLogoutBtn' || e.target.closest('#profileLogoutBtn')) return;
                if (e.target.id === 'sidebarBalanceContainer' || e.target.closest('#sidebarBalanceContainer')) return;
                window.location.href = `./chef-profile.html?username=${currentUsername}`;
            };
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

        // Update sidebar balance
        updateSidebarBalance();
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}



// Filter recipes by search term and visibility
function filterRecipes(searchTerm) {
    let filtered = currentUserRecipes;

    // Apply visibility filter
    if (currentVisibilityFilter === 'public') {
        filtered = filtered.filter(r => r.visibility !== 'private');
    } else if (currentVisibilityFilter === 'private') {
        filtered = filtered.filter(r => r.visibility === 'private');
    }

    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(recipe => {
            const name = recipe.name.toLowerCase();
            const category = recipe.category.toLowerCase();
            const ingredients = recipe.ingredients.toLowerCase();

            return name.includes(searchTerm) ||
                category.includes(searchTerm) ||
                ingredients.includes(searchTerm);
        });
    }

    renderRecipes(filtered);
}

async function updateSidebarBalance() {
    const sidebarBalance = document.getElementById('sidebarBalance');
    if (!sidebarBalance) return;

    const token = sessionStorage.getItem('authToken');
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/wallet/balance`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            sidebarBalance.textContent = parseFloat(data.balance).toFixed(2);
        }
    } catch (err) {
        console.error('Error fetching sidebar balance:', err);
    }
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
        let url = `${API_URL}/recipes`;
        let method = 'POST';

        if (editingRecipeId) {
            url = `${API_URL}/recipes/${editingRecipeId}`;
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

        // Reload recipes
        await loadRecipes();

    } catch (error) {
        console.error('Error saving recipe:', error);
        showNotification(error.message || '❌ Error saving recipe.', 'error');
    }
}

// Load Home Feed (Public Recipes)
async function loadHomeFeed() {
    const homeGrid = document.getElementById('homeGrid');
    const homeEmpty = document.getElementById('homeEmptyState');
    if (!homeGrid || !homeEmpty) return;

    homeGrid.innerHTML = '<div class="loading" style="padding: 20px; text-align: center;">Loading community recipes...</div>';

    try {
        console.log('Fetching public recipes from:', `${API_URL}/recipes/public`);
        const response = await fetch(`${API_URL}/recipes/public`);

        if (!response.ok) {
            console.error('Home feed response error:', response.status);
            throw new Error('Failed to load home feed');
        }

        const result = await response.json();
        console.log('Public recipes count:', result.length);

        // Show all public recipes in the community feed
        const publicPosts = Array.isArray(result) ? result : [];

        homeGrid.innerHTML = '';
        if (publicPosts.length === 0) {
            console.log('No public posts to show.');
            homeEmpty.classList.add('show');
            homeGrid.style.display = 'none';
        } else {
            console.log('Rendering', publicPosts.length, 'posts...');
            homeEmpty.classList.remove('show');
            homeGrid.style.display = 'grid';

            publicPosts.forEach(item => {
                try {
                    const card = createPostCard(item);
                    if (card) homeGrid.appendChild(card);
                } catch (cardErr) {
                    console.error('Error rendering individual post:', item.id, cardErr);
                }
            });
        }
    } catch (error) {
        console.error('Error in loadHomeFeed:', error);
        homeGrid.innerHTML = '';
        homeEmpty.classList.add('show');
        homeGrid.style.display = 'none';
    }
}

// Load Recipes
async function loadRecipes() {
    recipesGrid.innerHTML = '<div class="loading">Loading recipes...</div>';

    try {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/recipes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load recipes');

        const result = await response.json();
        currentUserRecipes = Array.isArray(result) ? result : [];

        // Apply current visibility filter
        const searchTerm = recipeSearch ? recipeSearch.value.toLowerCase().trim() : '';
        filterRecipes(searchTerm);

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
        } else if (currentVisibilityFilter === 'public') {
            emptyState.querySelector('.empty-icon').textContent = '🌍';
            emptyState.querySelector('h3').textContent = 'No public recipes';
            emptyState.querySelector('p').textContent = 'You haven\'t made any recipes public yet. Use the toggle on a recipe card to share it!';
        } else if (currentVisibilityFilter === 'private') {
            emptyState.querySelector('.empty-icon').textContent = '🔒';
            emptyState.querySelector('h3').textContent = 'No private recipes';
            emptyState.querySelector('p').textContent = 'All your recipes are currently public!';
        } else {
            emptyState.querySelector('.empty-icon').textContent = '📖';
            emptyState.querySelector('h3').textContent = 'Your Chef Book is empty';
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

        const response = await fetch(`${API_URL}/users/public`);
        let chefs = response.ok ? await response.json() : [];

        if (!Array.isArray(chefs)) chefs = [];

        // Filter out admins
        chefs = chefs.filter(c => c.username !== 'admin' && c.isPublic !== false);

        // Search logic
        if (searchInput && searchInput.value.trim()) {
            const term = searchInput.value.toLowerCase().trim();
            chefs = chefs.filter(c =>
                c.displayName.toLowerCase().includes(term) ||
                c.username.toLowerCase().includes(term)
            );
        }

        if (chefs.length === 0) {
            empty.classList.add('show');
            grid.style.display = 'none';
            empty.style.display = 'block';
        } else {
            empty.classList.remove('show');
            empty.style.display = 'none';
            grid.style.display = 'grid';
            grid.innerHTML = '';

            // Fetch public recipes counts
            const pubResponse = await fetch(`${API_URL}/recipes/public`);
            const publicRecipesResult = pubResponse.ok ? await pubResponse.json() : [];
            const publicRecipes = Array.isArray(publicRecipesResult) ? publicRecipesResult : [];

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

    // Add click event for "View Profile" to redirect to chef profile page
    const viewBtn = card.querySelector('.view-chef-recipes');
    viewBtn.onclick = (e) => {
        e.stopPropagation();
        window.location.href = `chef-profile.html?username=${chef.username}`;
    };

    // Make whole card clickable too
    card.onclick = () => {
        window.location.href = `chef-profile.html?username=${chef.username}`;
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
        const response = await fetch('/api/recipes/public', {
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
                        <button class="btn-view-chef-recipe">View Post</button>
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

// Create Post Card (Text-only social post) - Moved to social-ui.js

// Moved formatTimeAgo to social-ui.js

// Create Recipe Card (User's)
function createRecipeCard(recipe, isPublicFeed = false) {
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

    let toggleHtml = '';
    if (!isPublicFeed) {
        toggleHtml = `
        <div class="recipe-toggle-container">
            <label class="switch">
                <input type="checkbox" class="recipe-privacy-toggle" data-id="${recipe.id}" ${recipe.visibility === 'private' ? 'checked' : ''}>
                <span class="slider round"></span>
            </label>
            <span class="toggle-status-label" style="color: white; font-size: 0.8rem; font-weight: bold; margin-left: 5px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">
                ${recipe.visibility === 'private' ? 'Private 🔒' : 'Public 🌍'}
            </span>
        </div>`;
    }

    // Author handling for public feed
    let authorName = 'Chef';
    if (recipe.author?.name) {
        authorName = recipe.author.name;
    } else if (recipe.authorName) {
        authorName = recipe.authorName;
    }

    const authorHtml = isPublicFeed ? `<p class="author-name" style="font-size: 0.8rem; color: #ccc; margin: 0 0 5px 0;">By: ${authorName}</p>` : '';

    card.innerHTML = `
        <div class="recipe-card-image">
            ${photoDisplay}
            ${recipe.video ? `<div class="recipe-video-badge" style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 20px; font-size: 0.7rem; display: flex; align-items: center; gap: 4px; z-index: 5; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.2);">📽️ Video</div>` : ''}
        </div>

        ${toggleHtml}

        <div class="public-card-overlay">
            <h3 class="recipe-title">${recipe.name}</h3>
            ${authorHtml}
            <div class="recipe-meta">
                <span>⏱️ ${totalTime} min</span>
                <span>👥 ${recipe.servings}</span>
                <span>${difficultyText}</span>
            </div>

            <div class="overlay-actions">
                <button class="btn-overlay-action" data-action="view" title="View Post">👁️</button>
                <button class="btn-overlay-action" data-action="menu" title="Add to Menu">📅</button>
                <button class="btn-overlay-action" data-action="share" title="Share Recipe">🔗</button>
                <button class="btn-overlay-action" data-action="pdf" title="Save PDF">📄</button>
                ${!isPublicFeed ? `<button class="btn-overlay-action btn-delete" data-action="delete" title="Delete Recipe">🗑️</button>` : ''}
            </div>
        </div>
    `;

    // Add event listeners
    card.querySelector('[data-action="view"]').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        viewRecipe(recipe, isPublicFeed);
    });
    card.querySelector('[data-action="menu"]').addEventListener('click', (e) => {
        e.stopPropagation();
        openDayPickerModal(recipe);
    });
    card.querySelector('[data-action="pdf"]').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click if any
        saveRecipeAsPdf(recipe);
    });
    card.querySelector('[data-action="share"]').addEventListener('click', (e) => {
        e.stopPropagation();
        handleShareRecipe(recipe);
    });

    if (!isPublicFeed) {
        card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteRecipe(recipe.id);
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
                const response = await fetch(`${API_URL}/recipes/${recipe.id}`, {
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
    }

    return card;
}



// Helper Functions
// getCategoryEmoji and getDifficultyText moved to recipe-utils.js

// Handle Share Recipe
async function handleShareRecipe(recipe) {
    if (!recipe) return;
    
    // Construct the direct link to this recipe
    const username = recipe.author?.username || recipe.authorUsername || getCurrentUser();
    const url = `${window.location.origin}/chef-profile.html?username=${username}&post=${recipe.id}`;
    const token = sessionStorage.getItem('authToken');

    // Choice for logged in users
    if (token) {
        const choice = confirm(`How would you like to share "${recipe.name}"?\n\nOK: Reshare to your Feed\nCancel: Copy Link / External Share`);
        if (choice) {
            if (typeof sharePost === 'function') {
                return sharePost(recipe.id);
            }
        }
    }

    // External Share / Copy Link
    if (navigator.share) {
        navigator.share({
            title: `Chef Book: ${recipe.name}`,
            text: `Check out this amazing ${recipe.name} recipe on Chef Book!`,
            url: url
        }).catch((error) => {
            console.error('Error sharing:', error);
        });
    } else {
        try {
            await navigator.clipboard.writeText(url);
            showNotification('📋 Recipe link copied to clipboard!', 'success');
        } catch (err) {
            const dummy = document.createElement('input');
            document.body.appendChild(dummy);
            dummy.value = url;
            dummy.select();
            document.execCommand('copy');
            document.body.removeChild(dummy);
            showNotification('📋 Recipe link copied to clipboard!', 'success');
        }
    }
}

function viewRecipe(idOrRecipe, isPublic = false) {
    let recipe;

    if (typeof idOrRecipe === 'object') {
        recipe = idOrRecipe;
    } else {
        recipe = currentUserRecipes.find(r => r.id === idOrRecipe);
    }

    const isReshare = !!recipe.sharedFrom;
    const source = isReshare ? recipe.sharedFrom : recipe;

    const categoryEmoji = getCategoryEmoji(source.category || recipe.category);
    const difficultyText = getDifficultyText(source.difficulty || recipe.difficulty);
    const totalTime = (source.prepTime || 0) + (source.cookTime || 0);

    // Auth info for comments actions
    let currentUserId = null;
    const token = sessionStorage.getItem('authToken');
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            currentUserId = payload.userId;
        } catch (e) { }
    }

    const commentsList = Array.isArray(recipe.comments) ? recipe.comments : [];
    const commentsHtml = renderCommentsList(commentsList, recipe.author?.userId, currentUserId);

    modalBody.innerHTML = `
        <div class="modal-recipe-image">
            ${source.photo
            ? `<img src="${source.photo}" alt="${source.name}">`
            : `<span class="placeholder-icon">${categoryEmoji}</span>`}
        </div>
        <div class="modal-header-actions" style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
           <div class="reshare-badge-container">
               ${isReshare ? `<span style="background: rgba(255,107,138,0.1); color: var(--accent-pink); padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">🔁 Shared from ${source.author?.name || source.authorUsername || 'another chef'}</span>` : ''}
           </div>
           <div style="display: flex; gap: 8px;">
               <button class="btn btn-secondary" id="modalShareRecipe" style="padding: 0.5rem 1rem; font-size: 0.9rem; border-radius: 12px; display: flex; align-items: center; gap: 5px;">
                    <span>🔗</span> Share
               </button>
               ${!isPublic ? `<button class="btn btn-primary" id="modalSavePdf" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                    <span class="btn-icon">📄</span> Save as PDF
               </button>` : ''}
           </div>
        </div>
        <h2 class="modal-recipe-title">${source.name || recipe.name}</h2>
        ${isReshare && recipe.instructions && recipe.instructions !== 'Shared this post!' ? `
            <div class="reshare-notes" style="margin-bottom: 20px; padding: 12px 15px; background: rgba(255,255,255,0.03); border-left: 3px solid var(--accent-pink); border-radius: 8px;">
                <strong style="display: block; font-size: 0.8rem; color: var(--accent-pink); margin-bottom: 5px;">${recipe.author?.name || 'Chef'}'s Notes:</strong>
                <p style="margin: 0; font-size: 0.95rem; font-style: italic;">${recipe.instructions}</p>
            </div>
        ` : ''}
        
        <div class="modal-recipe-meta">
            <div class="meta-item">
                <span class="meta-icon">📁</span>
                ${source.category || recipe.category}
            </div>
            <div class="meta-item">
                <span class="meta-icon">⏱️</span>
                Prep: ${source.prepTime || 0} min
            </div>
            <div class="meta-item">
                <span class="meta-icon">🔥</span>
                Cook: ${source.cookTime || 0} min
            </div>
            <div class="meta-item">
                <span class="meta-icon">👥</span>
                ${source.servings || 0} servings
            </div>
            <div class="meta-item">
                ${difficultyText}
            </div>
        </div>
        
        ${(source.ingredients && source.ingredients !== 'N/A') ? `
        <div class="modal-section">
            <h3>🥄 Ingredients</h3>
            <ul>
                ${source.ingredients.split('\n').filter(i => i.trim()).map(i => `<li>${i}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        
        ${(source.instructions && source.instructions !== 'Shared this post!') ? `
        <div class="modal-section">
            <h3>📝 Instructions</h3>
            <ol>
                ${source.instructions.split('\n').filter(i => i.trim()).map(i => `<li>${i.replace(/^\d+\.\s*/, '')}</li>`).join('')}
            </ol>
        </div>
        ` : ''}
        
        ${source.video ? `
            <div class="modal-section modal-video">
                <h3>📹 ${t('recipeVideo')}</h3>
                <video src="${source.video}" controls style="width: 100%; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);"></video>
            </div>
        ` : ''}
        
        ${source.notes ? `
            <div class="modal-section modal-notes">
                <h3>💡 Original Chef's Notes</h3>
                <p>${source.notes}</p>
            </div>
        ` : ''}

        <!-- Comments Section -->
        <div class="modal-section modal-comments-section" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; margin-top: 30px;">
            <h3>💬 Comments (<span class="modal-comments-count">${commentsList.length}</span>)</h3>
            <div class="modal-comments-list" style="margin-top: 15px;">
                ${commentsHtml}
            </div>
            
            ${isPublic ? `
            <form class="modal-comment-form" style="display: flex; gap: 8px; margin-top: 20px; padding-top: 15px; border-top: 1px dotted rgba(255,255,255,0.1);">
                <input type="text" class="modal-comment-input" placeholder="Write a comment..." required style="flex: 1; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 8px 15px; color: white; font-size: 0.9rem; outline: none;">
                <button type="submit" class="btn btn-primary" style="padding: 6px 15px; border-radius: 20px; font-size: 0.85rem;">Post</button>
            </form>
            ` : ''}
        </div>
    `;

    // Add event listener for the modal PDF button
    const savePdfBtn = document.getElementById('modalSavePdf');
    if (savePdfBtn) {
        savePdfBtn.addEventListener('click', () => saveRecipeAsPdf(recipe));
    }

    // Add event listener for modal share button
    const modalShareBtn = document.getElementById('modalShareRecipe');
    if (modalShareBtn) {
        modalShareBtn.addEventListener('click', () => handleShareRecipe(recipe));
    }

    // Comment Submission in modal
    const modalCommentForm = modalBody.querySelector('.modal-comment-form');
    if (modalCommentForm) {
        modalCommentForm.onsubmit = async (e) => {
            e.preventDefault();
            const input = modalCommentForm.querySelector('.modal-comment-input');
            const text = input.value.trim();
            if (!text) return;

            const submitBtn = modalCommentForm.querySelector('button');
            submitBtn.disabled = true;

            try {
                const response = await fetch(`${API_URL}/recipes/${recipe.id}/comment`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ text })
                });

                if (response.ok) {
                    const data = await response.json();
                    input.value = '';

                    // Add to UI manually or reload modal? Let's add manually for best UX
                    const commentsListEl = modalBody.querySelector('.modal-comments-list');
                    const countSpan = modalBody.querySelector('.modal-comments-count');

                    if (commentsListEl) {
                        // If it said "No comments yet", clear it
                        if (commentsListEl.textContent.trim() === 'No comments yet.') {
                            commentsListEl.innerHTML = '';
                        }

                        const commentHtml = `
                            <div class="post-comment" id="comment-${data.comment.id}" style="display: flex; gap: 10px; margin-top: 10px; font-size: 0.85rem;">
                                <img src="${data.comment.authorPic}" alt="${data.comment.authorName}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=${data.comment.authorName}&background=random'">
                                <div style="background: rgba(255,255,255,0.05); padding: 5px 10px; border-radius: 12px; flex: 1;">
                                    <strong style="color: var(--accent-pink);">${data.comment.authorName}</strong>
                                    <span class="comment-text" style="display: block; margin-top: 2px;">${text}</span>
                                    <div style="margin-top: 4px; font-size: 0.75rem; display: flex; align-items: center; gap: 10px;">
                                        <a href="#" class="like-comment-btn" data-id="${data.comment.id}" style="color: #aaa; text-decoration: none;">🤍 Like</a>
                                        <a href="#" class="edit-comment-btn" data-id="${data.comment.id}" style="color: #aaa; text-decoration: none;">Edit</a>
                                        <a href="#" class="del-comment-btn" data-id="${data.comment.id}" style="color: #ff6b6b; text-decoration: none;">Delete</a>
                                    </div>
                                </div>
                            </div>
                        `;
                        commentsListEl.innerHTML += commentHtml;
                    }

                    if (countSpan) {
                        countSpan.textContent = parseInt(countSpan.textContent) + 1;
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                submitBtn.disabled = false;
            }
        };
    }

    // Modal Comment Actions Delegation
    const modalCommentsList = modalBody.querySelector('.modal-comments-list');
    if (modalCommentsList) {
        modalCommentsList.onsubmit = (e) => {
            const replyForm = e.target.closest('.reply-form');
            if (replyForm) {
                e.preventDefault();
                const parentId = replyForm.dataset.parentId;
                const input = replyForm.querySelector('.reply-input');
                const text = input ? input.value.trim() : '';
                if (text) {
                    submitComment(recipe.id, text, modalBody, parentId);
                    input.value = '';
                    replyForm.style.display = 'none';
                }
            }
        };

        modalCommentsList.onclick = (e) => {
            const editBtn = e.target.closest('.edit-comment-btn');
            const delBtn = e.target.closest('.del-comment-btn');
            const likeBtn = e.target.closest('.like-comment-btn');
            const replyBtn = e.target.closest('.reply-comment-btn');
            const countSpan = modalBody.querySelector('.modal-comments-count');

            if (replyBtn) {
                e.preventDefault();
                const wrapper = e.target.closest('.post-comment-wrapper');
                const form = wrapper ? wrapper.querySelector('.reply-form') : null;
                if (form) {
                    form.style.display = form.style.display === 'none' ? 'block' : 'none';
                    if (form.style.display === 'block') {
                        const input = form.querySelector('.reply-input');
                        if (input) input.focus();
                    }
                }
            }

            if (likeBtn) {
                e.preventDefault();
                const commentId = likeBtn.dataset.id;
                if (commentId && typeof window.toggleCommentLike === 'function') {
                    window.toggleCommentLike(commentId, likeBtn);
                }
            }

            if (editBtn) {
                e.preventDefault();
                const commentId = editBtn.dataset.id;
                const commentEl = editBtn.closest('.post-comment');
                const textEl = commentEl ? commentEl.querySelector('.comment-text') : null;
                if (commentId && textEl) editPostComment(commentId, recipe.id, textEl);
            }

            if (delBtn) {
                e.preventDefault();
                const commentId = delBtn.dataset.id;
                const commentEl = delBtn.closest('.post-comment');
                if (commentId && commentEl) deletePostComment(commentId, recipe.id, commentEl, countSpan);
            }
        };
    }

    modal.classList.add('show');
}

// Expose to window for social-ui.js
window.viewRecipe = viewRecipe;

// Delete Recipe
async function deleteRecipe(id) {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/recipes/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete');

        showNotification('Post deleted!', 'success');
        await loadRecipes(); // Reload from server
        if (document.getElementById('home').classList.contains('active')) {
            await loadHomeFeed();
        }

    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Failed to delete post', 'error');
    }
}

// Social Logic
async function toggleLike(id, countSpan, likeBtn) {
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('❌ Please log in to like posts.', 'error');
            return;
        }

        const response = await fetch(`${API_URL}/recipes/${id}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            let count = parseInt(countSpan.textContent);
            if (likeBtn.classList.contains('liked')) {
                likeBtn.classList.remove('liked');
                count--;
            } else {
                likeBtn.classList.add('liked');
                count++;
            }
            countSpan.textContent = count;
        }
    } catch (err) {
        console.error('Like error:', err);
    }
}

async function submitComment(id, text, card, parentId = null) {
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('❌ Please log in to comment.', 'error');
            return;
        }

        const response = await fetch(`${API_URL}/recipes/${id}/comment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text, parentId })
        });

        if (response.ok) {
            const data = await response.json();
            const commentsList = card.querySelector('.comments-list') || card.querySelector('.modal-comments-list');
            const countSpan = card.querySelector('.comments-count') || card.querySelector('.modal-comments-count');

            if (commentsList) {
                // Remove "No comments yet" if present
                if (commentsList.textContent.trim() === 'No comments yet.') {
                    commentsList.innerHTML = '';
                }

                const isReply = !!parentId;
                const commentHtml = `
                    <div class="post-comment-wrapper" id="comment-wrapper-${data.comment.id}">
                        <div class="post-comment" id="comment-${data.comment.id}" style="display: flex; gap: 10px; margin-top: 10px; font-size: 0.85rem;">
                            <img src="${data.comment.authorPic}" alt="${data.comment.authorName}" style="width: ${isReply ? '20px' : '24px'}; height: ${isReply ? '20px' : '24px'}; border-radius: 50%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=${data.comment.authorName}&background=random'">
                            <div style="background: rgba(255,255,255,0.05); padding: 5px 10px; border-radius: 12px; flex: 1;">
                                <strong style="color: var(--accent-pink);">${data.comment.authorName}</strong>
                                <span class="comment-text" style="display: block; margin-top: 2px;">${text}</span>
                                <div style="margin-top: 4px; font-size: 0.75rem; display: flex; align-items: center; gap: 10px;">
                                    <a href="#" class="like-comment-btn" data-id="${data.comment.id}" style="color: #aaa; text-decoration: none;">🤍 Like</a>
                                    <a href="#" class="reply-comment-btn" data-id="${data.comment.id}" style="color: #aaa; text-decoration: none;">Reply</a>
                                    <a href="#" class="edit-comment-btn" data-id="${data.comment.id}" style="color: #aaa; text-decoration: none;">Edit</a>
                                    <a href="#" class="del-comment-btn" data-id="${data.comment.id}" style="color: #ff6b6b; text-decoration: none;">Delete</a>
                                </div>
                            </div>
                        </div>
                        <form class="reply-form" data-parent-id="${data.comment.id}" style="display: none; margin-left: 34px; margin-top: 8px;">
                            <input type="text" class="reply-input" placeholder="Write a reply..." required style="width: 100%; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 4px 12px; color: white; font-size: 0.8rem; outline: none;">
                        </form>
                    </div>
                `;

                if (isReply) {
                    const parentWrapper = commentsList.querySelector(`#comment-wrapper-${parentId}`);
                    if (parentWrapper) {
                        let repliesContainer = parentWrapper.querySelector('.replies-container');
                        if (!repliesContainer) {
                            repliesContainer = document.createElement('div');
                            repliesContainer.className = 'replies-container';
                            repliesContainer.style.marginLeft = '20px';
                            repliesContainer.style.borderLeft = '1px solid rgba(255,255,255,0.05)';
                            repliesContainer.style.paddingLeft = '10px';
                            parentWrapper.appendChild(repliesContainer);
                        }
                        const temp = document.createElement('div');
                        temp.innerHTML = commentHtml;
                        repliesContainer.appendChild(temp.firstElementChild);
                    }
                } else {
                    const temp = document.createElement('div');
                    temp.innerHTML = commentHtml;
                    commentsList.appendChild(temp.firstElementChild);
                }
            }

            if (countSpan) {
                countSpan.textContent = parseInt(countSpan.textContent) + 1;
                // Also ensure section is visible
                const section = card.querySelector('.post-comments-section');
                if (section) section.style.display = 'block';
            }
        }
    } catch (err) {
        console.error('Comment error:', err);
    }
}

async function sharePost(id, initialNotes = '') {
    // Premium feel: ask for notes
    const notes = prompt('Add a note to your share? (Optional)', initialNotes);
    if (notes === null) return; // Cancelled

    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            showNotification('❌ Please log in to share.', 'error');
            return;
        }

        const response = await fetch(`${API_URL}/recipes/${id}/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ notes })
        });

        if (response.ok) {
            showNotification('✅ Post shared to your feed!', 'success');
            // Immediate UI feedback: if on home feed, reload it
            if (document.getElementById('home').classList.contains('active')) {
                await loadHomeFeed();
            }
        } else {
            const data = await response.json();
            showNotification(data.error || '❌ Failed to share post', 'error');
        }
    } catch (err) {
        console.error('Share error:', err);
        showNotification('❌ Connection error. Please try again.', 'error');
    }
}

async function toggleCommentLike(commentId, likeBtn) {
    if (!isLoggedIn()) {
        showNotification('Please login to like comments', 'error');
        return;
    }

    try {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/recipes/comments/${commentId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to toggle like');

        const data = await response.json();

        // Update UI
        if (data.liked) {
            likeBtn.innerHTML = `❤️ Liked ${data.count > 0 ? `<span class="comment-likes-count">(${data.count})</span>` : ''}`;
            likeBtn.style.color = 'var(--accent-pink)';
            likeBtn.style.fontWeight = '700';
        } else {
            likeBtn.innerHTML = `🤍 Like ${data.count > 0 ? `<span class="comment-likes-count">(${data.count})</span>` : ''}`;
            likeBtn.style.color = '#aaa';
            likeBtn.style.fontWeight = '400';
        }

    } catch (error) {
        console.error('Like comment error:', error);
    }
}

// Global exposure
window.toggleCommentLike = toggleCommentLike;

async function deletePostComment(commentId, recipeId, commentEl, countSpan) {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/recipes/comments/${commentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showNotification('Comment deleted!', 'success');
            if (commentEl) commentEl.remove();
            if (countSpan) {
                let count = parseInt(countSpan.textContent) || 0;
                if (count > 0) countSpan.textContent = count - 1;
            }
        } else {
            throw new Error('Failed to delete comment');
        }
    } catch (err) {
        console.error('Delete comment error:', err);
        showNotification('❌ Failed to delete comment', 'error');
    }
}

async function editPostComment(commentId, recipeId, textEl) {
    const oldText = textEl.textContent.trim();
    const newText = prompt('Edit your comment:', oldText);

    if (newText === null || newText === oldText || !newText.trim()) return;

    try {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/recipes/comments/${commentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text: newText.trim() })
        });

        if (response.ok) {
            textEl.textContent = newText.trim();
            showNotification('Comment updated!', 'success');
        } else {
            throw new Error('Failed to update comment');
        }
    } catch (err) {
        console.error('Update comment error:', err);
        showNotification('❌ Failed to update comment', 'error');
    }
}

// Edit Post/Recipe
async function editPost(id) {
    try {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/recipes/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch details');
        const recipe = await response.json();

        // Fill form fields
        const nameInput = document.getElementById('addRecipeName');
        const categoryInput = document.getElementById('addRecipeCategory');
        const prepInput = document.getElementById('addPrepTime');
        const cookInput = document.getElementById('addCookTime');
        const ingredientsInput = document.getElementById('addRecipeIngredients');
        const instructionsInput = document.getElementById('addRecipeInstructions');
        const notesInput = document.getElementById('addRecipeNotes');
        const isPublicCheckbox = document.getElementById('addRecipeIsPublic');

        if (nameInput) nameInput.value = recipe.name || '';
        if (categoryInput) categoryInput.value = recipe.category || '';
        if (prepInput) prepInput.value = recipe.prepTime || 0;
        if (cookInput) cookInput.value = recipe.cookTime || 0;
        if (ingredientsInput) ingredientsInput.value = recipe.ingredients || '';
        if (instructionsInput) instructionsInput.value = recipe.instructions || '';
        if (notesInput) notesInput.value = recipe.notes || '';
        if (isPublicCheckbox) isPublicCheckbox.checked = (recipe.visibility === 'public');

        // Photo
        const addRecipePreview = document.getElementById('addRecipePreview');
        const addUploadPlaceholder = document.getElementById('addUploadPlaceholder');
        if (recipe.photo) {
            addRecipePhoto = recipe.photo;
            if (addRecipePreview) {
                addRecipePreview.src = recipe.photo;
                addRecipePreview.style.display = 'block';
            }
            if (addUploadPlaceholder) addUploadPlaceholder.style.display = 'none';
        } else {
            addRecipePhoto = null;
            if (addRecipePreview) addRecipePreview.style.display = 'none';
            if (addUploadPlaceholder) addUploadPlaceholder.style.display = 'block';
        }

        // Video
        const addRecipeVideoPreview = document.getElementById('addRecipeVideoPreview');
        const addVideoUploadPlaceholder = document.getElementById('addVideoUploadPlaceholder');
        if (recipe.video) {
            addRecipeVideo = recipe.video;
            if (addRecipeVideoPreview) {
                addRecipeVideoPreview.src = recipe.video;
                addRecipeVideoPreview.style.display = 'block';
            }
            if (addVideoUploadPlaceholder) addVideoUploadPlaceholder.style.display = 'none';
        } else {
            addRecipeVideo = null;
            if (addRecipeVideoPreview) addRecipeVideoPreview.style.display = 'none';
            if (addVideoUploadPlaceholder) addVideoUploadPlaceholder.style.display = 'block';
        }

        // Difficulty buttons
        const diffBtns = document.querySelectorAll('#addRecipeModal .diff-btn');
        const diffInput = document.getElementById('addRecipeDifficulty');
        diffBtns.forEach(btn => {
            btn.classList.remove('active');
            if (recipe.difficulty && btn.getAttribute('data-value').toLowerCase() === recipe.difficulty.toLowerCase()) {
                btn.classList.add('active');
                if (diffInput) diffInput.value = btn.getAttribute('data-value');
            }
        });

        // Set global edit state
        editingRecipeId = id;

        // Change Modal title and button text
        document.querySelector('#addRecipeModal h2 span').textContent = 'Edit Post';
        const submitBtn = document.querySelector('#addRecipeForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.querySelector('span:not(.btn-icon)').textContent = 'Update Post';
        }

        // Show modal
        const addRecipeModal = document.getElementById('addRecipeModal');
        if (addRecipeModal) addRecipeModal.style.display = 'flex';

    } catch (err) {
        console.error('Edit error:', err);
        showNotification('❌ Error loading post details', 'error');
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
    doc.text('Chef Book', 105, 120, { align: 'center' });

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
    showNotification('PDF Chef Book saved to your PC! 📄', 'success');
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
        const response = await fetch(`${API_URL}/recipes`, {
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
                'Download your entire Chef Book',
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
        <div class="modal-content premium-profile-modal">
            <button class="modal-close" id="closePremiumProfileModal" style="z-index: 10; background: rgba(0,0,0,0.5); color: white; border-radius: 50%; width: 32px; height: 32px;">&times;</button>
            
            <div class="premium-card-banner" id="premiumCardPhotoTrigger">
                <img id="premiumCardPhoto" src="${user.profilePicture || 'https://images.unsplash.com/photo-1574359411659-15573a27f812?q=80&w=800'}" alt="Chef">
                <div class="change-overlay">📷</div>
            </div>

            <input type="file" id="premiumPhotoInput" accept="image/*" style="display: none;">

            <div class="premium-card-info">
                <h1 class="premium-card-name">${user.displayName}</h1>
                
                <div class="premium-details-list">
                    <div class="premium-detail-row">
                        <span class="premium-detail-icon">💎</span>
                        <span>UPGRADE MEMBER</span>
                    </div>
                    <div class="premium-detail-row">
                        <span class="premium-detail-icon">📧</span>
                        <span>Email ${user.email || 'N/A'}</span>
                    </div>
                    <div class="premium-detail-row">
                        <span class="premium-detail-icon">📅</span>
                        <span>Plan ${subStatus.plan ? subStatus.plan.toUpperCase() : 'PREMIUM'}</span>
                    </div>
                    <div class="premium-detail-row">
                        <span class="premium-detail-icon">⏳</span>
                        <span>Expires ${expiryText}</span>
                    </div>
                </div>

                <button class="btn-manage-sub" onclick="window.location.href='./payment.html'">
                    ⚙️ Manage Subscription
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('closePremiumProfileModal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Photo Change Handling
    const photoTrigger = document.getElementById('premiumCardPhotoTrigger');
    const photoInput = document.getElementById('premiumPhotoInput');
    const photoImg = document.getElementById('premiumCardPhoto');

    if (photoTrigger && photoInput) {
        photoTrigger.onclick = () => photoInput.click();

        photoInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const imageData = event.target.result;
                    photoImg.src = imageData;

                    // Update user profile photo
                    try {
                        const token = sessionStorage.getItem('authToken');
                        const response = await fetch(`${API_URL}/users/profile`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ profilePicture: imageData })
                        });

                        if (response.ok) {
                            showNotification('✅ Profile photo updated! 🧁', 'success');
                            // Update sidebar too
                            const sidebarPic = document.getElementById('userProfilePic');
                            if (sidebarPic) sidebarPic.src = imageData;

                            // Refresh users in local cache
                            if (typeof loadUsers === 'function') loadUsers();
                        } else {
                            throw new Error('Failed to update photo');
                        }
                    } catch (err) {
                        console.error(err);
                        showNotification('❌ Error updating photo.', 'error');
                    }
                };
                reader.readAsDataURL(file);
            }
        };
    }
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
        const pubResponse = await fetch(`${API_URL}/users/public`);
        if (pubResponse.ok) {
            const allProfiles = await pubResponse.json();

            // Re-fetch all public recipes to update recipe counts
            const recipesResponse = await fetch(`${API_URL}/recipes/public`);
            const allPublicRecipesResult = recipesResponse.ok ? await recipesResponse.json() : [];
            const allPublicRecipes = Array.isArray(allPublicRecipesResult) ? allPublicRecipesResult : [];

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

// ===== TRENDING CAROUSEL (Dynamic from Store) =====

// Category emoji map for trending card fallback backgrounds
const categoryEmojiMap = {
    'Cakes': '🎂', 'Cookies': '🍪', 'Pastries': '🥐', 'Pies & Tarts': '🥧',
    'Breads': '🍞', 'Desserts': '🍰', 'Chocolates': '🍫', 'Other': '✨'
};

// Gradient color palette for trending cards (keeps it visually diverse)
const trendingGradients = [
    'linear-gradient(135deg, #0f0c1b, #FF0076)',
    'linear-gradient(135deg, #231937, #9D00FF)',
    'linear-gradient(135deg, #0f0c1b, #590FB7)',
    'linear-gradient(135deg, #1a1025, #FF6B8A)',
    'linear-gradient(135deg, #0d1b2a, #1B98E0)',
    'linear-gradient(135deg, #1a0f2e, #E040FB)',
    'linear-gradient(135deg, #0f2027, #2C5364)',
    'linear-gradient(135deg, #141E30, #243B55)',
];

// Tag labels for variety
const trendingTags = ['New', 'Store', 'Featured', 'Popular', 'Top Pick', 'Hot', 'Chef Pick', 'Trending'];

/**
 * Loads store recipes and displays random ones in the trending carousel.
 * Called on page load and refreshes every time.
 */
async function loadTrendingCarousel() {
    const carousel = document.getElementById('trendingCarousel');
    const section = document.getElementById('trendingSection');
    if (!carousel) return;

    try {
        const response = await fetch(`${API_URL}/store`);
        if (!response.ok) throw new Error('Failed to fetch store recipes');
        const recipes = await response.json();

        carousel.innerHTML = '';

        if (!recipes || recipes.length === 0) {
            // Show a friendly empty state
            carousel.innerHTML = `
                <div class="trending-empty-state">
                    <div class="empty-emoji">🛒</div>
                    <h4>No store recipes yet</h4>
                    <p>Be the first to sell a recipe!</p>
                    <button class="btn btn-primary" onclick="document.querySelector('[data-tab=\\'store\\']')?.click()">
                        Browse Store
                    </button>
                </div>
            `;
            return;
        }

        // Shuffle recipes randomly using Fisher-Yates algorithm
        const shuffled = [...recipes];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Display up to 6 random recipes
        const displayCount = Math.min(shuffled.length, 6);
        for (let i = 0; i < displayCount; i++) {
            const recipe = shuffled[i];
            const card = createTrendingCard(recipe, i);
            carousel.appendChild(card);
        }

    } catch (error) {
        console.error('Load trending carousel error:', error);
        // Keep skeletons or show empty state on error
        carousel.innerHTML = `
            <div class="trending-empty-state">
                <div class="empty-emoji">🛒</div>
                <h4>No store recipes yet</h4>
                <p>Be the first to sell a recipe!</p>
                <button class="btn btn-primary" onclick="document.querySelector('[data-tab=\\'store\\']')?.click()">
                    Browse Store
                </button>
            </div>
        `;
    }
}

/**
 * Creates a single trending card element from a store recipe.
 */
function createTrendingCard(recipe, index) {
    const card = document.createElement('div');
    card.className = 'trending-card';
    card.style.animationDelay = `${index * 0.1}s`;

    const emoji = categoryEmojiMap[recipe.category] || '🧁';
    const gradient = trendingGradients[index % trendingGradients.length];
    const tag = trendingTags[index % trendingTags.length];
    const sellerAvatar = recipe.seller?.pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(recipe.seller?.name || 'Chef')}&background=random&size=44`;
    const sellerName = recipe.seller?.name || 'Chef';

    const imageSection = recipe.photo
        ? `<img class="trending-card-img" src="${recipe.photo}" alt="${recipe.name}">`
        : `<div class="card-bg-fallback" style="background: ${gradient}; display: flex; align-items:center; justify-content:center; font-size:4rem;">${emoji}</div>`;

    card.innerHTML = `
        ${imageSection}
        <div class="trending-overlay">
            <span class="trending-tag">${tag}</span>
            <h3>${recipe.name}</h3>
            <div class="trending-seller-info">
                <img src="${sellerAvatar}" alt="${sellerName}">
                <span>${sellerName}</span>
            </div>
            <div class="trending-footer">
                <span>${recipe.category || 'Recipe'}</span>
                <span class="trending-price">$${recipe.price.toFixed(2)}</span>
            </div>
        </div>
    `;

    // Click to view the recipe in the store
    card.addEventListener('click', () => {
        const storeTabBtn = document.querySelector('[data-tab="store"]');
        if (storeTabBtn) storeTabBtn.click();
        // Open the recipe after a small delay to let the tab switch
        setTimeout(() => {
            if (typeof viewStoreRecipe === 'function') viewStoreRecipe(recipe.id);
        }, 400);
    });

    return card;
}

// ===== STORE MARKETPLACE =====
let sellRecipePhoto = null;

function setupStoreListeners() {
    // Sell Recipe button
    const sellRecipeBtn = document.getElementById('sellRecipeBtn');
    const sellRecipeModal = document.getElementById('sellRecipeModal');
    const closeSellModal = document.getElementById('closeSellModal');
    const sellRecipeForm = document.getElementById('sellRecipeForm');

    if (sellRecipeBtn && sellRecipeModal) {
        sellRecipeBtn.addEventListener('click', () => {
            sellRecipeModal.classList.add('show');
        });
    }

    if (closeSellModal && sellRecipeModal) {
        closeSellModal.addEventListener('click', () => sellRecipeModal.classList.remove('show'));
        sellRecipeModal.addEventListener('click', (e) => {
            if (e.target === sellRecipeModal) sellRecipeModal.classList.remove('show');
        });
    }

    // Photo upload for sell form
    const sellPhotoUpload = document.getElementById('sellRecipeImageUpload');
    const sellPhotoInput = document.getElementById('sellRecipePhotoInput');
    const sellPhotoPreview = document.getElementById('sellRecipePhotoPreview');
    const sellPlaceholder = document.getElementById('sellUploadPlaceholder');

    if (sellPhotoUpload && sellPhotoInput) {
        sellPhotoUpload.addEventListener('click', () => sellPhotoInput.click());
        sellPhotoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    sellRecipePhoto = ev.target.result;
                    if (sellPhotoPreview) {
                        sellPhotoPreview.src = ev.target.result;
                        sellPhotoPreview.style.display = 'block';
                    }
                    if (sellPlaceholder) sellPlaceholder.style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Sell form submit
    if (sellRecipeForm) {
        sellRecipeForm.addEventListener('submit', handleSellRecipeSubmit);
    }

    // Purchase modal close
    const purchaseModal = document.getElementById('storePurchaseModal');
    const closePurchaseModal = document.getElementById('closePurchaseModal');
    if (closePurchaseModal && purchaseModal) {
        closePurchaseModal.addEventListener('click', () => purchaseModal.classList.remove('show'));
        purchaseModal.addEventListener('click', (e) => {
            if (e.target === purchaseModal) purchaseModal.classList.remove('show');
        });
    }

    // Recipe view modal close
    const viewModal = document.getElementById('storeRecipeViewModal');
    const closeView = document.getElementById('closeStoreRecipeView');
    if (closeView && viewModal) {
        closeView.addEventListener('click', () => viewModal.classList.remove('show'));
        viewModal.addEventListener('click', (e) => {
            if (e.target === viewModal) viewModal.classList.remove('show');
        });
    }

    // Store sub-tabs (Browse / My Listings / Purchased)
    const storeTabBtns = document.querySelectorAll('.store-tab-btn');
    storeTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            storeTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.dataset.storeTab;
            document.getElementById('storeGrid').style.display = tab === 'browse' ? 'grid' : 'none';
            document.getElementById('myListingsGrid').style.display = tab === 'my-listings' ? 'grid' : 'none';
            document.getElementById('purchasedGrid').style.display = tab === 'purchased' ? 'grid' : 'none';

            if (tab === 'browse') loadStoreRecipes();
            else if (tab === 'my-listings') loadMyListings();
            else if (tab === 'purchased') loadMyPurchases();
        });
    });

    // Store search
    const storeSearch = document.getElementById('storeSearch');
    if (storeSearch) {
        storeSearch.addEventListener('input', () => loadStoreRecipes());
    }
}

async function handleSellRecipeSubmit(e) {
    e.preventDefault();

    const token = sessionStorage.getItem('authToken');
    if (!token) { showNotification('❌ Please log in.', 'error'); return; }

    const data = {
        name: document.getElementById('sellRecipeName').value.trim(),
        description: document.getElementById('sellRecipeDesc').value.trim(),
        category: document.getElementById('sellRecipeCategory').value,
        price: parseFloat(document.getElementById('sellRecipePrice').value),
        photo: sellRecipePhoto,
        ingredients: document.getElementById('sellRecipeIngredients').value.trim(),
        instructions: document.getElementById('sellRecipeInstructions').value.trim(),
        notes: document.getElementById('sellRecipeNotes').value.trim()
    };

    if (!data.name || !data.price || data.price <= 0) {
        showNotification('❌ Name and valid price are required.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/store`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (response.ok) {
            showNotification('✅ Recipe listed in the store! 🏷️', 'success');
            document.getElementById('sellRecipeModal').classList.remove('show');
            document.getElementById('sellRecipeForm').reset();
            sellRecipePhoto = null;
            const preview = document.getElementById('sellRecipePhotoPreview');
            const placeholder = document.getElementById('sellUploadPlaceholder');
            if (preview) { preview.style.display = 'none'; preview.src = ''; }
            if (placeholder) placeholder.style.display = 'block';
            loadStoreRecipes();
        } else {
            showNotification(result.error || '❌ Failed to list recipe.', 'error');
        }
    } catch (err) {
        console.error('Sell recipe error:', err);
        showNotification('❌ Connection error.', 'error');
    }
}

async function loadStoreRecipes() {
    const grid = document.getElementById('storeGrid');
    const emptyState = document.getElementById('storeEmptyState');
    if (!grid) return;

    try {
        const response = await fetch(`${API_URL}/store`);
        const recipes = await response.json();

        const searchTerm = (document.getElementById('storeSearch')?.value || '').toLowerCase().trim();
        const filtered = searchTerm
            ? recipes.filter(r => r.name.toLowerCase().includes(searchTerm) || r.category.toLowerCase().includes(searchTerm))
            : recipes;

        grid.innerHTML = '';

        if (filtered.length === 0) {
            grid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
        } else {
            grid.style.display = 'grid';
            if (emptyState) emptyState.style.display = 'none';

            filtered.forEach(recipe => {
                const card = createStoreCard(recipe);
                grid.appendChild(card);
            });
        }
    } catch (err) {
        console.error('Load store error:', err);
    }
}

function createStoreCard(recipe) {
    const card = document.createElement('div');
    card.className = 'store-card';
    card.innerHTML = `
        <div class="store-card-image">
            ${recipe.photo
            ? `<img src="${recipe.photo}" alt="${recipe.name}" style="width: 100%; height: 180px; object-fit: cover;">`
            : `<div style="width: 100%; height: 180px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(255,107,138,0.15), rgba(255,154,86,0.15)); font-size: 3rem;">🧁</div>`
        }
            <div class="store-price-tag" onclick="event.stopPropagation(); viewStoreRecipe(${recipe.id})" style="cursor: pointer; transition: transform 0.3s ease;">$${recipe.price.toFixed(2)}</div>
        </div>
        <div class="store-card-body">
            <h3 class="store-card-title">${recipe.name}</h3>
            <div class="store-card-meta">
                <span class="store-card-category">${recipe.category}</span>
                <span class="store-card-seller">
                    <img src="${recipe.seller.pic || `https://ui-avatars.com/api/?name=${recipe.seller.name}&background=random`}" alt="" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover;">
                    ${recipe.seller.name}
                </span>
            </div>
            <button class="btn btn-primary store-view-btn" onclick="viewStoreRecipe(${recipe.id})" style="width: 100%; margin-top: 10px; padding: 8px; border-radius: 10px;">
                <span>👁️</span> View Recipe
            </button>
        </div>
    `;
    return card;
}

async function viewStoreRecipe(id) {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
        showNotification('❌ Please log in to view recipes.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/store/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (response.status === 403 && data.preview) {
            // Show purchase modal
            showPurchaseModal(data.recipe);
        } else if (response.ok) {
            // Show full recipe
            showFullStoreRecipe(data);
        } else {
            showNotification(data.error || '❌ Failed to load recipe.', 'error');
        }
    } catch (err) {
        console.error('View store recipe error:', err);
        showNotification('❌ Connection error.', 'error');
    }
}

function showPurchaseModal(recipe) {
    const modal = document.getElementById('storePurchaseModal');
    const body = document.getElementById('purchaseModalBody');
    if (!modal || !body) return;

    body.innerHTML = `
        <div style="padding: 20px;">
            ${recipe.photo
            ? `<img src="${recipe.photo}" alt="${recipe.name}" style="width: 100%; max-height: 220px; object-fit: cover; border-radius: 16px; margin-bottom: 20px;">`
            : `<div style="width: 100%; height: 180px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(255,107,138,0.1), rgba(255,154,86,0.1)); border-radius: 16px; font-size: 4rem; margin-bottom: 20px;">🔒</div>`
        }
            <h2 style="margin: 0 0 8px; font-size: 1.4rem;">${recipe.name}</h2>
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px;">
                <img src="${recipe.seller.pic || `https://ui-avatars.com/api/?name=${recipe.seller.name}&background=random`}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
                <span style="color: var(--text-secondary); font-size: 0.9rem;">by ${recipe.seller.name}</span>
            </div>
            <div id="priceBoxBtn" style="background: linear-gradient(135deg, rgba(255,107,138,0.1), rgba(255,154,86,0.1)); border: 1px solid rgba(255,107,138,0.3); border-radius: 16px; padding: 20px; margin-bottom: 20px; cursor: pointer; transition: all 0.3s ease; text-align: center;" onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 8px 20px rgba(255,107,138,0.15)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'">
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 4px;">Recipe Price</div>
                <div style="font-size: 2rem; font-weight: 800; background: linear-gradient(135deg, var(--accent-pink), var(--accent-orange)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">$${recipe.price.toFixed(2)}</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 12px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.05);">
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">🔒 Purchase this recipe to unlock the full ingredients, instructions, and chef's notes.</p>
            </div>
            <button class="btn btn-primary" id="confirmPurchaseBtn" data-recipe-id="${recipe.id}" style="width: 100%; padding: 14px; font-size: 1.1rem; border-radius: 14px; font-weight: 700;">
                💳 Purchase for $${recipe.price.toFixed(2)}
            </button>
        </div>
    `;

    modal.classList.add('show');

    // Attach purchase handlers
    document.getElementById('confirmPurchaseBtn').addEventListener('click', async () => {
        await purchaseRecipe(recipe.id);
    });
    document.getElementById('priceBoxBtn').addEventListener('click', async () => {
        await purchaseRecipe(recipe.id);
    });
}

async function purchaseRecipe(id) {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
        showNotification('❌ Please log in to purchase.', 'error');
        return;
    }

    const btn = document.getElementById('confirmPurchaseBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Redirecting to Payment...';
    }

    // Redirect to the centralized payment page with the recipe ID
    window.location.href = `./payment.html?recipeId=${id}`;
}


function showFullStoreRecipe(recipe) {
    const modal = document.getElementById('storeRecipeViewModal');
    const body = document.getElementById('storeRecipeViewBody');
    if (!modal || !body) return;

    body.innerHTML = `
        <div style="padding: 10px;">
            ${recipe.photo ? `<img src="${recipe.photo}" alt="${recipe.name}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 16px; margin-bottom: 20px;">` : ''}
            ${recipe.video ? `<video src="${recipe.video}" controls style="width: 100%; max-height: 300px; border-radius: 16px; margin-bottom: 20px; background: #000;"></video>` : ''}
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                <h2 style="margin: 0 0 8px; flex: 1;">${recipe.name}</h2>
                <button id="shareStoreRecipeBtn" class="btn btn-secondary" style="padding: 8px 15px; border-radius: 12px; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; white-space: nowrap;">
                    <span>🔗</span> Share
                </button>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                <img src="${recipe.seller.pic || `https://ui-avatars.com/api/?name=${recipe.seller.name}&background=random`}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">
                <span style="color: var(--accent-pink); font-weight: 600;">${recipe.seller.name}</span>
                <span class="store-price-tag" style="position: static; margin-left: auto;">$${recipe.price.toFixed(2)}</span>
            </div>
            ${recipe.description ? `<p style="color: var(--text-secondary); margin-bottom: 16px; line-height: 1.5;">${recipe.description}</p>` : ''}
            <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                <span style="background: rgba(255,107,138,0.1); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">📂 ${recipe.category}</span>
                ${recipe.difficulty ? `<span style="background: rgba(77,182,172,0.1); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">⚡ ${recipe.difficulty}</span>` : ''}
                ${recipe.prepTime ? `<span style="background: rgba(255,154,86,0.1); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">⏱️ Prep: ${recipe.prepTime}m</span>` : ''}
                ${recipe.cookTime ? `<span style="background: rgba(156,136,255,0.1); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">🔥 Cook: ${recipe.cookTime}m</span>` : ''}
            </div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; margin-bottom: 16px;">
                <h3 style="margin: 0 0 10px; font-size: 1rem; color: var(--accent-pink);">🧾 Ingredients</h3>
                <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; line-height: 1.6; color: var(--text-primary);">${recipe.ingredients || 'N/A'}</pre>
            </div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; margin-bottom: 16px;">
                <h3 style="margin: 0 0 10px; font-size: 1rem; color: var(--accent-orange, #ff9a56);">📝 Instructions</h3>
                <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; line-height: 1.6; color: var(--text-primary);">${recipe.instructions || 'N/A'}</pre>
            </div>
            ${recipe.notes ? `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px;">
                <h3 style="margin: 0 0 10px; font-size: 1rem; color: #fbbf24;">💡 Chef's Notes</h3>
                <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; line-height: 1.6; color: var(--text-secondary);">${recipe.notes}</pre>
            </div>` : ''}
        </div>
    `;

    // Attach share handler
    const shareBtn = document.getElementById('shareStoreRecipeBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            handleShareRecipe(recipe);
        });
    }

    modal.classList.add('show');
}

async function loadMyListings() {
    const grid = document.getElementById('myListingsGrid');
    const emptyState = document.getElementById('storeEmptyState');
    const token = sessionStorage.getItem('authToken');
    if (!grid || !token) return;

    try {
        const response = await fetch(`${API_URL}/store/my/listings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const listings = await response.json();

        grid.innerHTML = '';

        if (listings.length === 0) {
            if (emptyState) { emptyState.style.display = 'block'; emptyState.querySelector('h3').textContent = 'No listings yet'; emptyState.querySelector('p').textContent = 'Start adding your secret recipes to pay!'; }
        } else {
            if (emptyState) emptyState.style.display = 'none';
            listings.forEach(recipe => {
                const card = document.createElement('div');
                card.className = 'store-card';
                card.innerHTML = `
                    <div class="store-card-image">
                        ${recipe.photo
                        ? `<img src="${recipe.photo}" alt="${recipe.name}" style="width: 100%; height: 180px; object-fit: cover;">`
                        : `<div style="width: 100%; height: 180px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(255,107,138,0.15), rgba(255,154,86,0.15)); font-size: 3rem;">🧁</div>`
                    }
                        <div class="store-price-tag">$${recipe.price.toFixed(2)}</div>
                    </div>
                    <div class="store-card-body">
                        <h3 class="store-card-title">${recipe.name}</h3>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">📊 ${recipe.salesCount} sales</span>
                            <button class="btn btn-danger btn-sm" onclick="deleteStoreRecipe(${recipe.id})" style="padding: 4px 12px; font-size: 0.8rem; border-radius: 8px;">🗑️ Delete</button>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        }
    } catch (err) {
        console.error('Load listings error:', err);
    }
}

async function loadMyPurchases() {
    const grid = document.getElementById('purchasedGrid');
    const emptyState = document.getElementById('storeEmptyState');
    const token = sessionStorage.getItem('authToken');
    if (!grid || !token) return;

    try {
        const response = await fetch(`${API_URL}/store/my/purchases`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const purchases = await response.json();

        grid.innerHTML = '';

        if (purchases.length === 0) {
            if (emptyState) { emptyState.style.display = 'block'; emptyState.querySelector('h3').textContent = 'No purchases yet'; emptyState.querySelector('p').textContent = 'Browse the store to find recipes you love!'; }
        } else {
            if (emptyState) emptyState.style.display = 'none';
            purchases.forEach(recipe => {
                const card = document.createElement('div');
                card.className = 'store-card';
                card.innerHTML = `
                    <div class="store-card-image">
                        ${recipe.photo
                        ? `<img src="${recipe.photo}" alt="${recipe.name}" style="width: 100%; height: 180px; object-fit: cover;">`
                        : `<div style="width: 100%; height: 180px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(255,107,138,0.15), rgba(255,154,86,0.15)); font-size: 3rem;">🧁</div>`
                    }
                        <div class="store-price-tag" style="background: linear-gradient(135deg, #10b981, #059669);">✅ Owned</div>
                    </div>
                    <div class="store-card-body">
                        <h3 class="store-card-title">${recipe.name}</h3>
                        <div class="store-card-meta">
                            <span class="store-card-category">${recipe.category}</span>
                            <span class="store-card-seller">
                                <img src="${recipe.seller.pic || `https://ui-avatars.com/api/?name=${recipe.seller.name}&background=random`}" alt="" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover;">
                                ${recipe.seller.name}
                            </span>
                        </div>
                        <button class="btn btn-primary store-view-btn" onclick="viewStoreRecipe(${recipe.id})" style="width: 100%; margin-top: 10px; padding: 8px; border-radius: 10px;">
                            <span>📖</span> View Recipe
                        </button>
                    </div>
                `;
                grid.appendChild(card);
            });
        }
    } catch (err) {
        console.error('Load purchases error:', err);
    }
}

async function deleteStoreRecipe(id) {
    if (!confirm('Are you sure you want to remove this recipe from the store?')) return;

    const token = sessionStorage.getItem('authToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/store/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showNotification('✅ Recipe removed from store.', 'success');
            loadMyListings();
        } else {
            const data = await response.json();
            showNotification(data.error || '❌ Failed to delete.', 'error');
        }
    } catch (err) {
        console.error('Delete store recipe error:', err);
    }
}

// Expose store functions globally
window.viewStoreRecipe = viewStoreRecipe;
window.deleteStoreRecipe = deleteStoreRecipe;


// Quick Post Logic
function initQuickPost() {
    quickPostInput = document.getElementById('quickPostInput');
    quickPostBtn = document.getElementById('qpPostBtn');
    quickPostPhotoInput = document.getElementById('qpPhotoInput');
    quickPostVideoInput = document.getElementById('qpVideoInput');
    quickPostMediaPreview = document.getElementById('quickPostMediaPreview');
    qpPhotoPreview = document.getElementById('qpPhotoPreview');
    qpVideoPreview = document.getElementById('qpVideoPreview');
    qpRemoveMedia = document.getElementById('qpRemoveMedia');

    const qpPhotoBtn = document.getElementById('qpPhotoBtn');
    const qpVideoBtn = document.getElementById('qpVideoBtn');
    const quickPostCard = document.getElementById('quickPostCard');
    const quickPostUserPic = document.getElementById('quickPostUserPic');
    const quickPostDefaultAvatar = document.getElementById('quickPostDefaultAvatar');

    if (!quickPostInput || !quickPostBtn) return;

    // Show/hide card based on login
    if (isLoggedIn()) {
        if (quickPostCard) quickPostCard.style.display = 'block';

        // Use the same avatar as the sidebar
        const sidebarPic = document.getElementById('userProfilePic');
        if (sidebarPic && sidebarPic.src) {
            quickPostUserPic.src = sidebarPic.src;
            quickPostUserPic.style.display = 'block';
            quickPostDefaultAvatar.style.display = 'none';
        }
    }

    if (qpPhotoBtn) qpPhotoBtn.onclick = () => quickPostPhotoInput.click();
    if (qpVideoBtn) qpVideoBtn.onclick = () => quickPostVideoInput.click();

    if (quickPostPhotoInput) {
        quickPostPhotoInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (re) => {
                    qpPhotoPreview.src = re.target.result;
                    qpPhotoPreview.style.display = 'block';
                    qpVideoPreview.style.display = 'none';
                    quickPostMediaPreview.style.display = 'block';
                    quickPostVideoInput.value = '';
                };
                reader.readAsDataURL(file);
            }
        };
    }

    if (quickPostVideoInput) {
        quickPostVideoInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                if (qpVideoPreview.src) URL.revokeObjectURL(qpVideoPreview.src);
                qpVideoPreview.src = URL.createObjectURL(file);
                qpVideoPreview.style.display = 'block';
                qpPhotoPreview.style.display = 'none';
                quickPostMediaPreview.style.display = 'block';
                quickPostPhotoInput.value = '';
            }
        };
    }

    if (qpRemoveMedia) {
        qpRemoveMedia.onclick = () => {
            quickPostPhotoInput.value = '';
            quickPostVideoInput.value = '';
            quickPostMediaPreview.style.display = 'none';
            qpPhotoPreview.style.display = 'none';
            qpVideoPreview.style.display = 'none';
        };
    }

    quickPostBtn.onclick = async () => {
        const text = quickPostInput.value.trim();
        const photoFile = quickPostPhotoInput.files[0];
        const videoFile = quickPostVideoInput.files[0];

        if (!text && !photoFile && !videoFile) return;

        quickPostBtn.disabled = true;
        const originalText = quickPostBtn.textContent;
        quickPostBtn.textContent = 'Posting...';

        try {
            const token = sessionStorage.getItem('authToken');
            const postData = {
                name: text.split('\n')[0].substring(0, 40) || 'Quick Update',
                category: 'Social',
                ingredients: 'N/A', // Required by backend
                instructions: text || (photoFile ? 'Shared a photo' : 'Shared a video'),
                visibility: 'public',
                notes: 'Shared via Quick Post'
            };

            const toBase64 = file => new Promise((res, rej) => {
                const r = new FileReader(); r.readAsDataURL(file); r.onload = () => res(r.result); r.onerror = e => rej(e);
            });

            if (photoFile) postData.photo = await toBase64(photoFile);
            if (videoFile) postData.video = await toBase64(videoFile);

            const resp = await fetch(`${API_URL}/recipes`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(postData)
            });

            if (resp.ok) {
                quickPostInput.value = '';
                quickPostMediaPreview.style.display = 'none';
                quickPostPhotoInput.value = '';
                quickPostVideoInput.value = '';
                loadHomeFeed();
                showNotification('✅ Shared successfully!', 'success');
            } else {
                const data = await resp.json();
                showNotification(data.error || '❌ Failed to share', 'error');
            }
        } catch (err) {
            console.error(err);
            showNotification('❌ Error sharing', 'error');
        } finally {
            quickPostBtn.disabled = false;
            quickPostBtn.textContent = originalText;
        }
    };
}
