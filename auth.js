// Authentication Module for Pastry Recipe Book
import './style.css';

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
        createdAt: users[key].createdAt
    }));
}

// Delete user (admin function)
function deleteUser(username) {
    if (username.toLowerCase() === 'admin') {
        return { success: false, error: 'Cannot delete admin user' };
    }

    const users = getUsers();
    if (!users[username.toLowerCase()]) {
        return { success: false, error: 'User not found' };
    }

    delete users[username.toLowerCase()];
    saveUsers(users);
    return { success: true };
}

// Toggle admin status (admin function)
function toggleAdminStatus(username) {
    if (username.toLowerCase() === 'admin') {
        return { success: false, error: 'Cannot modify main admin user' };
    }

    const users = getUsers();
    if (!users[username.toLowerCase()]) {
        return { success: false, error: 'User not found' };
    }

    users[username.toLowerCase()].isAdmin = !users[username.toLowerCase()].isAdmin;
    saveUsers(users);
    return { success: true, isAdmin: users[username.toLowerCase()].isAdmin };
    saveUsers(users);
    return { success: true, isAdmin: users[username.toLowerCase()].isAdmin };
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

    // 5. Handle Username Update (Renaming User)
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

        // If this is the currently logged-in user, update session
        if (sessionStorage.getItem('currentUser') === username.toLowerCase()) {
            sessionStorage.setItem('currentUser', newUsername);
        }
    }

    saveUsers(users);
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

    const users = getUsers();

    // Check if username exists
    if (users[username.toLowerCase()]) {
        return { success: false, error: 'Username already exists' };
    }

    // Check if email exists (simple iteration check)
    const emailExists = Object.values(users).some(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (emailExists) {
        return { success: false, error: 'Email already registered' };
    }

    // Check if phone exists
    const phoneExists = Object.values(users).some(u => u.phone && u.phone.replace(/\s/g, '') === phone.replace(/\s/g, ''));
    if (phoneExists) {
        return { success: false, error: 'Phone number already registered' };
    }

    // Hash password and save user
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
        alert(`📱 SIMULATED SMS\n\nTo: ${contactValue}\n\nYour My Recipe Book verification code is: ${code}\n\nThis code expires in 10 minutes.`);
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

    return { success: true, isAdmin: user.isAdmin || false };
}

// Check if user is logged in
function isLoggedIn() {
    return sessionStorage.getItem('currentUser') !== null;
}

// Logout user
function logout() {
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('isAdmin');
    window.location.href = './auth.html';
}

// Get current user
function getCurrentUser() {
    return sessionStorage.getItem('currentUser');
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
    // DOM Elements - only available on auth.html
    const authTabs = document.querySelectorAll('.auth-tab');
    const authContents = document.querySelectorAll('.auth-form-content');
    const registerForm = document.getElementById('registerForm');
    const authMessage = document.getElementById('authMessage');
    const rememberMeCheckbox = document.getElementById('rememberMe');

    // Check if already logged in - redirect appropriately
    if (isLoggedIn()) {
        if (isAdmin()) {
            window.location.href = './admin.html';
        } else {
            window.location.href = './index.html';
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
                // Redirect admin to admin dashboard, others to main page
                if (result.isAdmin) {
                    window.location.href = './admin.html';
                } else {
                    window.location.href = './index.html';
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
        const phone = document.getElementById('registerPhone').value.trim();
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
}

// Export functions for use in main.js and admin.js
export { isLoggedIn, logout, getCurrentUser, isAdmin, getAllUsers, deleteUser, toggleAdminStatus, updateUser };
