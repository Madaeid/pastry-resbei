// Authentication Module for Chef Book
import './style.css';
import { initLanguage, t, getCurrentLanguage } from './language.js';

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

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

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

// Only run DOM-related code if we're on auth.html (loginForm exists)
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    initAuthPage();
}

function initAuthPage() {
    // Initialize language system
    initLanguage();

    // DOM Elements - only available on auth.html
    const authTabs = document.querySelectorAll('.auth-tab');
    const authContents = document.querySelectorAll('.auth-form-content');
    const registerForm = document.getElementById('registerForm');
    const authMessage = document.getElementById('authMessage');
    const rememberMeCheckbox = document.getElementById('rememberMe');

    // Check if already logged in - redirect appropriately
    // Check if already logged in - redirect appropriately
    if (isLoggedIn()) {
        const returnUrl = sessionStorage.getItem('returnUrl');
        if (returnUrl) {
            sessionStorage.removeItem('returnUrl');
            window.location.href = returnUrl;
            return;
        }

        if (isAdmin()) {
            window.location.href = './admin.html';
        } else {
            window.location.href = './index.html#home';
        }
        return;
    }

    // Auto-fill credentials if Remember Me was checked
    const savedCredentials = loadCredentials();
    if (savedCredentials) {
        document.getElementById('loginUsername').value = savedCredentials.username;
        document.getElementById('loginPassword').value = savedCredentials.password;
        if (rememberMeCheckbox) {
            rememberMeCheckbox.checked = true;
        }
    }

    // ===== Country Selector for Phone Number =====
    const countries = [
        { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸' },
        { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧' },
        { name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦' },
        { name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺' },
        { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪' },
        { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷' },
        { name: 'Italy', code: 'IT', dialCode: '+39', flag: '🇮🇹' },
        { name: 'Spain', code: 'ES', dialCode: '+34', flag: '🇪🇸' },
        { name: 'Netherlands', code: 'NL', dialCode: '+31', flag: '🇳🇱' },
        { name: 'Belgium', code: 'BE', dialCode: '+32', flag: '🇧🇪' },
        { name: 'Switzerland', code: 'CH', dialCode: '+41', flag: '🇨🇭' },
        { name: 'Austria', code: 'AT', dialCode: '+43', flag: '🇦🇹' },
        { name: 'Sweden', code: 'SE', dialCode: '+46', flag: '🇸🇪' },
        { name: 'Norway', code: 'NO', dialCode: '+47', flag: '🇳🇴' },
        { name: 'Denmark', code: 'DK', dialCode: '+45', flag: '🇩🇰' },
        { name: 'Finland', code: 'FI', dialCode: '+358', flag: '🇫🇮' },
        { name: 'Poland', code: 'PL', dialCode: '+48', flag: '🇵🇱' },
        { name: 'Portugal', code: 'PT', dialCode: '+351', flag: '🇵🇹' },
        { name: 'Ireland', code: 'IE', dialCode: '+353', flag: '🇮🇪' },
        { name: 'Greece', code: 'GR', dialCode: '+30', flag: '🇬🇷' },
        { name: 'Russia', code: 'RU', dialCode: '+7', flag: '🇷🇺' },
        { name: 'Ukraine', code: 'UA', dialCode: '+380', flag: '🇺🇦' },
        { name: 'Turkey', code: 'TR', dialCode: '+90', flag: '🇹🇷' },
        { name: 'Saudi Arabia', code: 'SA', dialCode: '+966', flag: '🇸🇦' },
        { name: 'United Arab Emirates', code: 'AE', dialCode: '+971', flag: '🇦🇪' },
        { name: 'Qatar', code: 'QA', dialCode: '+974', flag: '🇶🇦' },
        { name: 'Kuwait', code: 'KW', dialCode: '+965', flag: '🇰🇼' },
        { name: 'Bahrain', code: 'BH', dialCode: '+973', flag: '🇧🇭' },
        { name: 'Oman', code: 'OM', dialCode: '+968', flag: '🇴🇲' },
        { name: 'Jordan', code: 'JO', dialCode: '+962', flag: '🇯🇴' },
        { name: 'Lebanon', code: 'LB', dialCode: '+961', flag: '🇱🇧' },
        { name: 'Iraq', code: 'IQ', dialCode: '+964', flag: '🇮🇶' },
        { name: 'Egypt', code: 'EG', dialCode: '+20', flag: '🇪🇬' },
        { name: 'Morocco', code: 'MA', dialCode: '+212', flag: '🇲🇦' },
        { name: 'Algeria', code: 'DZ', dialCode: '+213', flag: '🇩🇿' },
        { name: 'Tunisia', code: 'TN', dialCode: '+216', flag: '🇹🇳' },
        { name: 'Libya', code: 'LY', dialCode: '+218', flag: '🇱🇾' },
        { name: 'Sudan', code: 'SD', dialCode: '+249', flag: '🇸🇩' },
        { name: 'South Africa', code: 'ZA', dialCode: '+27', flag: '🇿🇦' },
        { name: 'Nigeria', code: 'NG', dialCode: '+234', flag: '🇳🇬' },
        { name: 'Kenya', code: 'KE', dialCode: '+254', flag: '🇰🇪' },
        { name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳' },
        { name: 'Pakistan', code: 'PK', dialCode: '+92', flag: '🇵🇰' },
        { name: 'Bangladesh', code: 'BD', dialCode: '+880', flag: '🇧🇩' },
        { name: 'China', code: 'CN', dialCode: '+86', flag: '🇨🇳' },
        { name: 'Japan', code: 'JP', dialCode: '+81', flag: '🇯🇵' },
        { name: 'South Korea', code: 'KR', dialCode: '+82', flag: '🇰🇷' },
        { name: 'Indonesia', code: 'ID', dialCode: '+62', flag: '🇮🇩' },
        { name: 'Malaysia', code: 'MY', dialCode: '+60', flag: '🇲🇾' },
        { name: 'Singapore', code: 'SG', dialCode: '+65', flag: '🇸🇬' },
        { name: 'Thailand', code: 'TH', dialCode: '+66', flag: '🇹🇭' },
        { name: 'Vietnam', code: 'VN', dialCode: '+84', flag: '🇻🇳' },
        { name: 'Philippines', code: 'PH', dialCode: '+63', flag: '🇵🇭' },
        { name: 'Brazil', code: 'BR', dialCode: '+55', flag: '🇧🇷' },
        { name: 'Mexico', code: 'MX', dialCode: '+52', flag: '🇲🇽' },
        { name: 'Argentina', code: 'AR', dialCode: '+54', flag: '🇦🇷' },
        { name: 'Colombia', code: 'CO', dialCode: '+57', flag: '🇨🇴' },
        { name: 'Chile', code: 'CL', dialCode: '+56', flag: '🇨🇱' },
        { name: 'Peru', code: 'PE', dialCode: '+51', flag: '🇵🇪' },
        { name: 'Venezuela', code: 'VE', dialCode: '+58', flag: '🇻🇪' },
        { name: 'New Zealand', code: 'NZ', dialCode: '+64', flag: '🇳🇿' },
        { name: 'Israel', code: 'IL', dialCode: '+972', flag: '🇮🇱' },
        { name: 'Palestine', code: 'PS', dialCode: '+970', flag: '🇵🇸' },
        { name: 'Syria', code: 'SY', dialCode: '+963', flag: '🇸🇾' },
        { name: 'Yemen', code: 'YE', dialCode: '+967', flag: '🇾🇪' },
        { name: 'Iran', code: 'IR', dialCode: '+98', flag: '🇮🇷' },
        { name: 'Afghanistan', code: 'AF', dialCode: '+93', flag: '🇦🇫' }
    ];

    // Sort countries alphabetically
    countries.sort((a, b) => a.name.localeCompare(b.name));

    let selectedCountry = countries.find(c => c.code === 'US') || countries[0];

    const countrySelector = document.getElementById('countrySelector');
    const countrySelected = document.getElementById('countrySelected');
    const countryDropdown = document.getElementById('countryDropdown');
    const countrySearch = document.getElementById('countrySearch');
    const countryList = document.getElementById('countryList');
    const registerPhoneInput = document.getElementById('registerPhone');
    const fullPhoneNumber = document.getElementById('fullPhoneNumber');

    // Initialize country selector if elements exist
    if (countrySelector && countryList) {
        // Populate country list
        function renderCountryList(filter = '') {
            const filtered = countries.filter(c =>
                c.name.toLowerCase().includes(filter.toLowerCase()) ||
                c.dialCode.includes(filter)
            );

            if (filtered.length === 0) {
                countryList.innerHTML = `
                    <div class="no-results">
                        <span>🔍</span>
                        No countries found
                    </div>
                `;
                return;
            }

            countryList.innerHTML = filtered.map(country => `
                <div class="country-item ${country.code === selectedCountry.code ? 'selected' : ''}" 
                     data-code="${country.code}">
                    <span class="country-flag">${country.flag}</span>
                    <span class="country-name">${country.name}</span>
                    <span class="country-dial-code">${country.dialCode}</span>
                </div>
            `).join('');

            // Add click handlers to country items
            countryList.querySelectorAll('.country-item').forEach(item => {
                item.addEventListener('click', function () {
                    const code = this.dataset.code;
                    selectedCountry = countries.find(c => c.code === code);
                    updateSelectedDisplay();
                    closeDropdown();
                    if (registerPhoneInput) registerPhoneInput.focus();
                });
            });
        }

        // Update the selected country display
        function updateSelectedDisplay() {
            if (countrySelected) {
                countrySelected.innerHTML = `
                    <span class="country-flag">${selectedCountry.flag}</span>
                    <span class="country-code">${selectedCountry.dialCode}</span>
                    <span class="dropdown-arrow">▼</span>
                `;
            }
            updateFullPhoneNumber();
        }

        // Update full phone number hidden field
        function updateFullPhoneNumber() {
            if (fullPhoneNumber && registerPhoneInput) {
                const phoneValue = registerPhoneInput.value.replace(/^0+/, ''); // Remove leading zeros
                fullPhoneNumber.value = selectedCountry.dialCode + phoneValue;
            }
        }

        // Open dropdown
        function openDropdown() {
            countrySelector.classList.add('open');
            if (countrySearch) {
                countrySearch.value = '';
                countrySearch.focus();
            }
            renderCountryList();
        }

        // Close dropdown
        function closeDropdown() {
            countrySelector.classList.remove('open');
        }

        // Toggle dropdown on selected click
        countrySelected.addEventListener('click', function (e) {
            e.stopPropagation();
            if (countrySelector.classList.contains('open')) {
                closeDropdown();
            } else {
                openDropdown();
            }
        });

        // Search functionality
        if (countrySearch) {
            countrySearch.addEventListener('input', function () {
                renderCountryList(this.value);
            });

            countrySearch.addEventListener('click', function (e) {
                e.stopPropagation();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', function (e) {
            if (!countrySelector.contains(e.target)) {
                closeDropdown();
            }
        });

        // Close dropdown on Escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                closeDropdown();
            }
        });

        // Update full phone number when phone input changes
        if (registerPhoneInput) {
            registerPhoneInput.addEventListener('input', updateFullPhoneNumber);
        }

        // Initial render
        renderCountryList();
        updateSelectedDisplay();
    }


    // ===== Password Visibility Toggle =====
    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function () {
            const targetId = this.dataset.target;
            const passwordInput = document.getElementById(targetId);
            const eyeIcon = this.querySelector('.eye-icon');

            if (passwordInput) {
                if (passwordInput.type === 'password') {
                    // Show password
                    passwordInput.type = 'text';
                    eyeIcon.textContent = '🙈'; // Closed eye
                    this.classList.add('visible');
                    this.setAttribute('aria-label', 'Hide password');
                } else {
                    // Hide password
                    passwordInput.type = 'password';
                    eyeIcon.textContent = '👁️'; // Open eye
                    this.classList.remove('visible');
                    this.setAttribute('aria-label', 'Show password');
                }
            }
        });
    });

    // UI Helper Functions
    function showMessage(message, type) {
        authMessage.textContent = message;
        authMessage.className = `auth-message ${type}`;
        authMessage.style.display = 'block';
    }

    function hideMessage() {
        authMessage.style.display = 'none';
    }

    // Tab Navigation
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            // Update active tab
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show corresponding content
            authContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetTab) {
                    content.classList.add('active');
                }
            });

            // Clear messages
            hideMessage();
        });
    });

    // Switch Auth Links
    const switchLinks = document.querySelectorAll('.switch-auth');
    switchLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = link.dataset.target;

            // Handle switching back from Forgot Password page
            if (targetTab === 'login') {
                document.getElementById('forgot-password').classList.remove('active');
                // Reset form state
                document.getElementById('resetStep1').style.display = 'block';
                document.getElementById('resetStep2').style.display = 'none';
                document.getElementById('forgotPasswordForm').reset();

                // Ensure tabs are visible again
                document.querySelector('.auth-tabs').style.display = 'flex';
            }

            // Find and click the corresponding tab
            const tabToClick = document.querySelector(`.auth-tab[data-tab="${targetTab}"]`);
            if (tabToClick) {
                tabToClick.click();
            }
        });
    });

    // Forgot Password Link Handler
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Hide all content
            authContents.forEach(c => c.classList.remove('active'));
            // Hide tabs to avoid confusion
            document.querySelector('.auth-tabs').style.display = 'none';
            // Show forgot password form
            document.getElementById('forgot-password').classList.add('active');
            hideMessage();
        });
    }

    // Login Form Handler
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : false;

        const result = await loginUser(username, password);

        if (result.success) {
            // Handle Remember Me
            if (rememberMe) {
                saveCredentials(username, password);
            } else {
                clearCredentials();
            }

            showMessage('Login successful! Redirecting...', 'success');
            setTimeout(() => {
                // Check for return URL
                const returnUrl = sessionStorage.getItem('returnUrl');
                if (returnUrl) {
                    sessionStorage.removeItem('returnUrl');
                    window.location.href = returnUrl;
                    return;
                }

                // Redirect admin to admin dashboard, others to home page
                if (result.isAdmin) {
                    window.location.href = './admin.html';
                } else {
                    window.location.href = './index.html#home';
                }
            }, 1000);
        } else {
            showMessage(result.error, 'error');
        }
    });

    // Register Form Handler
    registerForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('registerUsername').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        // Use full phone number with country code if available
        const fullPhoneInput = document.getElementById('fullPhoneNumber');
        const phoneInput = document.getElementById('registerPhone').value.trim();
        const phone = fullPhoneInput && fullPhoneInput.value ? fullPhoneInput.value : phoneInput;
        const birthday = document.getElementById('registerBirthday').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validate password match
        if (password !== confirmPassword) {
            showMessage('Passwords do not match!', 'error');
            return;
        }

        const result = await registerUser(username, email, phone, birthday, password);

        if (result.success) {
            showMessage('Account created! You can now sign in.', 'success');

            // Switch to login tab
            setTimeout(() => {
                document.querySelector('[data-tab="login"]').click();
                document.getElementById('loginUsername').value = username;
                document.getElementById('loginPassword').focus();
            }, 1500);

            // Clear register form
            registerForm.reset();
        } else {
            showMessage(result.error, 'error');
        }
    });

    // Forgot Password Form Handler
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    const resendCodeBtn = document.getElementById('resendCodeBtn');
    const methodEmailBtn = document.getElementById('methodEmail');
    const methodPhoneBtn = document.getElementById('methodPhone');
    const emailInputGroup = document.getElementById('emailInputGroup');
    const phoneInputGroup = document.getElementById('phoneInputGroup');
    const sendCodeIcon = document.getElementById('sendCodeIcon');
    const sendCodeText = document.getElementById('sendCodeText');
    const otpSentMessage = document.getElementById('otpSentMessage');

    let selectedMethod = 'email';
    let resendCooldown = 0;
    let resendInterval = null;

    // Method selector handlers
    if (methodEmailBtn) {
        methodEmailBtn.addEventListener('click', function () {
            selectedMethod = 'email';
            methodEmailBtn.classList.add('active');
            methodPhoneBtn.classList.remove('active');
            emailInputGroup.style.display = 'block';
            phoneInputGroup.style.display = 'none';
            sendCodeIcon.textContent = '📧';
            sendCodeText.textContent = 'Send OTP to Email';
        });
    }

    if (methodPhoneBtn) {
        methodPhoneBtn.addEventListener('click', function () {
            selectedMethod = 'phone';
            methodPhoneBtn.classList.add('active');
            methodEmailBtn.classList.remove('active');
            phoneInputGroup.style.display = 'block';
            emailInputGroup.style.display = 'none';
            sendCodeIcon.textContent = '📱';
            sendCodeText.textContent = 'Send OTP to Phone';
        });
    }

    // Function to send code
    function handleSendCode() {
        const username = document.getElementById('resetUsername').value.trim();
        let contactValue = '';

        if (selectedMethod === 'email') {
            contactValue = document.getElementById('resetEmail').value.trim();
            if (!contactValue) {
                showMessage('Please enter your email address', 'error');
                return;
            }
        } else {
            contactValue = document.getElementById('resetPhone').value.trim();
            if (!contactValue) {
                showMessage('Please enter your phone number', 'error');
                return;
            }
        }

        if (!username) {
            showMessage('Please enter your username', 'error');
            return;
        }

        const result = sendResetCode(username, contactValue, selectedMethod);
        if (result.success) {
            const methodLabel = selectedMethod === 'email' ? 'email' : 'phone';
            showMessage(`Verification code sent to your ${methodLabel}!`, 'success');

            // Update message in step 2
            if (otpSentMessage) {
                otpSentMessage.textContent = `We sent a 6-digit code to ${result.maskedContact}`;
            }

            // Switch to step 2
            document.getElementById('resetStep1').style.display = 'none';
            document.getElementById('resetStep2').style.display = 'block';

            // Start resend cooldown (60 seconds)
            startResendCooldown(60);
        } else {
            showMessage(result.error, 'error');
        }
    }

    // Resend cooldown function
    function startResendCooldown(seconds) {
        resendCooldown = seconds;
        const resendText = document.getElementById('resendText');

        if (resendCodeBtn) resendCodeBtn.disabled = true;

        if (resendInterval) clearInterval(resendInterval);

        resendInterval = setInterval(() => {
            resendCooldown--;
            if (resendText) {
                resendText.textContent = `Resend Code (${resendCooldown}s)`;
            }

            if (resendCooldown <= 0) {
                clearInterval(resendInterval);
                if (resendCodeBtn) resendCodeBtn.disabled = false;
                if (resendText) resendText.textContent = 'Resend Code';
            }
        }, 1000);
    }

    if (sendCodeBtn) {
        sendCodeBtn.addEventListener('click', handleSendCode);
    }

    // Resend code handler
    if (resendCodeBtn) {
        resendCodeBtn.addEventListener('click', function () {
            // Go back to step 1 to change method if needed, or resend
            handleSendCode();
        });
    }

    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const username = document.getElementById('resetUsername').value.trim();
            const code = document.getElementById('resetCode').value.trim();
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;

            // Validate passwords match
            if (newPassword !== confirmNewPassword) {
                showMessage('Passwords do not match', 'error');
                return;
            }

            if (newPassword.length < 4) {
                showMessage('Password must be at least 4 characters', 'error');
                return;
            }

            const result = await resetPasswordWithCode(username, code, newPassword);

            if (result.success) {
                showMessage('Password reset successfully! Please login.', 'success');

                // Clear cooldown
                if (resendInterval) clearInterval(resendInterval);

                setTimeout(() => {
                    // Switch back to login
                    document.getElementById('forgot-password').classList.remove('active');
                    document.querySelector('.auth-tabs').style.display = 'flex';
                    document.querySelector('[data-tab="login"]').click();

                    document.getElementById('loginUsername').value = username;
                    document.getElementById('loginPassword').focus();

                    // Reset form state
                    document.getElementById('resetStep1').style.display = 'block';
                    document.getElementById('resetStep2').style.display = 'none';
                    forgotPasswordForm.reset();

                    // Reset method selection
                    selectedMethod = 'email';
                    if (methodEmailBtn) methodEmailBtn.classList.add('active');
                    if (methodPhoneBtn) methodPhoneBtn.classList.remove('active');
                    if (emailInputGroup) emailInputGroup.style.display = 'block';
                    if (phoneInputGroup) phoneInputGroup.style.display = 'none';
                }, 2000);
            } else {
                showMessage(result.error, 'error');
            }
        });
    }

    // ===== Social Login Handlers =====
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const googleRegisterBtn = document.getElementById('googleRegisterBtn');
    const appleLoginBtn = document.getElementById('appleLoginBtn');
    const appleRegisterBtn = document.getElementById('appleRegisterBtn');

    // Google OAuth Handler
    async function handleGoogleAuth(isLogin = true) {
        const btn = isLogin ? googleLoginBtn : googleRegisterBtn;
        if (btn) btn.classList.add('loading');

        try {
            // Open Google OAuth popup
            const width = 500;
            const height = 600;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;

            const popup = window.open(
                `${API_URL}/auth/google`,
                'Google Sign In',
                `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
            );

            // Listen for message from popup
            const handleMessage = async (event) => {
                if (event.data.type === 'google-auth-success') {
                    window.removeEventListener('message', handleMessage);

                    // Set session data
                    sessionStorage.setItem('currentUser', event.data.user.username);
                    sessionStorage.setItem('isAdmin', event.data.user.isAdmin ? 'true' : 'false');
                    if (event.data.token) {
                        sessionStorage.setItem('authToken', event.data.token);
                    }

                    showMessage('Login successful! Redirecting...', 'success');
                    setTimeout(() => {
                        const returnUrl = sessionStorage.getItem('returnUrl');
                        if (returnUrl) {
                            sessionStorage.removeItem('returnUrl');
                            window.location.href = returnUrl;
                        } else if (event.data.user.isAdmin) {
                            window.location.href = './admin.html';
                        } else {
                            window.location.href = './index.html#home';
                        }
                    }, 1000);
                } else if (event.data.type === 'google-auth-error') {
                    window.removeEventListener('message', handleMessage);
                    showMessage(event.data.error || 'Google sign in failed', 'error');
                }
            };

            window.addEventListener('message', handleMessage);

            // Check if popup closed without completing
            const checkPopup = setInterval(() => {
                if (popup && popup.closed) {
                    clearInterval(checkPopup);
                    window.removeEventListener('message', handleMessage);
                    if (btn) btn.classList.remove('loading');
                }
            }, 500);

        } catch (error) {
            console.error('Google auth error:', error);
            showMessage('Google sign in is not available. Please use email registration.', 'error');
        } finally {
            if (btn) btn.classList.remove('loading');
        }
    }

    // Apple OAuth Handler  
    async function handleAppleAuth(isLogin = true) {
        const btn = isLogin ? appleLoginBtn : appleRegisterBtn;
        if (btn) btn.classList.add('loading');

        try {
            // Open Apple OAuth popup
            const width = 500;
            const height = 600;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;

            const popup = window.open(
                `${API_URL}/auth/apple`,
                'Apple Sign In',
                `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
            );

            // Listen for message from popup
            const handleMessage = async (event) => {
                if (event.data.type === 'apple-auth-success') {
                    window.removeEventListener('message', handleMessage);

                    // Set session data
                    sessionStorage.setItem('currentUser', event.data.user.username);
                    sessionStorage.setItem('isAdmin', event.data.user.isAdmin ? 'true' : 'false');
                    if (event.data.token) {
                        sessionStorage.setItem('authToken', event.data.token);
                    }

                    showMessage('Login successful! Redirecting...', 'success');
                    setTimeout(() => {
                        const returnUrl = sessionStorage.getItem('returnUrl');
                        if (returnUrl) {
                            sessionStorage.removeItem('returnUrl');
                            window.location.href = returnUrl;
                        } else if (event.data.user.isAdmin) {
                            window.location.href = './admin.html';
                        } else {
                            window.location.href = './index.html#home';
                        }
                    }, 1000);
                } else if (event.data.type === 'apple-auth-error') {
                    window.removeEventListener('message', handleMessage);
                    showMessage(event.data.error || 'Apple sign in failed', 'error');
                }
            };

            window.addEventListener('message', handleMessage);

            // Check if popup closed without completing
            const checkPopup = setInterval(() => {
                if (popup && popup.closed) {
                    clearInterval(checkPopup);
                    window.removeEventListener('message', handleMessage);
                    if (btn) btn.classList.remove('loading');
                }
            }, 500);

        } catch (error) {
            console.error('Apple auth error:', error);
            showMessage('Apple sign in is not available. Please use email registration.', 'error');
        } finally {
            if (btn) btn.classList.remove('loading');
        }
    }

    // Attach event listeners
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => handleGoogleAuth(true));
    }
    if (googleRegisterBtn) {
        googleRegisterBtn.addEventListener('click', () => handleGoogleAuth(false));
    }
    if (appleLoginBtn) {
        appleLoginBtn.addEventListener('click', () => handleAppleAuth(true));
    }
    if (appleRegisterBtn) {
        appleRegisterBtn.addEventListener('click', () => handleAppleAuth(false));
    }
}

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
    updateUser, getAuthToken, fetchUserProfile 
};
