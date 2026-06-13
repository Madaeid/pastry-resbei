// User Analytics Dashboard Logic

document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    fetchUserAnalytics();
});

// Theme Management
function initThemeToggle() {
    const themeBtn = document.getElementById('themeToggle');
    if (!themeBtn) return;

    const icon = themeBtn.querySelector('.theme-icon');
    
    function updateIcon(theme) {
        icon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }

    // Initial state based on HTML attribute
    updateIcon(document.documentElement.getAttribute('data-theme'));

    themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateIcon(newTheme);
    });
}

async function fetchUserAnalytics() {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
        document.getElementById('loadingState').innerHTML = `<p style="color:var(--aa-red)">❌ Authentication missing. Please log in again.</p>`;
        return;
    }

    try {
        // Fetch all necessary data concurrently
        const [profileRes, walletRes, listingsRes, transactionsRes] = await Promise.all([
            fetch('/api/users/profile', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/wallet/balance', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/store/my/listings', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/wallet/transactions?limit=5', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (!profileRes.ok) throw new Error('Failed to load profile');

        const profileData = await profileRes.json();
        const walletData = walletRes.ok ? await walletRes.json() : { balance: 0 };
        const listingsData = listingsRes.ok ? await listingsRes.json() : [];
        const transactionsData = transactionsRes.ok ? await transactionsRes.json() : [];

        // Hide loading, show dashboard
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'block';

        // Update UI
        updateWelcomeMessage(profileData);
        updateKPIs(profileData, walletData);
        updateStorePerformance(listingsData);
        updateRecentTransactions(transactionsData, profileData.id);

    } catch (error) {
        console.error('Error fetching analytics:', error);
        document.getElementById('loadingState').innerHTML = `
            <p style="color:var(--aa-red)">❌ Failed to load dashboard data.</p>
            <button class="nav-pill" onclick="location.reload()" style="margin-top:15px">Try Again</button>
        `;
    }
}

function updateWelcomeMessage(profile) {
    const name = profile.displayName || profile.username || 'Chef';
    document.getElementById('welcomeMessage').textContent = `Welcome back, ${name}!`;
}

function updateKPIs(profile, wallet) {
    // Basic stats
    document.getElementById('kpiRecipes').textContent = formatNumber(profile.stats?.posts || 0);
    document.getElementById('kpiLikes').textContent = formatNumber(profile.stats?.likes || 0);
    document.getElementById('kpiFollowers').textContent = formatNumber(profile.stats?.followers || 0);
    
    // Wallet
    document.getElementById('kpiWallet').textContent = formatCurrency(wallet.balance || 0);
}

function updateStorePerformance(listings) {
    const activeListings = listings.filter(l => l.isActive).length;
    let totalSales = 0;
    let totalRevenue = 0;

    // Top listings by sales
    const sortedListings = [...listings].sort((a, b) => b.salesCount - a.salesCount);

    sortedListings.forEach(l => {
        totalSales += l.salesCount;
        totalRevenue += l.salesCount * l.price;
    });

    document.getElementById('storeListings').textContent = activeListings;
    document.getElementById('storeSalesCount').textContent = formatNumber(totalSales);
    document.getElementById('storeRevenue').textContent = formatCurrency(totalRevenue);

    // Render top 5 listings
    const container = document.getElementById('topListingsList');
    
    if (listings.length === 0) {
        container.innerHTML = `<div class="empty-state">No store listings yet. Head to your profile to list a recipe!</div>`;
        return;
    }

    const top5 = sortedListings.slice(0, 5);
    container.innerHTML = top5.map(listing => `
        <div class="listing-item">
            <div class="listing-info">
                <span class="listing-name">${escapeHTML(listing.name)}</span>
                <span class="listing-meta">${listing.category} • ${formatCurrency(listing.price)}</span>
            </div>
            <div class="listing-stats">
                <span class="listing-revenue">${formatCurrency(listing.salesCount * listing.price)}</span>
                <span class="listing-sales">${formatNumber(listing.salesCount)} sales</span>
            </div>
        </div>
    `).join('');
}

function updateRecentTransactions(transactions, userId) {
    const tbody = document.getElementById('transactionsBody');
    const noTx = document.getElementById('noTransactions');
    const table = document.getElementById('transactionsTable');

    if (!transactions || transactions.length === 0) {
        table.style.display = 'none';
        noTx.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    noTx.style.display = 'none';

    tbody.innerHTML = transactions.map(tx => {
        const date = new Date(tx.createdAt).toLocaleDateString(undefined, { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });

        // Determine badge type based on transaction type
        let typeClass = 'tx-default';
        if (tx.type === 'subscription') typeClass = 'tx-subscription';
        if (tx.type === 'recipe_purchase') typeClass = 'tx-recipe_purchase';
        if (tx.type === 'transfer') typeClass = 'tx-cancellation'; // using cancellation color just for distinction
        
        let typeLabel = tx.type.replace('_', ' ');

        // Check if money is in or out
        let isIncoming = false;
        if (tx.type === 'deposit') isIncoming = true;
        if (tx.type === 'transfer' && tx.receiver && tx.receiver.id === userId) isIncoming = true; // Wait, we don't have tx.receiver.id here, it depends on direction

        // The wallet endpoint returns `direction: 'sent' | 'received'`
        if (tx.direction === 'received') isIncoming = true;

        const amountColor = isIncoming ? 'var(--aa-green)' : 'var(--aa-text)';
        const amountPrefix = isIncoming ? '+' : (tx.type === 'deposit' ? '+' : '-');

        return `
            <tr>
                <td><span class="tx-type ${typeClass}">${typeLabel}</span></td>
                <td>${escapeHTML(tx.note || '-')}</td>
                <td class="tx-amount" style="color: ${amountColor}">${amountPrefix}${formatCurrency(tx.amount)}</td>
                <td style="color:var(--aa-text2); font-size:0.8rem;">${date}</td>
            </tr>
        `;
    }).join('');
}

// Utility formatting functions
function formatCurrency(num) {
    return '$' + parseFloat(num).toFixed(2);
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'm';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
