// Authentication Module for Chef Book
import './style.css';
import { initLanguage, t, getCurrentLanguage } from './language.js';
import { countries } from './utils/countries.ts';

// API Configuration
const API_URL = '/api';

// ===== Authentication Functions (available for import) =====

// Simple hash function for password (SHA-256)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Get all users from localStorage
function getUsers() {
    const users = localStorage.getItem('pastryUsers');
    return users ? JSON.parse(users) : {};
}

// Save users to localStorage
function saveUsers(users) {
    localStorage.setItem('pastryUsers', JSON.stringify(users));
}

// ===== Admin Functions =====
// Initialize default admin user if not exists
// Initialize default admin user if not exists
async function initializeAdmin() {
    const users = getUsers();
    const defaultEmail = 'madaeid500@gmail.com';

    // Check if admin exists
    if (!users['admin']) {
        const adminPasswordHash = await hashPassword('admin123');
        users['admin'] = {
            displayName: 'Admin',
            email: defaultEmail,
            passwordHash: adminPasswordHash,
            isAdmin: true,
            createdAt: new Date().toISOString()
        };
        saveUsers(users);
        console.log('Default admin account created: admin / admin123');
    } else {
        // Update email if missing or using old default
        if (!users['admin'].email || users['admin'].email === 'admin@pastry.com') {
            users['admin'].email = defaultEmail;
            saveUsers(users);
            console.log('Admin email updated to: ' + defaultEmail);
        }
    }
}

// Check if current user is admin
function isAdmin() {
    return sessionStorage.getItem('isAdmin') === 'true';
}

// Get all users (admin function)
function getAllUsers() {
    const users = getUsers();
    return Object.keys(users).map(key => ({
        username: key,
        displayName: users[key].displayName,
        email: users[key].email || 'N/A',
        phone: users[key].phone || 'N/A',
        birthday: users[key].birthday || 'N/A',
        isAdmin: users[key].isAdmin || false,
        profilePicture: users[key].profilePicture || null,
        cvFile: users[key].cvFile || null,
        isPublic: users[key].isPublic !== undefined ? users[key].isPublic : true,
        allowedViewers: users[key].allowedViewers || [],
        gallery: users[key].gallery || [],
        createdAt: users[key].createdAt
    }));
}

// Delete user (admin function)
function deleteUser(username) {
    const users = getUsers();
    const userKey = username.toLowerCase();

    // Cannot delete main admin
    if (userKey === 'admin') {
        return { success: false, error: 'Cannot delete the main admin account' };
    }

    // Check if user exists
    if (!users[userKey]) {
        return { success: false, error: 'User not found' };
    }

    // Delete user's recipes
    const recipeKey = `pastryRecipes_${userKey}`;
    localStorage.removeItem(recipeKey);

    // Delete user
    delete users[userKey];
    saveUsers(users);

    return { success: true, message: 'User deleted successfully' };
}

// Toggle admin status (admin function)
function toggleAdminStatus(username) {
    const users = getUsers();
    const userKey = username.toLowerCase();

    // Cannot modify main admin
    if (userKey === 'admin') {
        return { success: false, error: 'Cannot modify the main admin account' };
    }

    // Check if user exists
    if (!users[userKey]) {
        return { success: false, error: 'User not found' };
    }

    // Toggle admin status
    users[userKey].isAdmin = !users[userKey].isAdmin;
    saveUsers(users);

    return {
        success: true,
        isAdmin: users[userKey].isAdmin,
        message: users[userKey].isAdmin ? 'User is now an admin' : 'Admin rights removed'
    };
}

// Update user details (admin function or self-update)
async function updateUser(username, data) {
    const users = getUsers();
    const user = users[username.toLowerCase()];

    if (!user) {
        return { success: false, error: 'User not found' };
    }

    // 1. Handle Email Update
    if (data.email) {
        // Check if email is already taken by ANOTHER user
        const emailExists = Object.entries(users).some(([u, details]) =>
            u !== username.toLowerCase() &&
            details.email &&
            details.email.toLowerCase() === data.email.toLowerCase()
        );
        if (emailExists) {
            return { success: false, error: 'Email already registered by another user' };
        }
        user.email = data.email;
    }

    // 2. Handle Display Name Update
    if (data.displayName) {
        user.displayName = data.displayName;
    }

    // 3. Handle Phone Number Update
    if (data.phoneNumber !== undefined) {
        user.phoneNumber = data.phoneNumber;
    }

    // 4. Handle Password Update
    if (data.password) {
        user.passwordHash = await hashPassword(data.password);
    }

    // 5. Handle Profile Picture Update
    if (data.profilePicture) {
        user.profilePicture = data.profilePicture;
    }

    // 5b. Handle CV File Update
    if (data.cvFile) {
        user.cvFile = data.cvFile;
    }

    // 5c. Handle Profile Visibility Update
    if (data.isPublic !== undefined) {
        user.isPublic = data.isPublic; // Can be false, 'all', 'followers', or 'specific'
    }

    // 5c2. Handle Allowed Viewers (for 'specific' visibility)
    if (data.allowedViewers !== undefined) {
        user.allowedViewers = data.allowedViewers;
    }

    // 5d. Handle Gallery Update
    if (data.gallery !== undefined) {
        user.gallery = data.gallery;
    }

    // 6. Handle Username Update (Renaming User)
    let newUsernameForSession = null;
    if (data.newUsername && data.newUsername.toLowerCase() !== username.toLowerCase()) {
        const newUsername = data.newUsername.toLowerCase();

        // Check uniqueness
        if (users[newUsername]) {
            return { success: false, error: 'Username already taken' };
        }

        // Validate length
        if (newUsername.length < 3) {
            return { success: false, error: 'Username must be at least 3 characters' };
        }

        // Create new entry
        users[newUsername] = { ...user };

        // Delete old entry
        delete users[username.toLowerCase()];

        // Migrate Recipes
        const oldRecipeKey = `pastryRecipes_${username.toLowerCase()}`;
        const newRecipeKey = `pastryRecipes_${newUsername}`;
        const userRecipes = localStorage.getItem(oldRecipeKey);
        if (userRecipes) {
            localStorage.setItem(newRecipeKey, userRecipes);
            localStorage.removeItem(oldRecipeKey);
        }

        // If this is the currently logged-in user, session will be updated below
        if (sessionStorage.getItem('currentUser') === username.toLowerCase()) {
            newUsernameForSession = newUsername;
        }
    }

    saveUsers(users);

    // Update session if username changed
    if (newUsernameForSession) {
        sessionStorage.setItem('currentUser', newUsernameForSession);
    }

    // Sync with Backend if logged in as this user
    const authToken = sessionStorage.getItem('authToken');
    const currentUser = sessionStorage.getItem('currentUser');

    if (authToken && (currentUser === username.toLowerCase() || newUsernameForSession)) {
        try {
            const backendData = {
                displayName: data.displayName,
                email: data.email,
                phone: data.phoneNumber,
                password: data.password,
                newUsername: data.newUsername,
                profilePicture: data.profilePicture,
                cvFile: data.cvFile,
                isPublic: data.isPublic,
                allowedViewers: data.allowedViewers,
                gallery: data.gallery
            };

            fetch(`${API_URL}/users/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(backendData)
            }).then(res => {
                if (!res.ok) console.warn('Backend profile update failed:', res.status);
                else console.log('Backend profile synced successfully');
            }).catch(err => console.error('Backend sync error:', err));
        } catch (e) {
            console.warn('Skipping backend sync', e);
        }
    }

    return { success: true };
}

// ===== Remember Me Functions =====
// Save credentials for auto-fill (base64 encoded for basic obfuscation)
function saveCredentials(username, password) {
    const encodedPassword = btoa(password); // Basic encoding (not secure encryption)
    localStorage.setItem('rememberedUser', JSON.stringify({
        username: username,
        password: encodedPassword,
        savedAt: new Date().toISOString()
    }));
}

// Load saved credentials
function loadCredentials() {
    const saved = localStorage.getItem('rememberedUser');
    if (saved) {
        const credentials = JSON.parse(saved);
        return {
            username: credentials.username,
            password: atob(credentials.password) // Decode the password
        };
    }
    return null;
}

// Clear saved credentials
function clearCredentials() {
    localStorage.removeItem('rememberedUser');
}

// Check if credentials are saved
function hasRememberedCredentials() {
    return localStorage.getItem('rememberedUser') !== null;
}

// Register new user
async function registerUser(username, email, phone, birthday, password) {
    // Validate username
    if (username.length < 3) {
        return { success: false, error: 'Username must be at least 3 characters long' };
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { success: false, error: 'Please enter a valid email address' };
    }

    // Validate phone number (basic validation - allows international formats)
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        return { success: false, error: 'Please enter a valid phone number' };
    }

    // Validate birthday
    if (!birthday) {
        return { success: false, error: 'Please enter your birthday' };
    }

    // Check age (must be at least 13 years old)
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    if (age < 13) {
        return { success: false, error: 'You must be at least 13 years old to register' };
    }

    // Validate password
    if (password.length < 4) {
        return { success: false, error: 'Password must be at least 4 characters long' };
    }

    // Check password strength: must contain uppercase, lowercase, and number
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber) {
        return { success: false, error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' };
    }

    const users = getUsers();

    // Check if username exists locally
    if (users[username.toLowerCase()]) {
        return { success: false, error: 'Username already exists' };
    }

    // Check if email exists locally
    const emailExists = Object.values(users).some(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (emailExists) {
        return { success: false, error: 'Email already registered' };
    }

    // Check if phone exists locally
    const phoneExists = Object.values(users).some(u => u.phone && u.phone.replace(/\s/g, '') === phone.replace(/\s/g, ''));
    if (phoneExists) {
        return { success: false, error: 'Phone number already registered' };
    }

    // Try to register with backend first (for Stripe payment support)
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, phone, birthday, password })
        });

        if (!response.ok) {
            const data = await response.json();
            // If backend says user exists, return that error
            if (data.error) {
                console.log('Backend registration error:', data.error);
                // Only fail if it's a duplicate error from backend
                if (data.error.includes('already')) {
                    return { success: false, error: data.error };
                }
            }
        } else {
            console.log('User registered with backend successfully');
        }
    } catch (err) {
        // Backend not available - continue with local registration
        console.log('Backend registration not available, using local only:', err.message);
    }

    // Hash password and save user locally
    const passwordHash = await hashPassword(password);
    users[username.toLowerCase()] = {
        displayName: username,
        email: email,
        phone: phone,
        birthday: birthday,
        passwordHash: passwordHash,
        createdAt: new Date().toISOString()
    };

    saveUsers(users);
    return { success: true };
}

// Reset password
// Send Reset Code - supports both email and phone
function sendResetCode(username, contactValue, method = 'email') {
    const users = getUsers();
    const user = users[username.toLowerCase()];

    if (!user) {
        return { success: false, error: 'User not found' };
    }

    // Verify contact based on method
    if (method === 'email') {
        if (!user.email || user.email.toLowerCase() !== contactValue.toLowerCase()) {
            return { success: false, error: 'Email does not match our records' };
        }
    } else if (method === 'phone') {
        // Normalize phone numbers for comparison (remove spaces, dashes, etc.)
        const normalizePhone = (phone) => phone.replace(/[\s\-\(\)\.]/g, '');
        const userPhone = normalizePhone(user.phone || '');
        const inputPhone = normalizePhone(contactValue);

        if (!userPhone || userPhone !== inputPhone) {
            return { success: false, error: 'Phone number does not match our records' };
        }
    }

    // Generate 6-digit code cryptographically securely
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    const code = Math.floor(100000 + (array[0] % 900000)).toString();

    // Save code and expiry (10 minutes)
    user.resetCode = code;
    user.resetCodeExpiry = Date.now() + 10 * 60 * 1000;
    user.resetMethod = method;
    saveUsers(users);

    // Mask the contact info for display
    let maskedContact = '';
    if (method === 'email') {
        const [localPart, domain] = contactValue.split('@');
        maskedContact = localPart.slice(0, 2) + '***@' + domain;
    } else {
        maskedContact = contactValue.slice(0, 3) + '****' + contactValue.slice(-3);
    }

    // Simulate sending code
    if (method === 'email') {
        console.log(`[SIMULATION] Email sent to ${contactValue} with code: ${code}`);
        alert(`📧 SIMULATED EMAIL\n\nTo: ${contactValue}\nSubject: Password Reset Code\n\nYour verification code is: ${code}\n\nThis code expires in 10 minutes.`);
    } else {
        console.log(`[SIMULATION] SMS sent to ${contactValue} with code: ${code}`);
        alert(`📱 SIMULATED SMS\n\nTo: ${contactValue}\n\nYour Chef Book verification code is: ${code}\n\nThis code expires in 10 minutes.`);
    }

    return { success: true, maskedContact: maskedContact, method: method };
}

// Reset password with code
async function resetPasswordWithCode(username, code, newPassword) {
    const users = getUsers();
    const user = users[username.toLowerCase()];

    if (!user) {
        return { success: false, error: 'User not found' };
    }

    // Verify code
    if (!user.resetCode || user.resetCode !== code) {
        return { success: false, error: 'Invalid verification code' };
    }

    // Verify expiry
    if (Date.now() > user.resetCodeExpiry) {
        return { success: false, error: 'Verification code has expired' };
    }

    // Validate new password strength
    if (newPassword.length < 4) {
        return { success: false, error: 'Password must be at least 4 characters long' };
    }

    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasUppercase || !hasLowercase || !hasNumber) {
        return { success: false, error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' };
    }

    // Hash new password and save
    const passwordHash = await hashPassword(newPassword);
    user.passwordHash = passwordHash;

    // Clear code
    delete user.resetCode;
    delete user.resetCodeExpiry;

    saveUsers(users);

    return { success: true };
}

// Login user
async function loginUser(username, password) {
    const users = getUsers();
    const user = users[username.toLowerCase()];

    if (!user) {
        return { success: false, error: 'Invalid username or password' };
    }

    // Verify password
    const passwordHash = await hashPassword(password);
    if (user.passwordHash !== passwordHash) {
        return { success: false, error: 'Invalid username or password' };
    }

    // Set session with admin status
    sessionStorage.setItem('currentUser', username.toLowerCase());
    sessionStorage.setItem('isAdmin', user.isAdmin ? 'true' : 'false');

    // Also try to get JWT token from backend for API calls
    try {
        let response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.token) {
                sessionStorage.setItem('authToken', data.token);
            }
        } else {
            // If backend login failed (e.g. 401/404) but local success, user might not exist on backend
            // Try to sync user to backend
            console.log('Backend login failed, attempting to sync user...');

            try {
                // Register user on backend
                const regResponse = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: username,
                        email: user.email,
                        phone: user.phone || 'N/A',
                        birthday: user.birthday || '2000-01-01', // Fallback
                        password: password
                    })
                });

                if (regResponse.ok || regResponse.status === 409) {
                    // Registration success or already exists (but maybe failed login before?)
                    // Retry login
                    console.log('Sync success/exists, retrying login...');
                    response = await fetch(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.token) {
                            sessionStorage.setItem('authToken', data.token);
                            console.log('Backend token acquired after sync');
                        }
                    }
                }
            } catch (syncErr) {
                console.error('Failed to sync user to backend:', syncErr);
            }
        }
    } catch (err) {
        console.log('Backend auth not available, using local auth');
    }

    return { success: true, isAdmin: user.isAdmin || false };
}

// Check if user is logged in
function isLoggedIn() {
    return sessionStorage.getItem('currentUser') !== null;
}

// Logout user - Shows confirmation modal
function logout() {
    showLogoutConfirmModal();
}

// Actually perform the logout
function performLogout() {
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('isAdmin');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('returnUrl');
    window.location.href = './auth.html';
}

// Show logout confirmation modal
function showLogoutConfirmModal() {
    // Remove existing modal if any
    const existing = document.getElementById('logoutConfirmModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'logoutConfirmModal';
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content modal-sm logout-confirm-modal">
            <div class="logout-confirm-icon">🚪</div>
            <h2>Logout Confirmation</h2>
            <p class="logout-confirm-message">Are you sure you want to logout?</p>
            <div class="logout-confirm-actions">
                <button class="btn btn-secondary" id="logoutCancelBtn">
                    <span>✖</span> No
                </button>
                <button class="btn btn-danger" id="logoutConfirmBtn">
                    <span>✔</span> Yes
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('logoutConfirmBtn').addEventListener('click', () => {
        closeLogoutModal();
        performLogout();
    });

    document.getElementById('logoutCancelBtn').addEventListener('click', closeLogoutModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeLogoutModal();
    });
}

// Close logout confirmation modal
function closeLogoutModal() {
    const modal = document.getElementById('logoutConfirmModal');
    if (modal) modal.remove();
}

// Get current user
function getCurrentUser() {
    return sessionStorage.getItem('currentUser');
}

// Get auth token for API calls
function getAuthToken() {
    return sessionStorage.getItem('authToken');
}

// ===== Auth Page Specific Code =====
// Initialize admin on page load
initializeAdmin();

// Fetch profile from backend
async function fetchUserProfile() {
    const authToken = getAuthToken();
    if (!authToken) return { success: false, error: 'No auth token' };

    try {
        const response = await fetch(`${API_URL}/users/profile`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Sync local storage with backend data
            const users = getUsers();
            const currentUser = getCurrentUser();
            if (currentUser && users[currentUser.toLowerCase()]) {
                const userKey = currentUser.toLowerCase();
                users[userKey].gallery = data.gallery || [];
                users[userKey].profilePicture = data.profilePicture;
                users[userKey].displayName = data.displayName;
                users[userKey].email = data.email;
                users[userKey].phone = data.phone;
                saveUsers(users);
            }
            
            return { success: true, user: data };
        }
        return { success: false, error: 'Failed to fetch backend profile' };
    } catch (err) {
        console.error('Fetch profile error:', err);
        return { success: false, error: err.message };
    }
}

// Export functions for use in main.js and admin.js
export { 
    isLoggedIn, logout, getCurrentUser, isAdmin, 
    getAllUsers, deleteUser, toggleAdminStatus, 
    updateUser, getAuthToken, fetchUserProfile,
    loginUser, registerUser, sendResetCode, resetPasswordWithCode,
    saveCredentials, loadCredentials, clearCredentials
};
