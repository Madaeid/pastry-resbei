// Analytics Dashboard - Chef Book (Secured)
import { isLoggedIn, logout, getCurrentUser, isAdmin, getAuthToken } from './auth.js';
import { initLanguage } from './language.js';

const API_URL = '/api';

// ===== XSS Protection =====
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
}

// ===== Server-Side Access Control =====
// Client-side check is a fast pre-filter; server verification prevents tampering
if (!isLoggedIn()) window.location.href = './auth.html';
else if (!isAdmin()) window.location.href = './index.html';

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
            sessionStorage.setItem('isAdmin', 'false');
            window.location.href = './index.html';
            return false;
        }
        // Verified: show admin content, hide loading screen
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

// ===== DOM =====
const loadingState = document.getElementById('loadingState');
const dashboardContent = document.getElementById('dashboardContent');
const logoutBtn = document.getElementById('logoutBtn');
const themeToggle = document.getElementById('themeToggle');

const CAT_COLORS = ['#C67B4B', '#D4A55A', '#8B5E3C', '#8B9E6B', '#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#f87171'];

// ===== Init =====
async function init() {
    // Verify admin status with server before showing anything
    const isVerified = await verifyAdminAccess();
    if (!isVerified) return;

    initLanguage();
    setupEvents();
    await loadDashboard();
}

function setupEvents() {
    logoutBtn.addEventListener('click', logout);
    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        themeToggle.querySelector('.theme-icon').textContent = next === 'dark' ? '🌙' : '☀️';
    });
    const t = document.documentElement.getAttribute('data-theme');
    themeToggle.querySelector('.theme-icon').textContent = t === 'dark' ? '🌙' : '☀️';
}

// ===== API Integration =====
// Reads and parses error details from the server response
async function adminFetch(endpoint) {
    const token = getAuthToken();
    const res = await fetch(`${API_URL}/admin${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
    }
    return res.json();
}

// ===== Dashboard Loading =====
async function loadDashboard() {
    try {
        const [stats, analytics] = await Promise.all([
            adminFetch('/stats'),
            adminFetch('/analytics')
        ]);
        renderKPIs(stats, analytics);
        renderCategories(analytics.categoryDistribution);
        renderSubscriptions(analytics.subscriptionBreakdown);
        renderStoreWallet(analytics.storeStats, analytics.walletStats);
        renderTopUsers(analytics.topUsers);
        renderRecentUsers(analytics.recentUsers);
        renderTransactions(analytics.recentTransactions);

        loadingState.style.display = 'none';
        dashboardContent.style.display = 'block';
    } catch (err) {
        console.error('Dashboard load error:', err);
        loadingState.innerHTML = `<p style="color:var(--aa-red)">Failed to load analytics: ${escapeHTML(err.message)}. <button onclick="location.reload()" style="color:var(--aa-accent);background:none;border:none;cursor:pointer;text-decoration:underline;">Retry</button></p>`;
    }
}

// ===== Renderers =====
function renderKPIs(stats, analytics) {
    animateCounter('kpiRevenue', analytics.totalRevenue, '$');
    animateCounter('kpiUsers', stats.totalUsers);
    animateCounter('kpiRecipes', stats.totalRecipes);
    animateCounter('kpiPremium', stats.totalSubscriptions);
    document.getElementById('kpiNewUsers').textContent = `+${analytics.newUsersThisWeek} this week`;
}

function animateCounter(id, target, prefix = '') {
    const el = document.getElementById(id);
    const isFloat = prefix === '$';
    let current = 0;
    const step = Math.max(target / 40, isFloat ? 0.01 : 1);
    const timer = setInterval(() => {
        current += step;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = isFloat ? `${prefix}${current.toFixed(2)}` : `${prefix}${Math.round(current)}`;
    }, 25);
}

function renderCategories(cats) {
    const container = document.getElementById('categoryChart');
    if (!cats || cats.length === 0) { container.innerHTML = '<div class="empty-chart">No recipes yet</div>'; return; }
    const max = Math.max(...cats.map(c => c.count));
    const emojiMap = { Cakes:'🎂', Cookies:'🍪', Pastries:'🥐', 'Pies & Tarts':'🥧', Breads:'🍞', Desserts:'🍰', Chocolates:'🍫', Other:'✨' };

    container.innerHTML = '';
    const barWrap = document.createElement('div');
    barWrap.className = 'cat-bar-wrap';

    cats.forEach((c, i) => {
        const pct = max > 0 ? (c.count / max * 100) : 0;
        const emoji = emojiMap[c.category] || '📋';
        const item = document.createElement('div');
        item.className = 'cat-bar-item';
        item.innerHTML = `
            <span class="cat-bar-label">${emoji} ${escapeHTML(c.category)}</span>
            <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%;background:${CAT_COLORS[i % CAT_COLORS.length]}">${c.count}</div></div>
        `;
        barWrap.appendChild(item);
    });
    container.appendChild(barWrap);
}

function renderSubscriptions(subs) {
    document.getElementById('subsMonthly').textContent = subs.monthly;
    document.getElementById('subsYearly').textContent = subs.yearly;
    document.getElementById('subsLifetime').textContent = subs.lifetime;
    document.getElementById('subsAdminGranted').textContent = subs.adminGranted;

    const total = subs.monthly + subs.yearly + subs.lifetime + subs.adminGranted;
    const donutEl = document.getElementById('subsDonut');
    if (total === 0) { donutEl.innerHTML = ''; return; }

    const data = [
        { val: subs.monthly, color: '#60a5fa' },
        { val: subs.yearly, color: '#a78bfa' },
        { val: subs.lifetime, color: '#fbbf24' },
        { val: subs.adminGranted, color: '#f472b6' }
    ].filter(d => d.val > 0);

    let cumulative = 0;
    const r = 60, cx = 80, cy = 80, sw = 20;
    const circumference = 2 * Math.PI * r;
    const arcs = data.map(d => {
        const pct = d.val / total;
        const dashLen = pct * circumference;
        const offset = cumulative * circumference;
        cumulative += pct;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${sw}"
            stroke-dasharray="${dashLen} ${circumference - dashLen}" stroke-dashoffset="-${offset}"
            style="transition:all .6s ease" />`;
    }).join('');

    donutEl.innerHTML = `<svg class="donut-svg" viewBox="0 0 160 160">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="${sw}" />
        ${arcs}
        <text x="${cx}" y="${cy}" text-anchor="middle" dy=".35em" fill="var(--aa-text)" font-size="20" font-weight="700">${total}</text>
    </svg>`;
}

function renderStoreWallet(store, wallet) {
    document.getElementById('storeListings').textContent = store.totalListings;
    document.getElementById('storeSales').textContent = store.totalSales;
    document.getElementById('storeRevenue').textContent = `$${store.totalStoreRevenue.toFixed(2)}`;
    document.getElementById('walletBalance').textContent = `$${wallet.totalWalletBalance.toFixed(2)}`;
    document.getElementById('walletDeposits').textContent = wallet.totalDeposits;
    document.getElementById('walletTransfers').textContent = wallet.totalTransfers;
}

function renderUserItem(user, index, showRank = false, showStat = null) {
    const adminTag = user.isAdmin ? '<span class="admin-tag">ADMIN</span>' : '';
    const stat = showStat ? `<span class="user-stat">${escapeHTML(showStat)}</span>` : '';
    const rank = showRank ? `<span class="user-rank">${index + 1}</span>` : '';
    const meta = user.joinDate ? new Date(user.joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year:'numeric' }) : '';

    return `
        <div class="user-item">
            ${rank}
            <div class="user-avatar-placeholder">👤</div>
            <div class="user-info">
                <span class="user-name">${escapeHTML(user.displayName || user.username)}${adminTag}</span>
                <span class="user-meta">@${escapeHTML(user.username)} · ${meta}</span>
            </div>
            ${stat}
        </div>`;
}

function renderTopUsers(users) {
    const el = document.getElementById('topUsersList');
    if (!users || !users.length) { el.innerHTML = '<div class="empty-chart">No users yet</div>'; return; }
    el.innerHTML = users.map((u, i) => renderUserItem(u, i, true, `${u.recipeCount} 📖`)).join('');
}

function renderRecentUsers(users) {
    const el = document.getElementById('recentUsersList');
    if (!users || !users.length) { el.innerHTML = '<div class="empty-chart">No users yet</div>'; return; }
    el.innerHTML = users.map((u, i) => renderUserItem(u, i, false)).join('');
}

function renderTransactions(txs) {
    const tbody = document.getElementById('transactionsBody');
    const noTx = document.getElementById('noTransactions');
    tbody.innerHTML = '';

    if (!txs || !txs.length) {
        noTx.style.display = 'block';
        document.getElementById('transactionsTable').style.display = 'none';
        return;
    }
    noTx.style.display = 'none';
    document.getElementById('transactionsTable').style.display = '';

    txs.forEach(tx => {
        const typeClass = `tx-${tx.type}` in {'tx-subscription':1,'tx-recipe_purchase':1,'tx-cancellation':1} ? `tx-${tx.type}` : 'tx-default';
        const date = tx.date ? new Date(tx.date).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHTML(tx.displayName || tx.username)}</strong><br><small style="color:var(--aa-text2)">@${escapeHTML(tx.username)}</small></td>
            <td><span class="tx-type ${typeClass}">${escapeHTML(tx.type.replace(/_/g, ' '))}</span></td>
            <td>${escapeHTML(tx.plan || '—')}</td>
            <td class="tx-amount">$${tx.amount.toFixed(2)}</td>
            <td><span class="tx-status"><span class="tx-status-dot ${tx.status}"></span>${escapeHTML(tx.status)}</span></td>
            <td>${date}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ===== Start =====
init();
