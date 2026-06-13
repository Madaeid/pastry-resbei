import { showNotification } from './ui-utils.js';
import { getCurrentUser } from './auth.js';
import { isPremium } from './payment.js';
import { createPostCard, formatTimeAgo } from './social-ui.js';
import { getCategoryEmoji, getDifficultyText } from './recipe-utils.js';

const API_URL = '/api';

// ===== STORE MARKETPLACE =====
let sellRecipePhoto = null;

export function setupStoreListeners() {
    // Sell Recipe button
    const sellRecipeBtn = document.getElementById('sellRecipeBtn');
    const sellRecipeModal = document.getElementById('sellRecipeModal');
    const closeSellModal = document.getElementById('closeSellModal');
    const sellRecipeForm = document.getElementById('sellRecipeForm');

    if (sellRecipeBtn && sellRecipeModal) {
        sellRecipeBtn.addEventListener('click', () => {
            if (sellRecipeForm) {
                sellRecipeForm.reset();
                delete sellRecipeForm.dataset.prepTime;
                delete sellRecipeForm.dataset.cookTime;
                delete sellRecipeForm.dataset.difficulty;
                delete sellRecipeForm.dataset.video;
                delete sellRecipeForm.dataset.source;
            }
            sellRecipePhoto = null;
            const preview = document.getElementById('sellRecipePhotoPreview');
            const placeholder = document.getElementById('sellUploadPlaceholder');
            if (preview) { preview.style.display = 'none'; preview.src = ''; }
            if (placeholder) placeholder.style.display = 'block';
            sellRecipeModal.classList.add('show');
        });
    }

    if (closeSellModal && sellRecipeModal) {
        closeSellModal.addEventListener('click', () => sellRecipeModal.classList.remove('show'));
        sellRecipeModal.addEventListener('click', (e) => {
            if (e.target === sellRecipeModal) sellRecipeModal.classList.remove('show');
        });
    }

    // Photo upload for sell form
    const sellPhotoUpload = document.getElementById('sellRecipeImageUpload');
    const sellPhotoInput = document.getElementById('sellRecipePhotoInput');
    const sellPhotoPreview = document.getElementById('sellRecipePhotoPreview');
    const sellPlaceholder = document.getElementById('sellUploadPlaceholder');

    if (sellPhotoUpload && sellPhotoInput) {
        sellPhotoUpload.addEventListener('click', () => sellPhotoInput.click());
        sellPhotoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    sellRecipePhoto = ev.target.result;
                    if (sellPhotoPreview) {
                        sellPhotoPreview.src = ev.target.result;
                        sellPhotoPreview.style.display = 'block';
                    }
                    if (sellPlaceholder) sellPlaceholder.style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Sell form submit
    if (sellRecipeForm) {
        sellRecipeForm.addEventListener('submit', handleSellRecipeSubmit);
    }

    // Purchase modal close
    const purchaseModal = document.getElementById('storePurchaseModal');
    const closePurchaseModal = document.getElementById('closePurchaseModal');
    if (closePurchaseModal && purchaseModal) {
        closePurchaseModal.addEventListener('click', () => purchaseModal.classList.remove('show'));
        purchaseModal.addEventListener('click', (e) => {
            if (e.target === purchaseModal) purchaseModal.classList.remove('show');
        });
    }

    // Recipe view modal close
    const viewModal = document.getElementById('storeRecipeViewModal');
    const closeView = document.getElementById('closeStoreRecipeView');
    if (closeView && viewModal) {
        closeView.addEventListener('click', () => viewModal.classList.remove('show'));
        viewModal.addEventListener('click', (e) => {
            if (e.target === viewModal) viewModal.classList.remove('show');
        });
    }

    // Store sub-tabs (Browse / My Listings / Purchased)
    const storeTabBtns = document.querySelectorAll('.store-tab-btn');
    storeTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            storeTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.dataset.storeTab;
            document.getElementById('storeGrid').style.display = tab === 'browse' ? 'grid' : 'none';
            document.getElementById('myListingsGrid').style.display = tab === 'my-listings' ? 'grid' : 'none';
            document.getElementById('purchasedGrid').style.display = tab === 'purchased' ? 'grid' : 'none';

            if (tab === 'browse') loadStoreRecipes();
            else if (tab === 'my-listings') loadMyListings();
            else if (tab === 'purchased') loadMyPurchases();
        });
    });

    // Store search and filters
    const storeSearch = document.getElementById('storeSearch');
    const storePriceFilter = document.getElementById('storePriceFilter');
    const storeRatingFilter = document.getElementById('storeRatingFilter');
    const storeSortFilter = document.getElementById('storeSortFilter');

    if (storeSearch) storeSearch.addEventListener('input', () => loadStoreRecipes());
    if (storePriceFilter) storePriceFilter.addEventListener('change', () => loadStoreRecipes());
    if (storeRatingFilter) storeRatingFilter.addEventListener('change', () => loadStoreRecipes());
    if (storeSortFilter) storeSortFilter.addEventListener('change', () => loadStoreRecipes());
}

export async function handleSellRecipeSubmit(e) {
    e.preventDefault();

    const token = sessionStorage.getItem('authToken');
    if (!token) { showNotification('❌ Please log in.', 'error'); return; }

    const sellRecipeForm = document.getElementById('sellRecipeForm');
    const source = sellRecipeForm?.dataset.source || '';

    const data = {
        name: document.getElementById('sellRecipeName').value.trim(),
        description: document.getElementById('sellRecipeDesc').value.trim(),
        category: document.getElementById('sellRecipeCategory').value,
        price: parseFloat(document.getElementById('sellRecipePrice').value),
        photo: sellRecipePhoto,
        ingredients: document.getElementById('sellRecipeIngredients').value.trim(),
        instructions: document.getElementById('sellRecipeInstructions').value.trim(),
        notes: document.getElementById('sellRecipeNotes').value.trim(),
        difficulty: sellRecipeForm?.dataset.difficulty || 'Medium',
        prepTime: sellRecipeForm?.dataset.prepTime ? parseInt(sellRecipeForm.dataset.prepTime) : 0,
        cookTime: sellRecipeForm?.dataset.cookTime ? parseInt(sellRecipeForm.dataset.cookTime) : 0,
        video: sellRecipeForm?.dataset.video || null
    };

    if (!data.name || !data.price || data.price <= 0) {
        showNotification('❌ Name and valid price are required.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/store`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (response.ok) {
            showNotification('✅ Recipe listed in the store! 🏷️', 'success');
            document.getElementById('sellRecipeModal').classList.remove('show');
            document.getElementById('sellRecipeForm').reset();
            if (sellRecipeForm) {
                delete sellRecipeForm.dataset.prepTime;
                delete sellRecipeForm.dataset.cookTime;
                delete sellRecipeForm.dataset.difficulty;
                delete sellRecipeForm.dataset.video;
                delete sellRecipeForm.dataset.source;
            }
            sellRecipePhoto = null;
            const preview = document.getElementById('sellRecipePhotoPreview');
            const placeholder = document.getElementById('sellUploadPlaceholder');
            if (preview) { preview.style.display = 'none'; preview.src = ''; }
            if (placeholder) placeholder.style.display = 'block';
            
            loadStoreRecipes();

            // Programmatic tab switch if source is my-recipes
            if (source === 'my-recipes') {
                const storeTabBtn = document.querySelector('.nav-btn[data-tab="store"]');
                if (storeTabBtn) {
                    storeTabBtn.click();
                    setTimeout(() => {
                        const myListingsSubTab = document.querySelector('.store-tab-btn[data-store-tab="my-listings"]');
                        if (myListingsSubTab) {
                            myListingsSubTab.click();
                        }
                    }, 100);
                }
            }
        } else {
            showNotification(result.error || '❌ Failed to list recipe.', 'error');
        }
    } catch (err) {
        console.error('Sell recipe error:', err);
        showNotification('❌ Connection error.', 'error');
    }
}

export async function loadStoreRecipes() {
    const grid = document.getElementById('storeGrid');
    const emptyState = document.getElementById('storeEmptyState');
    if (!grid) return;

    try {
        const response = await fetch(`${API_URL}/store`);
        const recipes = await response.json();

        const searchTerm = (document.getElementById('storeSearch')?.value || '').toLowerCase().trim();
        const priceFilter = document.getElementById('storePriceFilter')?.value || 'all';
        const ratingFilter = document.getElementById('storeRatingFilter')?.value || 'all';
        const sortFilter = document.getElementById('storeSortFilter')?.value || 'newest';

        let filtered = recipes;

        // Apply text search
        if (searchTerm) {
            filtered = filtered.filter(r => r.name.toLowerCase().includes(searchTerm) || r.category.toLowerCase().includes(searchTerm));
        }

        // Apply price filter
        if (priceFilter === 'free') {
            filtered = filtered.filter(r => r.price === 0);
        } else if (priceFilter === 'under5') {
            filtered = filtered.filter(r => r.price > 0 && r.price < 5);
        } else if (priceFilter === 'under15') {
            filtered = filtered.filter(r => r.price > 0 && r.price < 15);
        } else if (priceFilter === 'premium') {
            filtered = filtered.filter(r => r.price >= 15);
        }

        // Apply rating filter (Using mock rating if not provided by backend)
        if (ratingFilter !== 'all') {
            const minRating = parseFloat(ratingFilter);
            filtered = filtered.filter(r => {
                const rtg = r.seller?.rating || (4.0 + ((r.id || 1) % 10) / 10); // Mock rating 4.0 - 4.9 if missing
                return rtg >= minRating;
            });
        }

        // Apply sorting
        if (sortFilter === 'price_low') {
            filtered.sort((a, b) => a.price - b.price);
        } else if (sortFilter === 'price_high') {
            filtered.sort((a, b) => b.price - a.price);
        } else if (sortFilter === 'sales') {
            filtered.sort((a, b) => {
                const aSales = a.salesCount || (a.id % 50); // Mock sales
                const bSales = b.salesCount || (b.id % 50);
                return bSales - aSales;
            });
        } else {
            // Newest (default)
            filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        }

        grid.innerHTML = '';

        if (filtered.length === 0) {
            grid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
        } else {
            grid.style.display = 'grid';
            if (emptyState) emptyState.style.display = 'none';

            filtered.forEach(recipe => {
                const card = createStoreCard(recipe);
                grid.appendChild(card);
            });
        }
    } catch (err) {
        console.error('Load store error:', err);
    }
}

export function createStoreCard(recipe) {
    const rtg = recipe.seller?.rating || (4.0 + ((recipe.id || 1) % 10) / 10);
    const card = document.createElement('div');
    card.className = 'store-card';
    card.innerHTML = `
        <div class="store-card-image">
            ${recipe.photo
            ? `<img src="${recipe.photo}" alt="${recipe.name}" style="width: 100%; height: 180px; object-fit: cover;">`
            : `<div style="width: 100%; height: 180px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(255,107,138,0.15), rgba(255,154,86,0.15)); font-size: 3rem;">🧁</div>`
        }
            <div class="store-price-tag" onclick="event.stopPropagation(); viewStoreRecipe(${recipe.id})" style="cursor: pointer; transition: transform 0.3s ease;">$${recipe.price.toFixed(2)}</div>
        </div>
        <div class="store-card-body">
            <h3 class="store-card-title">${recipe.name}</h3>
            <div class="store-card-meta">
                <span class="store-card-category">${recipe.category}</span>
                <span class="store-card-seller">
                    <img src="${recipe.seller.pic || `https://ui-avatars.com/api/?name=${recipe.seller.name}&background=random`}" alt="" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover;">
                    ${recipe.seller.name}
                    <span style="color: #fbbf24; font-size: 0.8rem; margin-left: 4px;">⭐️ ${rtg.toFixed(1)}</span>
                </span>
            </div>
            <button class="btn btn-primary store-view-btn" onclick="viewStoreRecipe(${recipe.id})" style="width: 100%; margin-top: 10px; padding: 8px; border-radius: 10px;">
                <span>👁️</span> View Recipe
            </button>
        </div>
    `;
    return card;
}

export async function viewStoreRecipe(id) {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
        showNotification('❌ Please log in to view recipes.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/store/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (response.status === 403 && data.preview) {
            // Show purchase modal
            showPurchaseModal(data.recipe);
        } else if (response.ok) {
            // Show full recipe
            showFullStoreRecipe(data);
        } else {
            showNotification(data.error || '❌ Failed to load recipe.', 'error');
        }
    } catch (err) {
        console.error('View store recipe error:', err);
        showNotification('❌ Connection error.', 'error');
    }
}

export function showPurchaseModal(recipe) {
    const modal = document.getElementById('storePurchaseModal');
    const body = document.getElementById('purchaseModalBody');
    if (!modal || !body) return;

    body.innerHTML = `
        <div style="padding: 20px;">
            ${recipe.photo
            ? `<img src="${recipe.photo}" alt="${recipe.name}" style="width: 100%; max-height: 220px; object-fit: cover; border-radius: 16px; margin-bottom: 20px;">`
            : `<div style="width: 100%; height: 180px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(255,107,138,0.1), rgba(255,154,86,0.1)); border-radius: 16px; font-size: 4rem; margin-bottom: 20px;">🔒</div>`
        }
            <h2 style="margin: 0 0 8px; font-size: 1.4rem;">${recipe.name}</h2>
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px;">
                <img src="${recipe.seller.pic || `https://ui-avatars.com/api/?name=${recipe.seller.name}&background=random`}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
                <span style="color: var(--text-secondary); font-size: 0.9rem;">by ${recipe.seller.name}</span>
            </div>
            <div style="background: linear-gradient(135deg, rgba(255,107,138,0.1), rgba(255,154,86,0.1)); border: 1px solid rgba(255,107,138,0.3); border-radius: 16px; padding: 20px; margin-bottom: 20px; text-align: center;">
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 4px;">Recipe Price</div>
                <div style="font-size: 2rem; font-weight: 800; background: linear-gradient(135deg, var(--accent-pink), var(--accent-orange)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">$${recipe.price.toFixed(2)}</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 12px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.05);">
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">🔒 Purchase this recipe to unlock the full ingredients, instructions, and chef's notes.</p>
            </div>
            
            <!-- Payment Method Selection -->
            <div style="margin-bottom: 12px;">
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 10px; text-align: center; font-weight: 600;">Choose Payment Method</p>
            </div>
            
            <!-- Wallet Option -->
            <button class="btn" id="walletPurchaseBtn" data-recipe-id="${recipe.id}" style="width: 100%; padding: 14px 16px; font-size: 1rem; border-radius: 14px; font-weight: 700; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 10px; transition: all 0.3s ease;">
                <span style="font-size: 1.2rem;">💰</span>
                <span>Pay with Wallet</span>
                <span id="walletBalanceTag" style="background: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">Loading...</span>
            </button>
            <p id="walletInsufficientMsg" style="display: none; text-align: center; font-size: 0.78rem; color: #ef4444; margin: -4px 0 10px;">⚠️ Insufficient wallet balance. Deposit funds in your wallet first.</p>
            
            <!-- Stripe Option -->
            <button class="btn" id="stripePurchaseBtn" data-recipe-id="${recipe.id}" style="width: 100%; padding: 14px 16px; font-size: 1rem; border-radius: 14px; font-weight: 700; background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.3s ease;">
                <span style="font-size: 1.2rem;">💳</span>
                <span>Pay with Stripe</span>
                <span style="background: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">Visa / Card</span>
            </button>
        </div>
    `;

    modal.classList.add('show');

    // Fetch wallet balance and update the wallet button
    fetchAndUpdateWalletBtn(recipe.price, 'walletPurchaseBtn', 'walletBalanceTag', 'walletInsufficientMsg');

    // Attach wallet purchase handler
    document.getElementById('walletPurchaseBtn').addEventListener('click', async () => {
        await purchaseRecipe(recipe.id, 'wallet');
    });

    // Attach Stripe purchase handler
    document.getElementById('stripePurchaseBtn').addEventListener('click', async () => {
        await purchaseRecipe(recipe.id, 'stripe');
    });
}

// Helper: Fetch wallet balance and update button state
export async function fetchAndUpdateWalletBtn(price, btnId, balanceTagId, insufficientMsgId) {
    const token = sessionStorage.getItem('authToken');
    const btn = document.getElementById(btnId);
    const balanceTag = document.getElementById(balanceTagId);
    const insufficientMsg = document.getElementById(insufficientMsgId);
    if (!token || !btn) return;

    try {
        const response = await fetch(`${API_URL}/wallet/balance`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            const balance = data.balance || 0;
            if (balanceTag) balanceTag.textContent = `$${balance.toFixed(2)}`;

            if (balance < price) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
                if (insufficientMsg) insufficientMsg.style.display = 'block';
            }
        } else {
            if (balanceTag) balanceTag.textContent = '$0.00';
            btn.disabled = true;
            btn.style.opacity = '0.5';
        }
    } catch (err) {
        console.error('Wallet balance fetch error:', err);
        if (balanceTag) balanceTag.textContent = 'N/A';
    }
}

export async function purchaseRecipe(id, method = 'wallet') {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
        showNotification('❌ Please log in to purchase.', 'error');
        return;
    }

    // Determine which button to show loading on
    const walletBtn = document.getElementById('walletPurchaseBtn');
    const stripeBtn = document.getElementById('stripePurchaseBtn');
    const activeBtn = method === 'stripe' ? stripeBtn : walletBtn;
    const originalContent = activeBtn ? activeBtn.innerHTML : '';

    if (activeBtn) {
        activeBtn.disabled = true;
        activeBtn.innerHTML = '<span class="loading-spinner"></span> Processing...';
    }

    try {
        if (method === 'stripe') {
            // Create Stripe checkout session
            const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
            const response = await fetch(`${API_URL}/store/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    recipeId: id,
                    successUrl: `${baseUrl}/pages/payment-success.html?type=recipe&recipe_id=${id}`,
                    cancelUrl: `${baseUrl}/index.html`
                })
            });

            const data = await response.json();

            if (response.ok && data.url) {
                window.location.href = data.url;
                return;
            } else {
                throw new Error(data.error || 'Failed to create checkout session');
            }
        } else {
            // Wallet purchase
            const response = await fetch(`/api/store/${id}/purchase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showNotification(data.message || 'Recipe purchased successfully! 🎉', 'success');
                // Close purchase modal
                const purchaseModal = document.getElementById('storePurchaseModal');
                if (purchaseModal) purchaseModal.classList.remove('show');
                // Reload the recipe view
                if (typeof viewStoreRecipe === 'function') {
                    viewStoreRecipe(id);
                }
            } else {
                showNotification(data.error || '❌ Purchase failed.', 'error');
                if (activeBtn) {
                    activeBtn.disabled = false;
                    activeBtn.innerHTML = originalContent;
                }
            }
        }
    } catch (err) {
        console.error('Purchase error:', err);
        showNotification(err.message || '❌ Purchase failed.', 'error');
        if (activeBtn) {
            activeBtn.disabled = false;
            activeBtn.innerHTML = originalContent;
        }
    }
}


export function showFullStoreRecipe(recipe) {
    const modal = document.getElementById('storeRecipeViewModal');
    const body = document.getElementById('storeRecipeViewBody');
    if (!modal || !body) return;

    body.innerHTML = `
        <div style="padding: 10px;">
            ${recipe.photo ? `<img src="${recipe.photo}" alt="${recipe.name}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 16px; margin-bottom: 20px;">` : ''}
            ${recipe.video ? `<video src="${recipe.video}" controls style="width: 100%; max-height: 300px; border-radius: 16px; margin-bottom: 20px; background: #000;"></video>` : ''}
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                <h2 style="margin: 0 0 8px; flex: 1;">${recipe.name}</h2>
                <button id="addToMenuStoreRecipeBtn" class="btn btn-primary" style="padding: 8px 15px; border-radius: 12px; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; white-space: nowrap;">
                    <span>📅</span> Add to Menu
                </button>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                <img src="${recipe.seller.pic || `https://ui-avatars.com/api/?name=${recipe.seller.name}&background=random`}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">
                <span style="color: var(--accent-pink); font-weight: 600;">${recipe.seller.name}</span>
                <span class="store-price-tag" style="position: static; margin-left: auto;">$${recipe.price.toFixed(2)}</span>
            </div>
            ${recipe.description ? `<p style="color: var(--text-secondary); margin-bottom: 16px; line-height: 1.5;">${recipe.description}</p>` : ''}
            <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                <span style="background: rgba(255,107,138,0.1); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">📂 ${recipe.category}</span>
                ${recipe.difficulty ? `<span style="background: rgba(77,182,172,0.1); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">⚡ ${recipe.difficulty}</span>` : ''}
                ${recipe.prepTime ? `<span style="background: rgba(255,154,86,0.1); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">⏱️ Prep: ${recipe.prepTime}m</span>` : ''}
                ${recipe.cookTime ? `<span style="background: rgba(156,136,255,0.1); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">🔥 Cook: ${recipe.cookTime}m</span>` : ''}
            </div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; margin-bottom: 16px;">
                <h3 style="margin: 0 0 10px; font-size: 1rem; color: var(--accent-pink);">🧾 Ingredients</h3>
                <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; line-height: 1.6; color: var(--text-primary);">${recipe.ingredients || 'N/A'}</pre>
            </div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; margin-bottom: 16px;">
                <h3 style="margin: 0 0 10px; font-size: 1rem; color: var(--accent-orange, #ff9a56);">📝 Instructions</h3>
                <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; line-height: 1.6; color: var(--text-primary);">${recipe.instructions || 'N/A'}</pre>
            </div>
            ${recipe.notes ? `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px;">
                <h3 style="margin: 0 0 10px; font-size: 1rem; color: #fbbf24;">💡 Chef's Notes</h3>
                <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; line-height: 1.6; color: var(--text-secondary);">${recipe.notes}</pre>
            </div>` : ''}
        </div>
    `;

    // Attach add to menu handler
    const menuBtn = document.getElementById('addToMenuStoreRecipeBtn');
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            window.openDayPickerModal(recipe);
        });
    }

    modal.classList.add('show');
}

export async function loadMyListings() {
    const grid = document.getElementById('myListingsGrid');
    const emptyState = document.getElementById('storeEmptyState');
    const token = sessionStorage.getItem('authToken');
    if (!grid || !token) return;

    try {
        const response = await fetch(`${API_URL}/store/my/listings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const listings = await response.json();

        grid.innerHTML = '';

        if (listings.length === 0) {
            if (emptyState) { emptyState.style.display = 'block'; emptyState.querySelector('h3').textContent = 'No listings yet'; emptyState.querySelector('p').textContent = 'Start adding your secret recipes to pay!'; }
        } else {
            if (emptyState) emptyState.style.display = 'none';
            listings.forEach(recipe => {
                const card = document.createElement('div');
                card.className = 'store-card';
                card.innerHTML = `
                    <div class="store-card-image">
                        ${recipe.photo
                        ? `<img src="${recipe.photo}" alt="${recipe.name}" style="width: 100%; height: 180px; object-fit: cover;">`
                        : `<div style="width: 100%; height: 180px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(255,107,138,0.15), rgba(255,154,86,0.15)); font-size: 3rem;">🧁</div>`
                    }
                        <div class="store-price-tag">$${recipe.price.toFixed(2)}</div>
                    </div>
                    <div class="store-card-body">
                        <h3 class="store-card-title">${recipe.name}</h3>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">📊 ${recipe.salesCount} sales</span>
                            <button class="btn btn-danger btn-sm" onclick="deleteStoreRecipe(${recipe.id})" style="padding: 4px 12px; font-size: 0.8rem; border-radius: 8px;">🗑️ Delete</button>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        }
    } catch (err) {
        console.error('Load listings error:', err);
    }
}

export async function loadMyPurchases() {
    const grid = document.getElementById('purchasedGrid');
    const emptyState = document.getElementById('storeEmptyState');
    const token = sessionStorage.getItem('authToken');
    if (!grid || !token) return;

    try {
        const response = await fetch(`${API_URL}/store/my/purchases`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const purchases = await response.json();

        grid.innerHTML = '';

        if (purchases.length === 0) {
            if (emptyState) { emptyState.style.display = 'block'; emptyState.querySelector('h3').textContent = 'No purchases yet'; emptyState.querySelector('p').textContent = 'Browse the store to find recipes you love!'; }
        } else {
            if (emptyState) emptyState.style.display = 'none';
            purchases.forEach(recipe => {
                const card = document.createElement('div');
                card.className = 'store-card';
                card.innerHTML = `
                    <div class="store-card-image">
                        ${recipe.photo
                        ? `<img src="${recipe.photo}" alt="${recipe.name}" style="width: 100%; height: 180px; object-fit: cover;">`
                        : `<div style="width: 100%; height: 180px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(255,107,138,0.15), rgba(255,154,86,0.15)); font-size: 3rem;">🧁</div>`
                    }
                        <div class="store-price-tag" style="background: linear-gradient(135deg, #10b981, #059669);">✅ Owned</div>
                    </div>
                    <div class="store-card-body">
                        <h3 class="store-card-title">${recipe.name}</h3>
                        <div class="store-card-meta">
                            <span class="store-card-category">${recipe.category}</span>
                            <span class="store-card-seller">
                                <img src="${recipe.seller.pic || `https://ui-avatars.com/api/?name=${recipe.seller.name}&background=random`}" alt="" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover;">
                                ${recipe.seller.name}
                            </span>
                        </div>
                        <button class="btn btn-primary store-view-btn" onclick="viewStoreRecipe(${recipe.id})" style="width: 100%; margin-top: 10px; padding: 8px; border-radius: 10px;">
                            <span>📖</span> View Recipe
                        </button>
                    </div>
                `;
                grid.appendChild(card);
            });
        }
    } catch (err) {
        console.error('Load purchases error:', err);
    }
}

export async function deleteStoreRecipe(id) {
    if (!confirm('Are you sure you want to remove this recipe from the store?')) return;

    const token = sessionStorage.getItem('authToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/store/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showNotification('✅ Recipe removed from store.', 'success');
            loadMyListings();
        } else {
            const data = await response.json();
            showNotification(data.error || '❌ Failed to delete.', 'error');
        }
    } catch (err) {
        console.error('Delete store recipe error:', err);
    }
}

export function openSellRecipeModalWithData(recipe) {
    const sellRecipeModal = document.getElementById('sellRecipeModal');
    const sellRecipeForm = document.getElementById('sellRecipeForm');
    if (!sellRecipeModal || !sellRecipeForm) return;

    // Reset first to clear previous states
    sellRecipeForm.reset();

    // Pre-fill fields
    document.getElementById('sellRecipeName').value = recipe.name || '';
    
    const categorySelect = document.getElementById('sellRecipeCategory');
    if (categorySelect && recipe.category) {
        categorySelect.value = recipe.category;
    }

    document.getElementById('sellRecipePrice').value = '5.00'; // Default price
    document.getElementById('sellRecipeDesc').value = recipe.notes || ''; // Use notes as description fallback
    document.getElementById('sellRecipeIngredients').value = recipe.ingredients || '';
    document.getElementById('sellRecipeInstructions').value = recipe.instructions || '';
    document.getElementById('sellRecipeNotes').value = recipe.notes || '';

    // Save extra data in form's dataset attributes
    sellRecipeForm.dataset.prepTime = recipe.prepTime || 0;
    sellRecipeForm.dataset.cookTime = recipe.cookTime || 0;
    sellRecipeForm.dataset.difficulty = recipe.difficulty || 'Medium';
    sellRecipeForm.dataset.video = recipe.video || '';
    sellRecipeForm.dataset.source = 'my-recipes';

    // Handle Photo preview
    sellRecipePhoto = recipe.photo || null;
    const preview = document.getElementById('sellRecipePhotoPreview');
    const placeholder = document.getElementById('sellUploadPlaceholder');
    if (recipe.photo) {
        if (preview) {
            preview.src = recipe.photo;
            preview.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
    } else {
        if (preview) {
            preview.style.display = 'none';
            preview.src = '';
        }
        if (placeholder) placeholder.style.display = 'block';
    }

    // Show the modal
    sellRecipeModal.classList.add('show');
}

// Expose store functions globally
window.viewStoreRecipe = viewStoreRecipe;
window.deleteStoreRecipe = deleteStoreRecipe;
window.openSellRecipeModalWithData = openSellRecipeModalWithData;


