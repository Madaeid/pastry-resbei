// Admin Dashboard Module for Chef Book - Premium Edition
import { isLoggedIn, logout, getCurrentUser, isAdmin, getAuthToken } from './auth.js';
import { initLanguage, t } from './language.js';

// API Configuration
const API_URL = '/api';

// ===== XSS Protection =====
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ===== Server-Side Access Control =====
// The client-side isAdmin() check is kept as a fast pre-filter,
// but we MUST verify with the server before showing any admin UI.
if (!isLoggedIn()) {
    window.location.href = './auth.html';
} else if (!isAdmin()) {
    window.location.href = './index.html';
}

// Server-side admin verification — prevents sessionStorage tampering
async function verifyAdminAccess() {
    const token = getAuthToken();
    if (!token) {
        window.location.href = './auth.html';
        return false;
    }
    try {
        const res = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            window.location.href = './auth.html';
            return false;
        }
        const user = await res.json();
        if (!user.isAdmin) {
            // Not a real admin — clear the spoofed flag and redirect
            sessionStorage.setItem('isAdmin', 'false');
            window.location.href = './index.html';
            return false;
        }
        // Verified: show the admin content, hide the loading screen
        const wrapper = document.getElementById('adminContentWrapper');
        const verifyScreen = document.getElementById('adminVerifyScreen');
        if (wrapper) wrapper.style.display = '';
        if (verifyScreen) verifyScreen.style.display = 'none';
        return true;
    } catch (err) {
        console.error('Admin verification failed:', err);
        window.location.href = './index.html';
        return false;
    }
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
const searchUsersInput = document.getElementById('searchUsersInput');

// Quick action buttons
const viewAllRecipesBtn = document.getElementById('viewAllRecipes');
const exportDataBtn = document.getElementById('exportData');
const clearAllRecipesBtn = document.getElementById('clearAllRecipes');
const clearAllUsersBtn = document.getElementById('clearAllUsers');
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

const editUserModal = document.getElementById('editUserModal');
const closeEditUserModal = document.getElementById('closeEditUserModal');
const cancelEditUser = document.getElementById('cancelEditUser');
const editUserForm = document.getElementById('editUserForm');

// ===== State =====
let currentUsers = [];
let pendingAction = null;

// ===== Initialize Dashboard =====
async function initDashboard() {
    // Verify admin status with server before showing anything
    const isVerified = await verifyAdminAccess();
    if (!isVerified) return; // Redirect already triggered

    initLanguage();
    
    // Set current date
    const today = new Date();
    currentDateEl.textContent = today.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });

    await updateDashboardData();
    setupEventListeners();
}

async function updateDashboardData() {
    try {
        await Promise.all([
            loadStats(),
            loadUsers()
        ]);
    } catch (err) {
        console.error('Failed to update dashboard:', err);
        showNotification('Failed to sync with server. showing cached data.', 'error');
    }
}

// ===== API Integration =====
async function adminFetch(endpoint, options = {}) {
    const token = getAuthToken();
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
    };

    const response = await fetch(`${API_URL}/admin${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Error ${response.status}`);
    }

    return response.json();
}

// ===== Stats Functions =====
async function loadStats() {
    try {
        const stats = await adminFetch('/stats');
        totalUsersEl.textContent = stats.totalUsers;
        totalAdminsEl.textContent = stats.totalAdmins;
        totalRecipesEl.textContent = stats.totalRecipes;
    } catch (err) {
        console.warn('Backend stats failed, falling back to local');
    }
}

// ===== Users Management =====
async function loadUsers() {
    try {
        currentUsers = await adminFetch('/users');
        renderUsersList(currentUsers);
    } catch (err) {
        console.error('Failed to load users:', err);
        showNotification('Error loading users', 'error');
    }
}

function renderUsersList(usersToRender) {
    if (usersToRender.length === 0) {
        usersTableBody.innerHTML = '';
        noUsersEl.style.display = 'block';
        return;
    }

    noUsersEl.style.display = 'none';
    try {

    usersTableBody.innerHTML = usersToRender.map(user => {
            const joinDate = user.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                })
                : 'Unknown';

            const isSelf = user.username === sessionStorage.getItem('currentUser');
            const hasPremium = user.isPremium;

            const safeUsername = escapeHtml(user.username);
            const safeDisplayName = escapeHtml(user.displayName);
            const safeEmail = escapeHtml(user.email);
            const safePhone = escapeHtml(user.phone || 'N/A');
            const safeBirthday = escapeHtml(user.birthday || 'N/A');

            return `
                <tr class="${user.isAdmin ? 'admin-row' : ''}">
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="user-badge ${user.isAdmin ? 'admin-badge' : 'user-badge-normal'}">
                                ${user.isAdmin ? '👑' : '👤'}
                            </span>
                            <strong>${safeUsername}</strong>
                        </div>
                    </td>
                    <td>${safeDisplayName}</td>
                    <td>${safeEmail}</td>
                    <td>${safePhone}</td>
                    <td>${safeBirthday}</td>
                    <td>
                        <span class="role-tag ${user.isAdmin ? 'role-admin' : 'role-user'}">
                            ${user.isAdmin ? 'Admin' : 'User'}
                        </span>
                    </td>
                    <td>
                        <div class="premium-status ${hasPremium ? 'premium-active' : 'premium-inactive'}">
                            <span class="premium-icon">${hasPremium ? '💎' : '🆓'}</span>
                            <span class="premium-text" style="font-weight: 500;">${hasPremium ? 'Premium' : 'Free'}</span>
                            ${!user.isAdmin ? `
                                <button class="action-btn toggle-premium" data-id="${user.id}" data-premium="${hasPremium}" title="${hasPremium ? 'Revoke' : 'Grant'}">
                                    ${hasPremium ? '❌' : '✅'}
                                </button>
                            ` : ''}
                        </div>
                    </td>
                    <td>
                        <span class="visibility-badge ${user.isPublic ? 'vid-public' : 'vid-private'}">
                            ${!user.isPublic ? '🔒 Private' :
                              user.visibilityLevel === 'followers' ? '👥 Followers' :
                              user.visibilityLevel === 'specific' ? '🔑 Specific' :
                              '🌐 Everyone'}
                        </span>
                    </td>
                    <td>
                        <div style="display: flex; flex-direction: column;">
                            <strong>${user.recipeCount || 0}</strong>
                            <span style="font-size: 0.7rem; opacity: 0.6;">recipes</span>
                        </div>
                    </td>
                    <td>${joinDate}</td>
                    <td>
                        <div class="action-buttons">
                            ${user.username !== 'admin' && !isSelf ? `
                                <button class="action-btn toggle-admin" data-id="${user.id}" data-is-admin="${user.isAdmin}" title="${user.isAdmin ? 'Remove Admin' : 'Make Admin'}">
                                    ${user.isAdmin ? '⬇️' : '⬆️'}
                                </button>
                                <button class="action-btn edit-user" data-id="${user.id}" title="Edit User">
                                    ✏️
                                </button>
                                <button class="action-btn delete-user" data-id="${user.id}" title="Delete User">
                                    🗑️
                                </button>
                            ` : `
                                <span class="protected-label" style="font-size: 0.8rem; opacity: 0.6;">${user.username === 'admin' ? 'System' : 'You'}</span>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        setupUserActionButtons();
    } catch (err) {
        console.error('Failed to render users:', err);
        showNotification('Error loading users', 'error');
    }
}

function setupUserActionButtons() {
    // Toggle admin
    document.querySelectorAll('.toggle-admin').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.dataset.id;
            const isAdminStatus = btn.dataset.isAdmin === 'true';
            
            showConfirmModal(
                isAdminStatus ? '⬇️' : '⬆️',
                isAdminStatus ? 'Remove Admin' : 'Make Admin',
                `Change privileges for user ID ${userId}?`,
                async () => {
                    try {
                        const res = await adminFetch(`/users/${userId}/toggle-admin`, { method: 'PATCH' });
                        showNotification(res.message);
                        updateDashboardData();
                    } catch (err) {
                        showNotification(err.message, 'error');
                    }
                }
            );
        });
    });

    // Delete user
    document.querySelectorAll('.delete-user').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.dataset.id;
            showConfirmModal(
                '🗑️',
                'Delete User',
                'Permanently delete this user and all their recipes?',
                async () => {
                    try {
                        await adminFetch(`/users/${userId}`, { method: 'DELETE' });
                        showNotification('User deleted successfully');
                        updateDashboardData();
                    } catch (err) {
                        showNotification(err.message, 'error');
                    }
                }
            );
        });
    });

    // Grant/Revoke Premium
    document.querySelectorAll('.toggle-premium').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.dataset.id;
            const hasPremium = btn.dataset.premium === 'true';
            
            showConfirmModal(
                hasPremium ? '❌' : '💎',
                hasPremium ? 'Revoke Premium' : 'Grant Premium',
                `${hasPremium ? 'Revoke' : 'Grant'} premium access (1 year)?`,
                async () => {
                    try {
                        const endpoint = hasPremium ? 'revoke-premium' : 'grant-premium';
                        const res = await adminFetch(`/users/${userId}/${endpoint}`, { 
                            method: 'POST',
                            body: hasPremium ? null : JSON.stringify({ plan: 'yearly' })
                        });
                        showNotification(res.message);
                        updateDashboardData();
                    } catch (err) {
                        showNotification(err.message, 'error');
                    }
                }
            );
        });
    });

    // Edit user
    document.querySelectorAll('.edit-user').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.dataset.id;
            const user = currentUsers.find(u => u.id == userId);
            if (user) openEditModal(user);
        });
    });
}

// ===== Edit User Logic =====
function openEditModal(user) {
    document.getElementById('editUserId').value = user.id;
    document.getElementById('displayUsername').value = user.username;
    document.getElementById('editDisplayName').value = user.displayName;
    document.getElementById('editEmail').value = user.email || '';
    document.getElementById('editPassword').value = '';
    editUserModal.classList.add('active');
}

editUserForm.onsubmit = async (e) => {
    e.preventDefault();
    const userId = document.getElementById('editUserId').value;
    const data = {
        displayName: document.getElementById('editDisplayName').value,
        email: document.getElementById('editEmail').value,
        password: document.getElementById('editPassword').value || undefined
    };

    try {
        await adminFetch(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        showNotification('User updated successfully');
        editUserModal.classList.remove('active');
        updateDashboardData();
    } catch (err) {
        showNotification(err.message, 'error');
    }
};

// ===== Delete User From Modal Logic =====
const deleteUserFromModalBtn = document.getElementById('deleteUserFromModal');
if (deleteUserFromModalBtn) {
    deleteUserFromModalBtn.addEventListener('click', () => {
        const userId = document.getElementById('editUserId').value;
        const username = document.getElementById('displayUsername').value;

        if (username === 'admin') {
            showNotification('Cannot delete main admin user', 'error');
            return;
        }

        showConfirmModal(
            '🗑️',
            'Delete User',
            `Permanently delete user @${escapeHtml(username)} and all their recipes?`,
            async () => {
                try {
                    await adminFetch(`/users/${userId}`, { method: 'DELETE' });
                    showNotification('User deleted successfully');
                    editUserModal.classList.remove('active');
                    updateDashboardData();
                } catch (err) {
                    showNotification(err.message, 'error');
                }
            }
        );
    });
}

// ===== Quick Actions =====
async function handleViewAllRecipes() {
    try {
        const recipes = await adminFetch('/recipes');
        if (recipes.length === 0) {
            showInfoModal('<h2>No recipes found in the database.</h2>');
            return;
        }

        const html = recipes.map(r => `
            <div class="recipe-preview-item" style="padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <strong>${escapeHtml(r.name)}</strong> (${escapeHtml(r.category)})<br>
                <small>By: ${escapeHtml(r.userDisplayName)} (@${escapeHtml(r.username)})</small>
            </div>
        `).join('');

        showInfoModal(`
            <div class="info-content">
                <h2>📖 System Recipes (${recipes.length})</h2>
                <div style="max-height: 400px; overflow-y: auto;">
                    ${html}
                </div>
            </div>
        `);
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

async function handleExportData() {
    try {
        const data = await adminFetch('/export');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chef-book-system-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

async function handleClearAllRecipes() {
    showConfirmModal(
        '🗑️',
        'Clear All Recipes',
        'Are you absolutely sure? This will delete EVERY recipe from EVERY user in the database. This cannot be undone!',
        async () => {
            try {
                const res = await adminFetch('/recipes/clear-all', { method: 'POST' });
                showNotification(res.message);
                updateDashboardData();
            } catch (err) {
                showNotification(err.message, 'error');
            }
        }
    );
}

async function handleClearAllUsers() {
    showConfirmModal(
        '🚫',
        'Delete All Users',
        'Are you absolutely sure? This will delete EVERY non-admin user and all their data (recipes, CVs, follows, etc.). This cannot be undone!',
        async () => {
            try {
                const res = await adminFetch('/users/clear-all-non-admins', { method: 'POST' });
                showNotification(res.message);
                updateDashboardData();
            } catch (err) {
                showNotification(err.message, 'error');
            }
        }
    );
}

function handleSystemInfo() {
    const info = {
        platform: navigator.platform,
        userAgent: navigator.userAgent.split(') ')[0] + ')',
        screen: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dashboardVersion: '2.5.0-premium'
    };

    showInfoModal(`
        <div class="info-content">
            <h2>ℹ️ System Information</h2>
            <div class="info-grid" style="display: grid; gap: 15px; margin-top: 20px;">
                <div class="info-item"><strong>Platform:</strong> ${info.platform}</div>
                <div class="info-item"><strong>Browser:</strong> ${info.userAgent}</div>
                <div class="info-item"><strong>Resolution:</strong> ${info.screen}</div>
                <div class="info-item"><strong>Language:</strong> ${info.language}</div>
                <div class="info-item"><strong>Timezone:</strong> ${info.timeZone}</div>
                <div class="info-item"><strong>Version:</strong> ${info.dashboardVersion}</div>
            </div>
        </div>
    `);
}

// ===== Modals =====
function showConfirmModal(icon, title, message, action) {
    confirmIcon.textContent = icon;
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    pendingAction = action;
    confirmModal.classList.add('active');
}

confirmAction.onclick = () => {
    if (pendingAction) pendingAction();
    confirmModal.classList.remove('active');
};

function showInfoModal(content) {
    infoModalBody.innerHTML = content;
    infoModal.classList.add('active');
}

// ===== Messaging =====
function showNotification(message, type = 'success') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = `notification notification-${type} show`;
    el.innerHTML = `
        <span class="notification-icon">${type === 'success' ? '✅' : '❌'}</span>
        <span class="notification-message">${escapeHtml(message)}</span>
    `;
    document.body.appendChild(el);
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// ===== Event Listeners =====
function setupEventListeners() {
    logoutBtn.addEventListener('click', logout);
    refreshUsersBtn.addEventListener('click', updateDashboardData);
    
    if (searchUsersInput) {
        searchUsersInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                renderUsersList(currentUsers);
                return;
            }
            
            const filtered = currentUsers.filter(user => {
                const username = (user.username || '').toLowerCase();
                const displayName = (user.displayName || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                
                return username.includes(query) || 
                       displayName.includes(query) || 
                       email.includes(query);
            });
            
            renderUsersList(filtered);
        });
    }
    
    // Quick actions
    viewAllRecipesBtn.addEventListener('click', handleViewAllRecipes);
    exportDataBtn.addEventListener('click', handleExportData);
    clearAllRecipesBtn.addEventListener('click', handleClearAllRecipes);
    if (clearAllUsersBtn) clearAllUsersBtn.addEventListener('click', handleClearAllUsers);
    systemInfoBtn.addEventListener('click', handleSystemInfo);
    
    closeConfirmModal.onclick = () => confirmModal.classList.remove('active');
    confirmCancel.onclick = () => confirmModal.classList.remove('active');
    closeInfoModal.onclick = () => infoModal.classList.remove('active');
    closeEditUserModal.onclick = () => editUserModal.classList.remove('active');
    cancelEditUser.onclick = () => editUserModal.classList.remove('active');

    // Close on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            confirmModal.classList.remove('active');
            infoModal.classList.remove('active');
            editUserModal.classList.remove('active');
        }
    });
}

initDashboard();
