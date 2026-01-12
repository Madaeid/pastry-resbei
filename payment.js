// Payment Module for Pastry Recipe Book
import './style.css';
import { getCurrentUser, isAdmin } from './auth.js';

// ===== Subscription Plans Configuration =====
const PLANS = {
    monthly: {
        id: 'monthly',
        name: 'Monthly',
        price: 2.00,
        originalPrice: 5.00,
        discount: 60, // 60% off
        period: 'month',
        durationDays: 30,
        displayPrice: '$2.00/month',
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
        price: 5.00,
        originalPrice: 100.00,
        discount: 95, // 95% off
        period: 'lifetime',
        durationDays: 36500, // ~100 years
        displayPrice: '$5.00 one-time',
        originalDisplayPrice: '$15.00'
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
    const paymentForm = document.getElementById('paymentForm');

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

    if (paymentForm) {
        paymentForm.addEventListener('submit', handlePaymentSubmit);
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
    if (payButtonText) payButtonText.textContent = `Pay $${plan.price.toFixed(2)}`;

    // Show modal
    const paymentModal = document.getElementById('paymentModal');
    if (paymentModal) {
        paymentModal.style.display = 'flex';
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

// ===== Export Functions =====
export { isPremium, getSubscriptionStatus, getSubscription, PLANS, isUserPremium, grantPremiumToUser, revokePremiumFromUser };
