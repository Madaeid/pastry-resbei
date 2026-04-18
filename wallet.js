// Wallet Module for Chef Book
import './style.css';

const API_URL = '/api';

// ===== Auth Helpers =====
function getAuthToken() {
    return sessionStorage.getItem('authToken');
}

function getCurrentUser() {
    return sessionStorage.getItem('currentUser');
}

// ===== Toast Notification =====
function showToast(message, type = 'success') {
    const toast = document.getElementById('walletToast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `wallet-toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

// ===== Format Helpers =====
function formatCurrency(amount) {
    return parseFloat(amount).toFixed(2);
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

// ===== State =====
let selectedRecipient = null;
let searchTimeout = null;

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSendForm();
    initDepositForm();
    loadBalance();
    loadTransactions();
});

// ===== Load Wallet Balance =====
async function loadBalance() {
    const token = getAuthToken();
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/wallet/balance`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            const balanceEl = document.getElementById('walletBalance');
            if (balanceEl) {
                animateBalance(balanceEl, data.balance);
            }
        }
    } catch (err) {
        console.error('Load balance error:', err);
    }
}

function animateBalance(el, targetValue) {
    const current = parseFloat(el.textContent.replace(/,/g, '')) || 0;
    const diff = targetValue - current;
    const steps = 30;
    const stepValue = diff / steps;
    let step = 0;

    function tick() {
        step++;
        if (step >= steps) {
            el.textContent = formatCurrency(targetValue);
            return;
        }
        el.textContent = formatCurrency(current + stepValue * step);
        requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
}

// ===== Tabs =====
function initTabs() {
    const tabs = document.querySelectorAll('.wallet-tab');
    const actionBtns = document.querySelectorAll('.wallet-action-btn');

    function switchTab(tabName) {
        // Update tab buttons
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));

        // Update panels
        document.querySelectorAll('.wallet-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(tabName + 'Panel');
        if (panel) panel.classList.add('active');

        // Load data for history tab
        if (tabName === 'history') {
            loadTransactions();
        }
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Quick action buttons in balance card
    actionBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

// ===== Send Money Form =====
function initSendForm() {
    const searchInput = document.getElementById('recipientSearch');
    const searchResults = document.getElementById('searchResults');
    const selectedEl = document.getElementById('selectedRecipient');
    const removeBtn = document.getElementById('removeRecipient');
    const amountInput = document.getElementById('sendAmount');
    const sendBtn = document.getElementById('sendBtn');

    // Recipient search
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        clearTimeout(searchTimeout);

        if (query.length < 2) {
            searchResults.classList.remove('visible');
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                const token = getAuthToken();
                const res = await fetch(`${API_URL}/wallet/search-users?q=${encodeURIComponent(query)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const users = await res.json();
                renderSearchResults(users);
            } catch (err) {
                console.error('Search error:', err);
            }
        }, 300);
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.recipient-search-wrapper')) {
            searchResults.classList.remove('visible');
        }
    });

    // Remove recipient
    removeBtn.addEventListener('click', () => {
        selectedRecipient = null;
        selectedEl.classList.remove('visible');
        searchInput.style.display = '';
        searchInput.value = '';
        searchInput.focus();
        validateSendForm();
    });

    // Validate on amount change
    amountInput.addEventListener('input', validateSendForm);

    // Send button
    sendBtn.addEventListener('click', handleSendMoney);
}

function renderSearchResults(users) {
    const container = document.getElementById('searchResults');

    if (users.length === 0) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; color: rgba(255,255,255,0.4); font-size: 0.9rem;">
                No users found
            </div>
        `;
        container.classList.add('visible');
        return;
    }

    container.innerHTML = users.map(u => `
        <div class="search-result-item" data-username="${u.username}" data-name="${u.displayName || u.username}" data-pic="${u.pic || ''}">
            <img src="${u.pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || u.username)}&background=random&color=fff&size=40`}" alt="${u.username}">
            <div class="search-result-info">
                <div class="name">${u.displayName || u.username}</div>
                <div class="username">@${u.username}</div>
            </div>
        </div>
    `).join('');

    // Click handlers
    container.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            selectRecipient(
                item.dataset.username,
                item.dataset.name,
                item.dataset.pic
            );
        });
    });

    container.classList.add('visible');
}

function selectRecipient(username, name, pic) {
    selectedRecipient = { username, name, pic };

    const selectedEl = document.getElementById('selectedRecipient');
    const searchInput = document.getElementById('recipientSearch');
    const searchResults = document.getElementById('searchResults');

    document.getElementById('recipientPic').src = pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=42`;
    document.getElementById('recipientName').textContent = name;
    document.getElementById('recipientUsername').textContent = `@${username}`;

    selectedEl.classList.add('visible');
    searchInput.style.display = 'none';
    searchResults.classList.remove('visible');

    validateSendForm();
}

function validateSendForm() {
    const sendBtn = document.getElementById('sendBtn');
    const amountInput = document.getElementById('sendAmount');
    const amount = parseFloat(amountInput.value);

    sendBtn.disabled = !selectedRecipient || !amount || amount <= 0;
}

async function handleSendMoney() {
    const sendBtn = document.getElementById('sendBtn');
    const amount = parseFloat(document.getElementById('sendAmount').value);
    const note = document.getElementById('sendNote').value.trim();

    if (!selectedRecipient || !amount || amount <= 0) return;

    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span>⏳</span> Sending...';

    try {
        const token = getAuthToken();
        const res = await fetch(`${API_URL}/wallet/transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                recipientUsername: selectedRecipient.username,
                amount,
                note
            })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            // Show success overlay
            showSuccessOverlay(
                'Money Sent! 🎉',
                `$${formatCurrency(amount)} sent to @${selectedRecipient.username}`
            );

            // Reset form
            selectedRecipient = null;
            document.getElementById('selectedRecipient').classList.remove('visible');
            document.getElementById('recipientSearch').style.display = '';
            document.getElementById('recipientSearch').value = '';
            document.getElementById('sendAmount').value = '';
            document.getElementById('sendNote').value = '';

            // Refresh balance
            loadBalance();
        } else {
            showToast(data.error || 'Transfer failed', 'error');
        }
    } catch (err) {
        console.error('Transfer error:', err);
        showToast('Network error. Please try again.', 'error');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<span>📤</span> Send Money';
        validateSendForm();
    }
}

// ===== Deposit Form =====
function initDepositForm() {
    const depositAmountBtns = document.querySelectorAll('.deposit-amount-btn');
    const depositAmount = document.getElementById('depositAmount');
    const depositBtn = document.getElementById('depositBtn');
    const depositBtnText = document.getElementById('depositBtnText');
    const cardNumber = document.getElementById('depositCardNumber');
    const cardExpiry = document.getElementById('depositCardExpiry');
    const cardCvv = document.getElementById('depositCardCvv');

    // Quick amount buttons
    depositAmountBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            depositAmountBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            depositAmount.value = btn.dataset.amount;
            validateDepositForm();
        });
    });

    // Custom amount input
    depositAmount.addEventListener('input', () => {
        depositAmountBtns.forEach(b => b.classList.remove('active'));
        validateDepositForm();
    });

    // Card formatting
    cardNumber.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '').substring(0, 16);
        e.target.value = v.replace(/(\d{4})(?=\d)/g, '$1 ');
        validateDepositForm();
    });

    cardExpiry.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '').substring(0, 4);
        if (v.length >= 3) v = v.substring(0, 2) + '/' + v.substring(2);
        e.target.value = v;
        validateDepositForm();
    });

    cardCvv.addEventListener('input', () => validateDepositForm());

    // Deposit button
    depositBtn.addEventListener('click', handleDeposit);
}

function validateDepositForm() {
    const depositBtn = document.getElementById('depositBtn');
    const depositBtnText = document.getElementById('depositBtnText');
    const amount = parseFloat(document.getElementById('depositAmount').value);
    const cardNum = document.getElementById('depositCardNumber').value.replace(/\s/g, '');
    const cardExp = document.getElementById('depositCardExpiry').value;
    const cardCvv = document.getElementById('depositCardCvv').value;

    const isValid = amount > 0 && cardNum.length >= 15 && cardExp.length >= 4 && cardCvv.length >= 3;
    depositBtn.disabled = !isValid;

    if (amount > 0) {
        depositBtnText.textContent = `Add $${formatCurrency(amount)}`;
    } else {
        depositBtnText.textContent = 'Add Funds';
    }
}

async function handleDeposit() {
    const depositBtn = document.getElementById('depositBtn');
    const depositBtnText = document.getElementById('depositBtnText');
    const amount = parseFloat(document.getElementById('depositAmount').value);
    const cardNum = document.getElementById('depositCardNumber').value.replace(/\s/g, '');

    if (!amount || amount <= 0) return;

    depositBtn.disabled = true;
    depositBtnText.textContent = 'Processing...';

    // Simulate network delay
    await new Promise(r => setTimeout(r, 1500));

    try {
        const token = getAuthToken();
        const res = await fetch(`${API_URL}/wallet/deposit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                amount,
                cardLast4: cardNum.slice(-4),
                cardBrand: getCardBrand(cardNum)
            })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            showSuccessOverlay(
                'Deposit Successful! 💰',
                `$${formatCurrency(amount)} has been added to your wallet`
            );

            // Reset form
            document.getElementById('depositAmount').value = '';
            document.getElementById('depositCardNumber').value = '';
            document.getElementById('depositCardExpiry').value = '';
            document.getElementById('depositCardCvv').value = '';
            document.querySelectorAll('.deposit-amount-btn').forEach(b => b.classList.remove('active'));

            // Refresh balance
            loadBalance();
        } else {
            showToast(data.error || 'Deposit failed', 'error');
        }
    } catch (err) {
        console.error('Deposit error:', err);
        showToast('Network error. Please try again.', 'error');
    } finally {
        depositBtn.disabled = false;
        depositBtnText.textContent = 'Add Funds';
        validateDepositForm();
    }
}

function getCardBrand(cardNumber) {
    const num = cardNumber.replace(/\s/g, '');
    if (num.startsWith('4')) return 'Visa';
    if (num.startsWith('5')) return 'Mastercard';
    if (num.startsWith('3')) return 'Amex';
    if (num.startsWith('6')) return 'Discover';
    return 'Card';
}

// ===== Transaction History =====
async function loadTransactions() {
    const container = document.getElementById('transactionsList');
    if (!container) return;

    const token = getAuthToken();
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/wallet/transactions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load');

        const transactions = await res.json();

        if (!transactions || transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-transactions">
                    <div class="empty-icon">📭</div>
                    <h3>No transactions yet</h3>
                    <p>Send money or add funds to get started</p>
                </div>
            `;
            return;
        }

        container.innerHTML = transactions.map(tx => {
            const isSent = tx.direction === 'sent';
            const isDeposit = tx.type === 'deposit';

            let iconClass, icon, title, amountClass, amountPrefix;

            if (isDeposit) {
                iconClass = 'deposit';
                icon = '💳';
                title = 'Deposit';
                amountClass = 'positive';
                amountPrefix = '+';
            } else if (isSent) {
                iconClass = 'sent';
                icon = '📤';
                title = `Sent to @${tx.receiver?.username || 'unknown'}`;
                amountClass = 'negative';
                amountPrefix = '-';
            } else {
                iconClass = 'received';
                icon = '📥';
                title = `From @${tx.sender?.username || 'unknown'}`;
                amountClass = 'positive';
                amountPrefix = '+';
            }

            return `
                <div class="transaction-item">
                    <div class="tx-icon ${iconClass}">${icon}</div>
                    <div class="tx-details">
                        <div class="tx-title">${title}</div>
                        <div class="tx-meta">${formatDate(tx.createdAt)}${tx.note ? ` • ${tx.note}` : ''}</div>
                    </div>
                    <div class="tx-amount ${amountClass}">${amountPrefix}$${formatCurrency(tx.amount)}</div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Load transactions error:', err);
        container.innerHTML = `
            <div class="empty-transactions">
                <div class="empty-icon">⚠️</div>
                <h3>Could not load transactions</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

// ===== Success Overlay =====
function showSuccessOverlay(title, message) {
    const overlay = document.getElementById('successOverlay');
    document.getElementById('successTitle').textContent = title;
    document.getElementById('successMessage').textContent = message;
    overlay.classList.add('visible');

    document.getElementById('successDone').onclick = () => {
        overlay.classList.remove('visible');
        loadTransactions();
    };

    // Auto-close after 4s
    setTimeout(() => {
        overlay.classList.remove('visible');
    }, 4000);
}
