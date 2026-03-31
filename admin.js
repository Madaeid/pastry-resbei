// Admin Dashboard Module for Pastry Recipe Book
import './style.css';
import { isLoggedIn, logout, getCurrentUser, isAdmin, getAllUsers, deleteUser, toggleAdminStatus, updateUser } from './auth.js';
import { isUserPremium, grantPremiumToUser, revokePremiumFromUser } from './payment.js';
import { initLanguage, t, getCurrentLanguage } from './language.js';

// ===== Access Control =====
// Check if user is logged in and is admin
if (!isLoggedIn()) {
    window.location.href = './auth.html';
} else if (!isAdmin()) {
    // Regular users cannot access admin page
    window.location.href = './index.html';
}

// ===== DOM Elements =====
const logoutBtn = document.getElementById('logoutBtn');
const totalUsersEl = document.getElementById('totalUsers');
const totalAdminsEl = document.getElementById('totalAdmins');
const totalRecipesEl = document.getElementById('totalRecipes');
const currentDateEl = document.getElementById('currentDate');
const usersTableBody = document.getElementById('usersTableBody');
const noUsersEl = document.getElementById('noUsers');
const refreshUsersBtn = document.getElementById('refreshUsers');

// Quick action buttons
const viewAllRecipesBtn = document.getElementById('viewAllRecipes');
const exportDataBtn = document.getElementById('exportData');
const clearAllRecipesBtn = document.getElementById('clearAllRecipes');
const systemInfoBtn = document.getElementById('systemInfo');

// Modal elements
const confirmModal = document.getElementById('confirmModal');
const closeConfirmModal = document.getElementById('closeConfirmModal');
const confirmCancel = document.getElementById('confirmCancel');
const confirmAction = document.getElementById('confirmAction');
const confirmIcon = document.getElementById('confirmIcon');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');

const infoModal = document.getElementById('infoModal');
const closeInfoModal = document.getElementById('closeInfoModal');
const infoModalBody = document.getElementById('infoModalBody');

// ===== State =====
let pendingAction = null;

// ===== Initialize Dashboard =====
function initDashboard() {
    // Initialize language system
    initLanguage();

    updateStats();
    loadUsers();
    setupEventListeners();

    // Set current date
    const today = new Date();
    currentDateEl.textContent = today.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

// ===== Stats Functions =====
function updateStats() {
    const users = getAllUsers();
    const recipes = getStoredRecipes();

    totalUsersEl.textContent = users.length;
    totalAdminsEl.textContent = users.filter(u => u.isAdmin).length;
    totalRecipesEl.textContent = recipes.length;
}

function getStoredRecipes() {
    // Get all recipes from all users (user-specific storage)
    const users = getAllUsers();
    let allRecipes = [];

    users.forEach(user => {
        const userKey = `pastryRecipes_${user.username.toLowerCase()}`;
        const userRecipes = localStorage.getItem(userKey);
        if (userRecipes) {
            const recipes = JSON.parse(userRecipes);
            // Add owner info to each recipe
            recipes.forEach(recipe => {
                recipe.owner = user.displayName;
                recipe.ownerUsername = user.username;
            });
            allRecipes = allRecipes.concat(recipes);
        }
    });

    return allRecipes;
}

// ===== Users Management =====
function loadUsers() {
    const users = getAllUsers();

    if (users.length === 0) {
        usersTableBody.innerHTML = '';
        noUsersEl.style.display = 'block';
        return;
    }

    noUsersEl.style.display = 'none';

    // Sort users: admins first, then by username
    users.sort((a, b) => {
        if (a.isAdmin && !b.isAdmin) return -1;
        if (!a.isAdmin && b.isAdmin) return 1;
        return a.username.localeCompare(b.username);
    });

    usersTableBody.innerHTML = users.map(user => {
        const joinDate = user.createdAt
            ? new Date(user.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
            : 'Unknown';

        const birthdayFormatted = user.birthday && user.birthday !== 'N/A'
            ? new Date(user.birthday).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
            : 'N/A';

        const isMainAdmin = user.username.toLowerCase() === 'admin';
        const currentUserName = getCurrentUser();
        const isSelf = user.displayName === currentUserName;
        const hasPremium = isUserPremium(user.username);

        return `
            <tr class="${user.isAdmin ? 'admin-row' : ''}">
                <td>
                    <span class="user-badge ${user.isAdmin ? 'admin-badge' : 'user-badge-normal'}">
                        ${user.isAdmin ? '👑' : '👤'}
                    </span>
                    ${user.username}
                </td>
                <td>${user.displayName}</td>
                <td>${user.email}</td>
                <td>${user.phone}</td>
                <td>${birthdayFormatted}</td>
                <td>
                    <span class="role-tag ${user.isAdmin ? 'role-admin' : 'role-user'}">
                        ${user.isAdmin ? 'Admin' : 'User'}
                    </span>
                </td>
                <td>
                    <div class="premium-status ${hasPremium ? 'premium-active' : 'premium-inactive'}">
                        <span class="premium-icon">${hasPremium ? '💎' : '🆓'}</span>
                        <span class="premium-text">${hasPremium ? 'Premium' : 'Free'}</span>
                        ${!user.isAdmin ? `
                            <button class="action-btn toggle-premium" data-username="${user.username}" data-premium="${hasPremium}" title="${hasPremium ? 'Revoke Premium' : 'Grant Premium'}">
                                ${hasPremium ? '❌' : '✅'}
                            </button>
                        ` : '<span class="admin-premium-label">(Admin)</span>'}
                    </div>
                </td>
                <td>
                    <span class="visibility-tag ${user.isPublic !== false ? 'visibility-public' : 'visibility-private'}">
                        ${user.isPublic !== false ? '🌍 Public' : '🔒 Private'}
                    </span>
                </td>
                <td>${joinDate}</td>
                <td>
                    <div class="action-buttons">
                        ${!isMainAdmin && !isSelf ? `
                            <button class="action-btn toggle-admin" data-username="${user.username}" title="${user.isAdmin ? 'Remove Admin' : 'Make Admin'}">
                                ${user.isAdmin ? '⬇️' : '⬆️'}
                            </button>
                            <button class="action-btn edit-user" data-username="${user.username}" title="Edit User">
                                ✏️
                            </button>
                            <button class="action-btn delete-user" data-username="${user.username}" title="Delete User">
                                🗑️
                            </button>
                        ` : `
                            <span class="protected-label">${isMainAdmin ? 'Protected' : 'You'}</span>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Add event listeners to action buttons
    setupUserActionButtons();
}

function setupUserActionButtons() {
    // Toggle admin buttons
    document.querySelectorAll('.toggle-admin').forEach(btn => {
        btn.addEventListener('click', () => {
            const username = btn.dataset.username;
            const user = getAllUsers().find(u => u.username === username);
            showConfirmModal(
                user.isAdmin ? '⬇️' : '⬆️',
                user.isAdmin ? 'Remove Admin Rights' : 'Grant Admin Rights',
                `Are you sure you want to ${user.isAdmin ? 'remove admin rights from' : 'make'} "${username}" ${user.isAdmin ? '' : 'an admin'}?`,
                () => {
                    const result = toggleAdminStatus(username);
                    if (result.success) {
                        loadUsers();
                        updateStats();
                    } else {
                        alert(result.error);
                    }
                }
            );
        });
    });

    // Delete user buttons
    document.querySelectorAll('.delete-user').forEach(btn => {
        btn.addEventListener('click', () => {
            const username = btn.dataset.username;
            showConfirmModal(
                '🗑️',
                'Delete User',
                `Are you sure you want to delete the user "${username}"? This action cannot be undone.`,
                () => {
                    const result = deleteUser(username);
                    if (result.success) {
                        loadUsers();
                        updateStats();
                    } else {
                        alert(result.error);
                    }
                }
            );
        });
    });

    // Edit user buttons
    document.querySelectorAll('.edit-user').forEach(btn => {
        btn.addEventListener('click', () => {
            handleEditUser(btn.dataset.username);
        });
    });

    // Toggle premium buttons
    document.querySelectorAll('.toggle-premium').forEach(btn => {
        btn.addEventListener('click', () => {
            const username = btn.dataset.username;
            const hasPremium = btn.dataset.premium === 'true';

            showConfirmModal(
                hasPremium ? '❌' : '💎',
                hasPremium ? 'Revoke Premium' : 'Grant Premium',
                `Are you sure you want to ${hasPremium ? 'revoke premium from' : 'grant lifetime premium to'} "${username}"?`,
                () => {
                    let result;
                    if (hasPremium) {
                        result = revokePremiumFromUser(username);
                    } else {
                        result = grantPremiumToUser(username, 'lifetime');
                    }

                    if (result.success) {
                        loadUsers();
                        updateStats();
                        showNotification(result.message, 'success');
                    } else {
                        showNotification(result.error, 'error');
                    }
                }
            );
        });
    });
}

// ===== Edit User Logic =====
const editUserModal = document.getElementById('editUserModal');
const closeEditUserModal = document.getElementById('closeEditUserModal');
const cancelEditUser = document.getElementById('cancelEditUser');
const editUserForm = document.getElementById('editUserForm');

function handleEditUser(username) {
    const user = getAllUsers().find(u => u.username === username);
    if (!user) return;

    // Populate form
    document.getElementById('editUsername').value = user.username;
    document.getElementById('displayUsername').value = user.username;
    document.getElementById('editDisplayName').value = user.displayName;
    document.getElementById('editEmail').value = user.email !== 'N/A' ? user.email : '';
    document.getElementById('editPassword').value = '';
    document.getElementById('editIsPublic').checked = user.isPublic !== false;

    editUserModal.classList.add('active');
}

function hideEditUserModal() {
    editUserModal.classList.remove('active');
    editUserForm.reset();
}

async function saveEditedUser(e) {
    e.preventDefault();

    const username = document.getElementById('editUsername').value;
    const displayName = document.getElementById('editDisplayName').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const password = document.getElementById('editPassword').value;

    if (!displayName || !email) {
        alert('Display Name and Email are required');
        return;
    }

    if (password && password.length < 4) {
        alert('Password must be at least 4 characters');
        return;
    }

    const updateData = {
        displayName,
        email,
        password: password || undefined,
        isPublic: document.getElementById('editIsPublic').checked
    };

    const result = await updateUser(username, updateData);

    if (result.success) {
        hideEditUserModal();
        loadUsers();
        // If current user updated their own name, reload to update header
        if (username === getCurrentUser()) {
            location.reload();
        }
    } else {
        alert(result.error);
    }
}

// ===== Modal Functions =====
function showConfirmModal(icon, title, message, action) {
    confirmIcon.textContent = icon;
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    pendingAction = action;
    confirmModal.classList.add('active');
}

function hideConfirmModal() {
    confirmModal.classList.remove('active');
    pendingAction = null;
}

function showInfoModal(content) {
    infoModalBody.innerHTML = content;
    infoModal.classList.add('active');
}

function hideInfoModal() {
    infoModal.classList.remove('active');
}

// ===== Quick Actions =====
function handleViewAllRecipes() {
    const recipes = getStoredRecipes();

    if (recipes.length === 0) {
        showInfoModal(`
            <div class="info-content">
                <div class="info-icon">📖</div>
                <h2>No Recipes</h2>
                <p>There are no recipes stored in the system yet.</p>
            </div>
        `);
        return;
    }

    const recipesHtml = recipes.map((recipe, index) => `
        <div class="recipe-preview">
            <div class="recipe-preview-header">
                <span class="recipe-number">#${index + 1}</span>
                <span class="recipe-category">${getCategoryEmoji(recipe.category)} ${recipe.category}</span>
            </div>
            <h4>${recipe.name}</h4>
            <div class="recipe-meta">
                <span>⏱️ ${recipe.prepTime + recipe.cookTime} min</span>
                <span>🍽️ ${recipe.servings} servings</span>
                <span>👤 ${recipe.owner || 'Unknown'}</span>
            </div>
            <button class="btn-view-details view-recipe-btn" data-id="${recipe.id}" data-owner="${recipe.ownerUsername}">
                View Details 👁️
            </button>
        </div>
    `).join('');

    showInfoModal(`
        <div class="info-content">
            <h2>📖 All Recipes (${recipes.length})</h2>
            <div class="recipes-preview-list">
                ${recipesHtml}
            </div>
        </div>
    `);

    // Add event listeners for view buttons
    document.querySelectorAll('.view-recipe-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            viewFullRecipe(parseInt(btn.dataset.id), btn.dataset.owner);
        });
    });
}

function viewFullRecipe(id, ownerUsername) {
    const recipes = getStoredRecipes();
    // Find recipe by ID and owner
    const recipe = recipes.find(r => r.id === id && r.ownerUsername === ownerUsername);

    if (!recipe) return;

    const categoryEmoji = getCategoryEmoji(recipe.category);
    const difficultyText = getDifficultyText(recipe.difficulty);
    const totalTime = recipe.prepTime + recipe.cookTime;

    showInfoModal(`
        <div class="info-content" style="text-align: left;">
            <button id="backToRecipesBtn" class="btn-back-list">
                ⬅️ Back to List
            </button>
            
            <div class="modal-recipe-image">
                ${recipe.photo
            ? `<img src="${recipe.photo}" alt="${recipe.name}">`
            : `<span class="placeholder-icon">${categoryEmoji}</span>`}
            </div>
            
            <h2 class="modal-recipe-title">${recipe.name}</h2>
            <div class="modal-recipe-meta">
                <div class="meta-item">
                    <span class="meta-icon">👤</span>
                    Owner: ${recipe.owner || 'Unknown'}
                </div>
                <div class="meta-item">
                    <span class="meta-icon">📁</span>
                    ${recipe.category}
                </div>
                <div class="meta-item">
                    <span class="meta-icon">⏱️</span>
                    Total: ${totalTime} min
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
        </div>
    `);

    // Back button listener
    document.getElementById('backToRecipesBtn').addEventListener('click', handleViewAllRecipes);
}

function getCategoryEmoji(category) {
    const emojis = {
        cakes: '🎂',
        cookies: '🍪',
        pastries: '🥐',
        pies: '🥧',
        breads: '🍞',
        desserts: '🍰',
        chocolates: '🍫',
        other: '✨'
    };
    return emojis[category] || '🍴';
}

function getDifficultyText(difficulty) {
    const levels = {
        'easy': '🟢 Easy',
        'medium': '🟡 Medium',
        'hard': '🔴 Hard'
    };
    return levels[difficulty] || '🟡 Medium';
}

function handleExportData() {
    const data = {
        exportDate: new Date().toISOString(),
        users: getAllUsers(),
        recipes: getStoredRecipes()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pastry-recipe-book-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handleClearAllRecipes() {
    showConfirmModal(
        '🗑️',
        'Clear All Recipes',
        'Are you sure you want to delete ALL recipes from ALL users? This action cannot be undone!',
        () => {
            // Clear recipes for all users
            const users = getAllUsers();
            users.forEach(user => {
                const userKey = `pastryRecipes_${user.username.toLowerCase()}`;
                localStorage.removeItem(userKey);
            });
            updateStats();
            alert('All recipes from all users have been deleted.');
        }
    );
}

function handleSystemInfo() {
    const users = getAllUsers();
    const recipes = getStoredRecipes();
    const storageUsed = JSON.stringify(localStorage).length;

    showInfoModal(`
        <div class="info-content">
            <h2>ℹ️ System Information</h2>
            <div class="system-info-grid">
                <div class="info-item">
                    <span class="info-label">App Name</span>
                    <span class="info-value">Pastry Recipe Book</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Version</span>
                    <span class="info-value">1.0.0</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Total Users</span>
                    <span class="info-value">${users.length}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Admin Users</span>
                    <span class="info-value">${users.filter(u => u.isAdmin).length}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Total Recipes</span>
                    <span class="info-value">${recipes.length}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Storage Used</span>
                    <span class="info-value">${(storageUsed / 1024).toFixed(2)} KB</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Current User</span>
                    <span class="info-value">${getCurrentUser()}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Browser</span>
                    <span class="info-value">${navigator.userAgent.split(' ').pop()}</span>
                </div>
            </div>
        </div>
    `);
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Logout
    logoutBtn.addEventListener('click', logout);

    // Refresh users
    refreshUsersBtn.addEventListener('click', () => {
        loadUsers();
        updateStats();
    });

    // Quick actions
    viewAllRecipesBtn.addEventListener('click', handleViewAllRecipes);
    exportDataBtn.addEventListener('click', handleExportData);
    clearAllRecipesBtn.addEventListener('click', handleClearAllRecipes);
    systemInfoBtn.addEventListener('click', handleSystemInfo);

    // Confirm modal
    closeConfirmModal.addEventListener('click', hideConfirmModal);
    confirmCancel.addEventListener('click', hideConfirmModal);
    confirmAction.addEventListener('click', () => {
        if (pendingAction) {
            pendingAction();
        }
        hideConfirmModal();
    });

    // Info modal
    closeInfoModal.addEventListener('click', hideInfoModal);

    // Close modals on outside click
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) hideConfirmModal();
    });
    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) hideInfoModal();
    });

    // Close modals on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideConfirmModal();
            hideInfoModal();
            hideEditUserModal();
        }
    });

    // Edit User Modal
    closeEditUserModal.addEventListener('click', hideEditUserModal);
    cancelEditUser.addEventListener('click', hideEditUserModal);
    editUserModal.addEventListener('click', (e) => {
        if (e.target === editUserModal) hideEditUserModal();
    });
    editUserForm.addEventListener('submit', saveEditedUser);
}

// ===== Notification Function =====
function showNotification(message, type = 'success') {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${type === 'success' ? '✅' : '❌'}</span>
        <span class="notification-message">${message}</span>
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===== Initialize =====
initDashboard();
