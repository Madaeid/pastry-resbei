// Payment Module for Pastry Recipe Book
import './style.css';
import { getCurrentUser, isAdmin, getAuthToken } from './auth.js';
import { initLanguage, t, getCurrentLanguage } from './language.js';

// API Configuration
const API_URL = 'http://localhost:3001/api';

// ===== Subscription Plans Configuration =====
const PLANS = {
    monthly: {
        id: 'monthly',
        name: 'Monthly',
        price: 3.00,
        originalPrice: 5.00,
        discount: 40, // 40% off
        period: 'month',
        durationDays: 30,
        displayPrice: '$3.00/month',
        originalDisplayPrice: '$5.00/month'
    },
    yearly: {
        id: 'yearly',
        name: 'Yearly',
        price: 39.99,
        period: 'year',
        durationDays: 365,
        displayPrice: '$39.99/year'
    },
    lifetime: {
        id: 'lifetime',
        name: 'Lifetime',
        price: 20.00,
        originalPrice: 100.00,
        discount: 80, // 80% off
        period: 'lifetime',
        durationDays: 36500, // ~100 years
        displayPrice: '$20.00 one-time',
        originalDisplayPrice: '$100.00'
    }
};

// ===== Subscription Data Functions =====

// Get subscription data for current user
function getSubscription() {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;

    const subscriptions = JSON.parse(localStorage.getItem('pastrySubscriptions') || '{}');
    return subscriptions[currentUser] || null;
}

// Save subscription for current user
function saveSubscription(subscriptionData) {
    const currentUser = getCurrentUser();
    if (!currentUser) return false;

    const subscriptions = JSON.parse(localStorage.getItem('pastrySubscriptions') || '{}');
    subscriptions[currentUser] = subscriptionData;
    localStorage.setItem('pastrySubscriptions', JSON.stringify(subscriptions));
    return true;
}

// Check if user has active premium subscription
function isPremium() {
    // Admin users get free lifetime premium
    if (isAdmin()) {
        return true;
    }

    const subscription = getSubscription();
    if (!subscription) return false;

    // Check if subscription is active and not expired
    if (subscription.status !== 'active') return false;

    const endDate = new Date(subscription.endDate);
    return endDate > new Date();
}

// Get subscription status details
function getSubscriptionStatus() {
    // Admin users get lifetime premium for free
    if (isAdmin()) {
        return {
            isPremium: true,
            plan: 'lifetime',
            status: 'admin',
            message: 'Premium Lifetime (Admin Privilege)',
            isAdminPrivilege: true
        };
    }

    const subscription = getSubscription();
    if (!subscription) {
        return {
            isPremium: false,
            plan: 'free',
            status: 'none',
            message: 'Free Plan - Limited features'
        };
    }

    const endDate = new Date(subscription.endDate);
    const now = new Date();

    if (subscription.status === 'cancelled') {
        if (endDate > now) {
            return {
                isPremium: true,
                plan: subscription.plan,
                status: 'cancelled',
                endDate: subscription.endDate,
                message: `Premium active until ${formatDate(endDate)}`
            };
        } else {
            return {
                isPremium: false,
                plan: 'free',
                status: 'expired',
                message: 'Subscription expired'
            };
        }
    }

    if (endDate <= now) {
        return {
            isPremium: false,
            plan: 'free',
            status: 'expired',
            message: 'Subscription expired'
        };
    }

    return {
        isPremium: true,
        plan: subscription.plan,
        status: 'active',
        endDate: subscription.endDate,
        message: `Premium ${PLANS[subscription.plan]?.name || 'Plan'}`
    };
}

// Format date for display
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ===== Transaction History =====
function addTransaction(transaction) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const allTransactions = JSON.parse(localStorage.getItem('pastryTransactions') || '{}');
    if (!allTransactions[currentUser]) {
        allTransactions[currentUser] = [];
    }

    allTransactions[currentUser].unshift({
        ...transaction,
        id: `TXN-${Date.now()}`,
        date: new Date().toISOString()
    });

    localStorage.setItem('pastryTransactions', JSON.stringify(allTransactions));
}

function getTransactions() {
    const currentUser = getCurrentUser();
    if (!currentUser) return [];

    const allTransactions = JSON.parse(localStorage.getItem('pastryTransactions') || '{}');
    return allTransactions[currentUser] || [];
}

// ===== Mock Payment Processing =====
async function processPayment(plan, cardData) {
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Validate card number (simple check for demo)
    const cardNumber = cardData.cardNumber.replace(/\s/g, '');

    // Test cards for demo
    const validTestCards = ['4242424242424242', '5555555555554444', '378282246310005'];
    const declineCards = ['4000000000000002'];

    if (declineCards.includes(cardNumber)) {
        return {
            success: false,
            error: 'Card declined. Please try a different card.'
        };
    }

    // For demo, accept any 16-digit card number or test cards
    if (cardNumber.length < 15 || cardNumber.length > 16) {
        return {
            success: false,
            error: 'Invalid card number'
        };
    }

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + PLANS[plan].durationDays);

    // Create subscription
    const subscriptionData = {
        plan: plan,
        status: 'active',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        paymentMethod: {
            last4: cardNumber.slice(-4),
            brand: getCardBrand(cardNumber),
            expiryDate: cardData.cardExpiry
        },
        autoRenew: plan !== 'lifetime',
        createdAt: new Date().toISOString()
    };

    // Save subscription
    saveSubscription(subscriptionData);

    // Add transaction
    addTransaction({
        type: 'subscription',
        plan: plan,
        amount: PLANS[plan].price,
        status: 'completed',
        paymentMethod: subscriptionData.paymentMethod
    });

    return {
        success: true,
        subscription: subscriptionData
    };
}

// Get card brand from number
function getCardBrand(cardNumber) {
    const number = cardNumber.replace(/\s/g, '');
    if (number.startsWith('4')) return 'Visa';
    if (number.startsWith('5')) return 'Mastercard';
    if (number.startsWith('3')) return 'Amex';
    return 'Card';
}

// ===== Cancel Subscription =====
function cancelSubscription() {
    const subscription = getSubscription();
    if (!subscription) return { success: false, error: 'No active subscription' };

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date().toISOString();
    subscription.autoRenew = false;

    saveSubscription(subscription);

    addTransaction({
        type: 'cancellation',
        plan: subscription.plan,
        amount: 0,
        status: 'completed'
    });

    return { success: true };
}

// ===== UI Initialization =====
document.addEventListener('DOMContentLoaded', initPaymentPage);

function initPaymentPage() {
    // Initialize language system
    initLanguage();

    const currentUser = getCurrentUser();

    // Update user header
    const userNameEl = document.getElementById('userName');
    const premiumBadge = document.getElementById('premiumBadge');

    if (userNameEl && currentUser) {
        userNameEl.textContent = currentUser;
    }

    // Update subscription status display
    updateSubscriptionDisplay();

    // Setup event listeners
    setupEventListeners();

    // Setup FAQ accordion
    setupFAQ();

    // Format card inputs
    setupCardInputFormatting();
}

function updateSubscriptionDisplay() {
    const status = getSubscriptionStatus();

    // Update current plan section
    const planIcon = document.getElementById('planIcon');
    const currentPlanName = document.getElementById('currentPlanName');
    const currentPlanDetails = document.getElementById('currentPlanDetails');
    const planExpiry = document.getElementById('planExpiry');
    const expiryDate = document.getElementById('expiryDate');
    const premiumBadge = document.getElementById('premiumBadge');
    const pricingSection = document.querySelector('.pricing-section');
    const manageSection = document.getElementById('manageSection');
    const featuresSection = document.querySelector('.features-section');
    const trustSection = document.querySelector('.trust-section');
    const faqSection = document.querySelector('.faq-section');

    if (status.isPremium) {
        // User is premium
        if (status.isAdminPrivilege) {
            // Admin user - special display
            if (planIcon) planIcon.textContent = '👑';
            if (currentPlanName) currentPlanName.textContent = 'Lifetime Premium (Admin)';
            if (currentPlanDetails) currentPlanDetails.textContent = 'Full access to all features as an administrator';
            if (premiumBadge) premiumBadge.style.display = 'inline-flex';
            if (planExpiry) planExpiry.style.display = 'none';

            // Hide all payment-related sections for admins
            if (pricingSection) pricingSection.style.display = 'none';
            if (manageSection) manageSection.style.display = 'none';
            if (featuresSection) featuresSection.style.display = 'none';
            if (trustSection) trustSection.style.display = 'none';
            if (faqSection) faqSection.style.display = 'none';
        } else {
            // Regular premium user
            if (planIcon) planIcon.textContent = '💎';
            if (currentPlanName) currentPlanName.textContent = `Premium ${PLANS[status.plan]?.name || ''} Plan`;
            if (currentPlanDetails) currentPlanDetails.textContent = status.message;
            if (premiumBadge) premiumBadge.style.display = 'inline-flex';

            if (status.endDate) {
                if (planExpiry) planExpiry.style.display = 'flex';
                if (expiryDate) expiryDate.textContent = formatDate(new Date(status.endDate));
            }

            // Show manage section, hide pricing for lifetime
            if (status.plan === 'lifetime') {
                if (pricingSection) pricingSection.style.display = 'none';
            }
            if (manageSection) {
                manageSection.style.display = 'block';
                updateManageSection(status);
            }
        }
    } else {
        // User is on free plan
        if (planIcon) planIcon.textContent = '🆓';
        if (currentPlanName) currentPlanName.textContent = 'Free Plan';
        if (currentPlanDetails) currentPlanDetails.textContent = 'Limited features - Upgrade to unlock more!';
        if (premiumBadge) premiumBadge.style.display = 'none';
        if (planExpiry) planExpiry.style.display = 'none';
        if (manageSection) manageSection.style.display = 'none';
    }
}

function updateManageSection(status) {
    const managePlanName = document.getElementById('managePlanName');
    const manageNextBilling = document.getElementById('manageNextBilling');
    const billingHistoryList = document.getElementById('billingHistoryList');

    if (managePlanName) {
        managePlanName.textContent = `Premium ${PLANS[status.plan]?.name || ''}`;
    }

    if (manageNextBilling && status.endDate) {
        const subscription = getSubscription();
        if (subscription?.autoRenew && status.plan !== 'lifetime') {
            manageNextBilling.textContent = `Next billing: ${formatDate(new Date(status.endDate))}`;
        } else if (status.plan === 'lifetime') {
            manageNextBilling.textContent = 'Lifetime access - No renewal needed';
        } else {
            manageNextBilling.textContent = `Expires: ${formatDate(new Date(status.endDate))}`;
        }
    }

    // Populate billing history
    if (billingHistoryList) {
        const transactions = getTransactions();
        if (transactions.length === 0) {
            billingHistoryList.innerHTML = '<p class="no-transactions">No transactions yet</p>';
        } else {
            billingHistoryList.innerHTML = transactions.slice(0, 5).map(tx => `
                <div class="billing-item">
                    <div class="billing-item-info">
                        <span class="billing-type">${tx.type === 'subscription' ? '💳 Subscription' : '❌ Cancellation'}</span>
                        <span class="billing-date">${formatDate(new Date(tx.date))}</span>
                    </div>
                    <span class="billing-amount">${tx.amount > 0 ? `$${tx.amount.toFixed(2)}` : '-'}</span>
                </div>
            `).join('');
        }
    }
}

function setupEventListeners() {
    // Subscribe buttons
    const subscribeMonthly = document.getElementById('subscribeMonthly');
    const subscribeYearly = document.getElementById('subscribeYearly');
    const subscribeLifetime = document.getElementById('subscribeLifetime');

    if (subscribeMonthly) {
        subscribeMonthly.addEventListener('click', () => openPaymentModal('monthly'));
    }
    if (subscribeYearly) {
        subscribeYearly.addEventListener('click', () => openPaymentModal('yearly'));
    }
    if (subscribeLifetime) {
        subscribeLifetime.addEventListener('click', () => openPaymentModal('lifetime'));
    }

    // Payment modal
    const closePaymentModal = document.getElementById('closePaymentModal');
    const paymentModal = document.getElementById('paymentModal');
    const payButton = document.getElementById('payButton');

    if (closePaymentModal) {
        closePaymentModal.addEventListener('click', () => {
            paymentModal.style.display = 'none';
        });
    }

    if (paymentModal) {
        paymentModal.addEventListener('click', (e) => {
            if (e.target === paymentModal) {
                paymentModal.style.display = 'none';
            }
        });
    }

    // Stripe Checkout button
    if (payButton) {
        payButton.addEventListener('click', handleStripeCheckout);
    }

    // Success modal
    const successContinue = document.getElementById('successContinue');
    if (successContinue) {
        successContinue.addEventListener('click', () => {
            window.location.href = './index.html';
        });
    }

    // Manage subscription buttons
    const cancelSubscriptionBtn = document.getElementById('cancelSubscriptionBtn');
    if (cancelSubscriptionBtn) {
        cancelSubscriptionBtn.addEventListener('click', handleCancelSubscription);
    }
}

let selectedPlan = null;

function openPaymentModal(planId) {
    const plan = PLANS[planId];
    if (!plan) return;

    selectedPlan = planId;

    // Update modal content
    const selectedPlanText = document.getElementById('selectedPlanText');
    const summaryPlan = document.getElementById('summaryPlan');
    const summaryPrice = document.getElementById('summaryPrice');
    const summaryTotal = document.getElementById('summaryTotal');
    const payButtonText = document.getElementById('payButtonText');

    if (selectedPlanText) selectedPlanText.textContent = `${plan.name} Plan - ${plan.displayPrice}`;
    if (summaryPlan) summaryPlan.textContent = plan.name;
    if (summaryPrice) summaryPrice.textContent = `$${plan.price.toFixed(2)}`;
    if (summaryTotal) summaryTotal.textContent = `$${plan.price.toFixed(2)}`;
    if (payButtonText) payButtonText.textContent = 'Proceed to Checkout';

    // Show modal
    const paymentModal = document.getElementById('paymentModal');
    if (paymentModal) {
        paymentModal.style.display = 'flex';
    }
}

// ===== Stripe Checkout Handler =====
async function handleStripeCheckout(e) {
    if (e) e.preventDefault(); // Prevent default just in case
    console.log('handleStripeCheckout called');

    if (!selectedPlan) {
        console.error('No plan selected');
        return;
    }

    const payButton = document.getElementById('payButton');
    const payButtonText = document.getElementById('payButtonText');

    // Disable button and show loading
    payButton.disabled = true;
    payButtonText.textContent = 'Redirecting to Stripe...';

    try {
        const token = getAuthToken();
        console.log('Auth token:', token ? 'Found' : 'Missing');

        if (!token) {
            console.log('Token missing. Checking for saved credentials...');

            // Attempt silent login if credentials exist
            const savedCredentialsStr = localStorage.getItem('rememberedUser');
            if (savedCredentialsStr) {
                try {
                    const credentials = JSON.parse(savedCredentialsStr);
                    const username = credentials.username;
                    // Password is base64 encoded in auth.js saveCredentials
                    const password = atob(credentials.password);

                    console.log('Attempting silent login for:', username);

                    const loginResponse = await fetch(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });

                    if (loginResponse.ok) {
                        const loginData = await loginResponse.json();
                        if (loginData.token) {
                            console.log('Silent login successful! Token acquired.');
                            sessionStorage.setItem('authToken', loginData.token);

                            // Recursively call handleStripeCheckout with the new token
                            return handleStripeCheckout(e);
                        }
                    } else {
                        console.warn('Silent login failed:', loginResponse.status);
                    }
                } catch (silentAuthErr) {
                    console.error('Silent auth error:', silentAuthErr);
                }
            }

            console.log('Token is missing - redirecting to login');

            // Show message and redirect
            showNotification('Please log in to continue. Redirecting...', 'error');

            // Save return URL
            sessionStorage.setItem('returnUrl', window.location.href);

            setTimeout(() => {
                window.location.href = './auth.html';
            }, 1500);

            payButton.disabled = false;
            payButtonText.textContent = 'Proceed to Checkout';
            return;
        }

        console.log('Creating checkout session for plan:', selectedPlan);
        const frontendUrl = window.location.origin;
        console.log('Frontend URL:', frontendUrl);

        // Create checkout session via API
        const response = await fetch(`${API_URL}/subscriptions/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                planId: selectedPlan,
                successUrl: `${frontendUrl}/payment-success.html`,
                cancelUrl: `${frontendUrl}/payment.html`
            })
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create checkout session');
        }

        // Redirect to Stripe Checkout
        if (data.url) {
            console.log('Redirecting to Stripe URL:', data.url);
            window.location.href = data.url;
        } else {
            throw new Error('No checkout URL received');
        }

    } catch (error) {
        console.error('Stripe checkout error:', error);
        showNotification(error.message || 'Failed to start checkout. Please try again.', 'error');
        payButton.disabled = false;
        payButtonText.textContent = 'Proceed to Checkout';
    }
}

async function handlePaymentSubmit(e) {
    e.preventDefault();

    if (!selectedPlan) return;

    const payButton = document.getElementById('payButton');
    const payButtonText = document.getElementById('payButtonText');

    // Get form data
    const cardData = {
        cardName: document.getElementById('cardName').value,
        cardNumber: document.getElementById('cardNumber').value,
        cardExpiry: document.getElementById('cardExpiry').value,
        cardCvv: document.getElementById('cardCvv').value
    };

    // Disable button and show loading
    payButton.disabled = true;
    payButtonText.textContent = 'Processing...';

    try {
        const result = await processPayment(selectedPlan, cardData);

        if (result.success) {
            // Hide payment modal
            document.getElementById('paymentModal').style.display = 'none';

            // Show success modal
            const successModal = document.getElementById('successModal');
            const successUserName = document.getElementById('successUserName');
            const successPlanDetails = document.getElementById('successPlanDetails');

            if (successUserName) successUserName.textContent = getCurrentUser();
            if (successPlanDetails) {
                successPlanDetails.textContent = `Plan: ${PLANS[selectedPlan].name} - Valid until ${formatDate(new Date(result.subscription.endDate))}`;
            }

            if (successModal) {
                successModal.style.display = 'flex';
            }

            // Update display
            updateSubscriptionDisplay();
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        showNotification('Payment failed. Please try again.', 'error');
    } finally {
        payButton.disabled = false;
        payButtonText.textContent = `Pay $${PLANS[selectedPlan].price.toFixed(2)}`;
    }
}

function handleCancelSubscription() {
    if (!confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your billing period.')) {
        return;
    }

    const result = cancelSubscription();

    if (result.success) {
        showNotification('Subscription cancelled successfully', 'success');
        updateSubscriptionDisplay();
    } else {
        showNotification(result.error || 'Failed to cancel subscription', 'error');
    }
}

function setupFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        const toggle = item.querySelector('.faq-toggle');

        question.addEventListener('click', () => {
            const isOpen = answer.style.maxHeight;

            // Close all other FAQs
            faqItems.forEach(otherItem => {
                const otherAnswer = otherItem.querySelector('.faq-answer');
                const otherToggle = otherItem.querySelector('.faq-toggle');
                otherAnswer.style.maxHeight = null;
                otherToggle.textContent = '+';
                otherItem.classList.remove('active');
            });

            // Toggle current FAQ
            if (!isOpen) {
                answer.style.maxHeight = answer.scrollHeight + 'px';
                toggle.textContent = '-';
                item.classList.add('active');
            }
        });
    });
}

function setupCardInputFormatting() {
    const cardNumber = document.getElementById('cardNumber');
    const cardExpiry = document.getElementById('cardExpiry');
    const cardCvv = document.getElementById('cardCvv');

    if (cardNumber) {
        cardNumber.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
            e.target.value = value.slice(0, 19);
        });
    }

    if (cardExpiry) {
        cardExpiry.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.slice(0, 2) + '/' + value.slice(2);
            }
            e.target.value = value.slice(0, 5);
        });
    }

    if (cardCvv) {
        cardCvv.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
        });
    }
}

// Show notification
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

    // Remove after 4 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// ===== Admin Premium Management Functions =====

// Get subscription for a specific user (for admin use)
function getSubscriptionForUser(username) {
    if (!username) return null;
    const subscriptions = JSON.parse(localStorage.getItem('pastrySubscriptions') || '{}');
    return subscriptions[username] || null;
}

// Check if a specific user has premium (for admin use)
function isUserPremium(username) {
    if (!username) return false;

    // Check if this user is admin (admins get free premium)
    // pastryUsers is stored as an OBJECT, not an array
    const users = JSON.parse(localStorage.getItem('pastryUsers') || '{}');
    const user = users[username];
    if (user && user.isAdmin) return true;

    const subscription = getSubscriptionForUser(username);
    if (!subscription) return false;

    // Check if subscription is active and not expired
    if (subscription.status !== 'active') return false;

    const endDate = new Date(subscription.endDate);
    return endDate > new Date();
}

// Grant premium to a user (admin function)
function grantPremiumToUser(username, plan = 'lifetime') {
    if (!username) return { success: false, error: 'Username is required' };

    const subscriptions = JSON.parse(localStorage.getItem('pastrySubscriptions') || '{}');

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (PLANS[plan]?.durationDays || 36500));

    subscriptions[username] = {
        plan: plan,
        status: 'active',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        grantedByAdmin: true,
        grantedAt: new Date().toISOString(),
        autoRenew: false
    };

    localStorage.setItem('pastrySubscriptions', JSON.stringify(subscriptions));
    return { success: true, message: `Premium ${plan} granted to ${username}` };
}

// Revoke premium from a user (admin function)
function revokePremiumFromUser(username) {
    if (!username) return { success: false, error: 'Username is required' };

    const subscriptions = JSON.parse(localStorage.getItem('pastrySubscriptions') || '{}');

    if (subscriptions[username]) {
        delete subscriptions[username];
        localStorage.setItem('pastrySubscriptions', JSON.stringify(subscriptions));
        return { success: true, message: `Premium revoked from ${username}` };
    }

    return { success: false, error: 'User has no premium subscription' };
}

// Sync subscription status from server to localStorage
// Call this on app init to ensure frontend state matches backend
async function syncSubscriptionFromServer() {
    const currentUser = getCurrentUser();
    const token = getAuthToken();

    if (!currentUser || !token) {
        console.log('Cannot sync subscription: no user or token');
        return false;
    }

    try {
        const response = await fetch(`${API_URL}/subscriptions/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch subscription status from server');
            return false;
        }

        const data = await response.json();
        console.log('Server subscription status:', data);

        // Update localStorage with server data
        const subscriptions = JSON.parse(localStorage.getItem('pastrySubscriptions') || '{}');

        if (data.isPremium && data.status !== 'none') {
            // User has active subscription on server - update localStorage
            subscriptions[currentUser] = {
                plan: data.plan,
                status: data.status === 'admin' ? 'active' : data.status,
                endDate: data.endDate || null,
                autoRenew: data.autoRenew || false,
                grantedByAdmin: data.isAdminPrivilege || false,
                syncedAt: new Date().toISOString()
            };
            console.log('Subscription synced from server for user:', currentUser);
        } else if (!data.isPremium && data.status !== 'admin') {
            // User has no subscription on server - clear localStorage
            if (subscriptions[currentUser]) {
                delete subscriptions[currentUser];
                console.log('Subscription cleared from localStorage (not premium on server)');
            }
        }

        localStorage.setItem('pastrySubscriptions', JSON.stringify(subscriptions));
        return true;

    } catch (error) {
        console.error('Error syncing subscription from server:', error);
        return false;
    }
}

// ===== Export Functions =====
export { isPremium, getSubscriptionStatus, getSubscription, PLANS, isUserPremium, grantPremiumToUser, revokePremiumFromUser, syncSubscriptionFromServer, saveSubscription };

