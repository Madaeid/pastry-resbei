import '../css/style.css';
import { initLanguage } from './language.js';
import { countries, Country } from '../utils/countries';
import {
    loginUser, registerUser, sendResetCode, resetPasswordWithCode,
    saveCredentials, loadCredentials, clearCredentials,
    isLoggedIn, isAdmin
} from './auth.js';

const API_URL = '/api';

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
    const registerForm = document.getElementById('registerForm') as HTMLFormElement | null;
    const authMessage = document.getElementById('authMessage') as HTMLElement | null;
    const rememberMeCheckbox = document.getElementById('rememberMe') as HTMLInputElement | null;

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
        (document.getElementById('loginUsername') as HTMLInputElement).value = savedCredentials.username;
        (document.getElementById('loginPassword') as HTMLInputElement).value = savedCredentials.password;
        if (rememberMeCheckbox) {
            rememberMeCheckbox.checked = true;
        }
    }

    // ===== Country Selector for Phone Number =====
    // Countries array is now imported from utils/countries.ts

    let selectedCountry = countries.find((c: Country) => c.code === 'US') || countries[0];

    const countrySelector = document.getElementById('countrySelector') as HTMLElement | null;
    const countrySelected = document.getElementById('countrySelected') as HTMLElement | null;
    const countrySearch = document.getElementById('countrySearch') as HTMLInputElement | null;
    const countryList = document.getElementById('countryList') as HTMLElement | null;
    const registerPhoneInput = document.getElementById('registerPhone') as HTMLInputElement | null;
    const fullPhoneNumber = document.getElementById('fullPhoneNumber') as HTMLInputElement | null;

    // Initialize country selector if elements exist
    if (countrySelector && countryList) {
        // Populate country list
        function renderCountryList(filter = '') {
            if (!countryList) return;
            const filtered = countries.filter((c: Country) =>
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

            countryList.innerHTML = filtered.map((country: Country) => `
                <div class="country-item ${country.code === selectedCountry.code ? 'selected' : ''}" 
                     data-code="${country.code}">
                    <span class="country-flag">${country.flag}</span>
                    <span class="country-name">${country.name}</span>
                    <span class="country-dial-code">${country.dialCode}</span>
                </div>
            `).join('');

            // Add click handlers to country items
            countryList.querySelectorAll('.country-item').forEach(item => {
                item.addEventListener('click', function (this: HTMLElement) {
                    const code = this.dataset.code;
                    selectedCountry = countries.find((c: Country) => c.code === code) || countries[0];
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
            if (countrySelector) countrySelector.classList.add('open');
            if (countrySearch) {
                countrySearch.value = '';
                countrySearch.focus();
            }
            renderCountryList();
        }

        // Close dropdown
        function closeDropdown() {
            if (countrySelector) countrySelector.classList.remove('open');
        }

        // Toggle dropdown on selected click
        if (countrySelected) {
            countrySelected.addEventListener('click', function (e) {
                e.stopPropagation();
                if (countrySelector && countrySelector.classList.contains('open')) {
                    closeDropdown();
                } else {
                    openDropdown();
                }
            });
        }

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
        document.addEventListener('click', function (e: MouseEvent) {
            if (!countrySelector.contains(e.target as Node | null)) {
                closeDropdown();
            }
        });

        // Close dropdown on Escape key
        document.addEventListener('keydown', function (e: KeyboardEvent) {
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
        toggle.addEventListener('click', function (this: HTMLElement) {
            const targetId = this.dataset.target;
            if (!targetId) return;
            const passwordInput = document.getElementById(targetId) as HTMLInputElement | null;
            const eyeIcon = this.querySelector('.eye-icon');
            if (!eyeIcon) return;

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
    function showMessage(message: string, type: string) {
        if (!authMessage) return;
        authMessage.textContent = message;
        authMessage.className = `auth-message ${type}`;
        authMessage.style.display = 'block';
    }

    function hideMessage() {
        if (!authMessage) return;
        authMessage.style.display = 'none';
    }

    // Tab Navigation
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = (tab as HTMLElement).dataset.tab;

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
        link.addEventListener('click', (e: Event) => {
            e.preventDefault();
            const targetTab = (link as HTMLElement).dataset.target;

            // Handle switching back from Forgot Password page
            if (targetTab === 'login') {
                const forgotPassword = document.getElementById('forgot-password');
                if (forgotPassword) forgotPassword.classList.remove('active');

                // Reset form state
                const resetStep1 = document.getElementById('resetStep1');
                const resetStep2 = document.getElementById('resetStep2');
                const forgotPasswordForm = document.getElementById('forgotPasswordForm') as HTMLFormElement | null;

                if (resetStep1) resetStep1.style.display = 'block';
                if (resetStep2) resetStep2.style.display = 'none';
                if (forgotPasswordForm) forgotPasswordForm.reset();

                // Ensure tabs are visible again
                const authTabsContainer = document.querySelector('.auth-tabs') as HTMLElement | null;
                if (authTabsContainer) authTabsContainer.style.display = 'flex';
            }

            // Find and click the corresponding tab
            const tabToClick = document.querySelector(`.auth-tab[data-tab="${targetTab}"]`) as HTMLElement | null;
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
            authContents.forEach(c => (c as HTMLElement).classList.remove('active'));
            // Hide tabs to avoid confusion
            const tabs = document.querySelector('.auth-tabs') as HTMLElement | null;
            if (tabs) tabs.style.display = 'none';
            // Show forgot password form
            const forgotPwd = document.getElementById('forgot-password');
            if (forgotPwd) forgotPwd.classList.add('active');
            hideMessage();
        });
    }

    // Login Form Handler
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e: Event) {
            e.preventDefault();

            const username = (document.getElementById('loginUsername') as HTMLInputElement).value.trim();
            const password = (document.getElementById('loginPassword') as HTMLInputElement).value;
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
                        window.location.href = '../index.html#home';
                    }
                }, 1000);
            } else {
                showMessage(result.error || 'Login failed', 'error');
            }
        });
    }

    // Register Form Handler
    if (registerForm) {
        registerForm.addEventListener('submit', async function (e: Event) {
            e.preventDefault();

            const username = (document.getElementById('registerUsername') as HTMLInputElement).value.trim();
            const email = (document.getElementById('registerEmail') as HTMLInputElement).value.trim();
            // Use full phone number with country code if available
            const fullPhoneInput = document.getElementById('fullPhoneNumber') as HTMLInputElement | null;
            const phoneInput = (document.getElementById('registerPhone') as HTMLInputElement).value.trim();
            const phone = fullPhoneInput && fullPhoneInput.value ? fullPhoneInput.value : phoneInput;
            const birthday = (document.getElementById('registerBirthday') as HTMLInputElement).value;
            const password = (document.getElementById('registerPassword') as HTMLInputElement).value;
            const confirmPassword = (document.getElementById('confirmPassword') as HTMLInputElement).value;

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
                    const loginTab = document.querySelector('[data-tab="login"]') as HTMLElement | null;
                    if (loginTab) loginTab.click();
                    (document.getElementById('loginUsername') as HTMLInputElement).value = username;
                    (document.getElementById('loginPassword') as HTMLInputElement).focus();
                }, 1500);

                // Clear register form
                registerForm.reset();
            } else {
                showMessage(result.error || 'Registration failed', 'error');
            }
        });
    }

    // Forgot Password Form Handler
    const forgotPasswordForm = document.getElementById('forgotPasswordForm') as HTMLFormElement | null;
    const sendCodeBtn = document.getElementById('sendCodeBtn') as HTMLButtonElement | null;
    const resendCodeBtn = document.getElementById('resendCodeBtn') as HTMLButtonElement | null;
    const methodEmailBtn = document.getElementById('methodEmail') as HTMLElement | null;
    const methodPhoneBtn = document.getElementById('methodPhone') as HTMLElement | null;
    const emailInputGroup = document.getElementById('emailInputGroup') as HTMLElement | null;
    const phoneInputGroup = document.getElementById('phoneInputGroup') as HTMLElement | null;
    const sendCodeIcon = document.getElementById('sendCodeIcon') as HTMLElement | null;
    const sendCodeText = document.getElementById('sendCodeText') as HTMLElement | null;
    const otpSentMessage = document.getElementById('otpSentMessage') as HTMLElement | null;

    let selectedMethod = 'email';
    let resendCooldown = 0;
    let resendInterval: ReturnType<typeof setInterval> | null = null;

    // Method selector handlers
    if (methodEmailBtn && methodPhoneBtn && emailInputGroup && phoneInputGroup && sendCodeIcon && sendCodeText) {
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

    if (methodPhoneBtn && methodEmailBtn && phoneInputGroup && emailInputGroup && sendCodeIcon && sendCodeText) {
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
        const username = (document.getElementById('resetUsername') as HTMLInputElement).value.trim();
        let contactValue = '';

        if (selectedMethod === 'email') {
            contactValue = (document.getElementById('resetEmail') as HTMLInputElement).value.trim();
            if (!contactValue) {
                showMessage('Please enter your email address', 'error');
                return;
            }
        } else {
            contactValue = (document.getElementById('resetPhone') as HTMLInputElement).value.trim();
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
            const rs1 = document.getElementById('resetStep1');
            const rs2 = document.getElementById('resetStep2');
            if (rs1) rs1.style.display = 'none';
            if (rs2) rs2.style.display = 'block';

            // Start resend cooldown (60 seconds)
            startResendCooldown(60);
        } else {
            showMessage(result.error || 'Failed to send code', 'error');
        }
    }

    // Resend cooldown function
    function startResendCooldown(seconds: number) {
        resendCooldown = seconds;
        const resendText = document.getElementById('resendText');

        if (resendCodeBtn) resendCodeBtn.disabled = true;

        if (resendInterval) clearInterval(resendInterval as any);

        resendInterval = setInterval(() => {
            resendCooldown--;
            if (resendText) {
                resendText.textContent = `Resend Code (${resendCooldown}s)`;
            }

            if (resendCooldown <= 0) {
                if (resendInterval) clearInterval(resendInterval as any);
                if (resendCodeBtn) resendCodeBtn.disabled = false;
                if (resendText) resendText.textContent = 'Resend Code';
            }
        }, 1000) as unknown as ReturnType<typeof setInterval>;
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
        forgotPasswordForm.addEventListener('submit', async function (e: Event) {
            e.preventDefault();

            const username = (document.getElementById('resetUsername') as HTMLInputElement).value.trim();
            const code = (document.getElementById('resetCode') as HTMLInputElement).value.trim();
            const newPassword = (document.getElementById('newPassword') as HTMLInputElement).value;
            const confirmNewPassword = (document.getElementById('confirmNewPassword') as HTMLInputElement).value;

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
                    const forgotPassword = document.getElementById('forgot-password');
                    if (forgotPassword) forgotPassword.classList.remove('active');
                    const authTabs = document.querySelector('.auth-tabs') as HTMLElement | null;
                    if (authTabs) authTabs.style.display = 'flex';
                    const loginTab = document.querySelector('[data-tab="login"]') as HTMLElement | null;
                    if (loginTab) loginTab.click();

                    (document.getElementById('loginUsername') as HTMLInputElement).value = username;
                    (document.getElementById('loginPassword') as HTMLInputElement).focus();

                    // Reset form state
                    const resetStep1 = document.getElementById('resetStep1');
                    const resetStep2 = document.getElementById('resetStep2');
                    if (resetStep1) resetStep1.style.display = 'block';
                    if (resetStep2) resetStep2.style.display = 'none';
                    forgotPasswordForm.reset();

                    // Reset method selection
                    selectedMethod = 'email';
                    if (methodEmailBtn) methodEmailBtn.classList.add('active');
                    if (methodPhoneBtn) methodPhoneBtn.classList.remove('active');
                    if (emailInputGroup) emailInputGroup.style.display = 'block';
                    if (phoneInputGroup) phoneInputGroup.style.display = 'none';
                }, 2000);
            } else {
                showMessage(result.error || 'Reset failed', 'error');
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
            const handleMessage = async (event: MessageEvent) => {
                if (event.data?.type === 'google-auth-success') {
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
                            window.location.href = '../index.html#home';
                        }
                    }, 1000);
                } else if (event.data?.type === 'google-auth-error') {
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
            const handleMessage = async (event: MessageEvent) => {
                if (event.data?.type === 'apple-auth-success') {
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
                            window.location.href = '../index.html#home';
                        }
                    }, 1000);
                } else if (event.data?.type === 'apple-auth-error') {
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
