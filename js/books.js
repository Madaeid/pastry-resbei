import { showNotification } from './ui-utils.js';
import { getCurrentUser } from './auth.js';
import { isPremium } from './payment.js';
import { jsPDF } from 'jspdf';
import { getCategoryEmoji, getDifficultyText } from './recipe-utils.js';
import { fetchAndUpdateWalletBtn } from './store.js';

const BOOK_API = '/api/books';

// Book state — must be declared here (not in main.js) to stay in module scope
let currentBookId = null;
let currentBookRecipes = [];

// Theme color map
const bookThemeColors = {
    classic: '#C67B4B',
    modern: '#667eea',
    minimal: '#2c3e50',
    rustic: '#8B6914'
};

export async function loadBooks() {
    const grid = document.getElementById('booksGrid');
    const empty = document.getElementById('booksEmptyState');
    const listView = document.getElementById('bookListView');
    const detailView = document.getElementById('bookDetailView');
    const myBooksSection = document.getElementById('myBooksSection');
    if (!grid) return;

    // Update sub-tab buttons active state
    document.querySelectorAll('.book-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.bookTab === 'my-books');
    });

    // Show My Books sub-tab, hide others, show list view, hide detail
    if (myBooksSection) myBooksSection.style.display = '';
    const browseBooksSection = document.getElementById('browseBooksSection');
    const purchasedBooksSection = document.getElementById('purchasedBooksSection');
    if (browseBooksSection) browseBooksSection.style.display = 'none';
    if (purchasedBooksSection) purchasedBooksSection.style.display = 'none';

    listView.style.display = '';
    detailView.style.display = 'none';
    currentBookId = null;

    const token = sessionStorage.getItem('authToken');
    if (!token) return;

    try {
        grid.innerHTML = '<div class="loading">Loading books...</div>';
        const res = await fetch(BOOK_API, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const books = data.books || [];

        grid.innerHTML = '';
        if (books.length === 0) {
            empty.classList.add('show');
            grid.style.display = 'none';
        } else {
            empty.classList.remove('show');
            grid.style.display = '';
            books.forEach(book => {
                grid.appendChild(createBookCard(book));
            });
        }
    } catch (err) {
        console.error('Load books error:', err);
        grid.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">Failed to load books.</p>';
    }
}

export function createBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.onclick = () => openBookDetail(book.id);

    const themeColor = bookThemeColors[book.theme] || bookThemeColors.classic;
    const coverHtml = book.cover_photo
        ? `<img class="book-card-cover" src="${book.cover_photo}" alt="${book.title}">`
        : `<div class="book-card-cover-placeholder">📚</div>`;

    const date = new Date(book.updated_at || book.created_at);
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    const priceVal = parseFloat(book.price) || 0;
    const priceHtml = priceVal > 0
        ? `<span class="book-card-price" style="color: #10b981; font-weight: 700;">$${priceVal.toFixed(2)}</span>`
        : `<span class="book-card-price" style="color: var(--text-secondary); opacity: 0.6;">Free</span>`;

    card.innerHTML = `
        <div class="book-card-theme-dot" style="background: ${themeColor};"></div>
        ${coverHtml}
        <div class="book-card-body">
            <div class="book-card-title">${book.title}</div>
            <div class="book-card-meta">
                <span class="book-card-count">📖 ${book.recipe_count || 0} recipes</span>
                ${priceHtml}
                <span class="book-card-date">${dateStr}</span>
            </div>
        </div>
    `;
    return card;
}

export async function openBookDetail(bookId) {
    const token = sessionStorage.getItem('authToken');
    if (!token) return;

    try {
        const res = await fetch(`${BOOK_API}/${bookId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Failed to load book');
        const data = await res.json();

        currentBookId = bookId;
        currentBookRecipes = data.recipes || [];

        const listView = document.getElementById('bookListView');
        const detailView = document.getElementById('bookDetailView');
        listView.style.display = 'none';
        detailView.style.display = '';

        // Fill editor
        document.getElementById('bookDetailTitle').textContent = data.book.title;
        document.getElementById('bookTitleInput').value = data.book.title;
        document.getElementById('bookDescInput').value = data.book.description || '';
        document.getElementById('bookPriceInput').value = parseFloat(data.book.price) || 0;

        // is_public toggle
        const isPublicCheckbox = document.getElementById('bookIsPublic');
        if (isPublicCheckbox) isPublicCheckbox.checked = data.book.is_public === true;

        // Cover
        const coverPreview = document.getElementById('bookCoverPreview');
        const coverPlaceholder = document.getElementById('bookCoverPlaceholder');
        if (data.book.cover_photo) {
            coverPreview.src = data.book.cover_photo;
            coverPreview.style.display = 'block';
            coverPlaceholder.style.display = 'none';
        } else {
            coverPreview.style.display = 'none';
            coverPlaceholder.style.display = '';
        }

        // Theme buttons
        document.querySelectorAll('.book-theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === (data.book.theme || 'classic'));
        });

        renderBookRecipesList();
        setupBookDetailListeners();
    } catch (err) {
        console.error('Open book error:', err);
        showNotification('❌ Failed to load book', 'error');
    }
}

export function renderBookRecipesList() {
    const list = document.getElementById('bookRecipesList');
    const empty = document.getElementById('bookRecipesEmpty');
    if (!list) return;

    list.innerHTML = '';
    if (currentBookRecipes.length === 0) {
        empty.style.display = '';
        list.style.display = 'none';
        return;
    }

    empty.style.display = 'none';
    list.style.display = '';

    currentBookRecipes.forEach((r, idx) => {
        const item = document.createElement('div');
        item.className = 'book-recipe-item';

        const photoHtml = r.photo
            ? `<img class="book-recipe-photo" src="${r.photo}" alt="${r.name}">`
            : `<div class="book-recipe-photo-placeholder">${getCategoryEmoji(r.category)}</div>`;

        item.innerHTML = `
            <div class="book-recipe-order">${idx + 1}</div>
            ${photoHtml}
            <div class="book-recipe-info">
                <div class="book-recipe-name">${r.name}</div>
                <div class="book-recipe-category">${r.category || ''} • ${getDifficultyText(r.difficulty)}</div>
            </div>
            <div class="book-recipe-actions">
                <button title="Move Up" onclick="moveBookRecipe(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''}>⬆️</button>
                <button title="Move Down" onclick="moveBookRecipe(${idx}, 1)" ${idx === currentBookRecipes.length - 1 ? 'disabled style="opacity:0.3"' : ''}>⬇️</button>
                <button class="btn-remove-recipe" title="Remove" onclick="removeBookRecipe(${r.id})">✕</button>
            </div>
        `;
        list.appendChild(item);
    });
}

let bookDetailListenersSet = false;
export function setupBookDetailListeners() {
    if (bookDetailListenersSet) return;
    bookDetailListenersSet = true;

    // Back button
    document.getElementById('bookBackBtn')?.addEventListener('click', loadBooks);

    // Cover upload
    const coverUpload = document.getElementById('bookCoverUpload');
    const coverInput = document.getElementById('bookCoverInput');
    if (coverUpload && coverInput) {
        coverUpload.onclick = () => coverInput.click();
        coverInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 500 * 1024) {
                showNotification('❌ Cover image must be under 500KB', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('bookCoverPreview').src = ev.target.result;
                document.getElementById('bookCoverPreview').style.display = 'block';
                document.getElementById('bookCoverPlaceholder').style.display = 'none';
            };
            reader.readAsDataURL(file);
        };
    }

    // Theme selector
    document.querySelectorAll('.book-theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.book-theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Save meta
    document.getElementById('bookSaveMetaBtn')?.addEventListener('click', saveBookMeta);

    // Add recipes
    document.getElementById('bookAddRecipesBtn')?.addEventListener('click', openRecipePicker);

    // Delete book
    document.getElementById('deleteBookBtn')?.addEventListener('click', deleteCurrentBook);

    // Preview
    document.getElementById('bookPreviewBtn')?.addEventListener('click', openBookPreview);

    // Export PDF
    document.getElementById('bookExportPdfBtn')?.addEventListener('click', exportBookPdf);

    // Recipe picker modal close
    document.getElementById('closeRecipePickerModal')?.addEventListener('click', () => {
        document.getElementById('bookRecipePickerModal').classList.remove('show');
    });
    document.getElementById('bookRecipePickerModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('bookRecipePickerModal')) e.target.classList.remove('show');
    });

    // Picker add button
    document.getElementById('recipePickerAddBtn')?.addEventListener('click', addSelectedRecipes);

    // Preview modal close
    document.getElementById('closeBookPreviewModal')?.addEventListener('click', () => {
        document.getElementById('bookPreviewModal').classList.remove('show');
    });
    document.getElementById('bookPreviewModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('bookPreviewModal')) e.target.classList.remove('show');
    });

    // Create book modal
    const openCreateModal = () => {
        document.getElementById('newBookTitle').value = '';
        document.getElementById('newBookDesc').value = '';
        document.getElementById('newBookPrice').value = '0';
        document.getElementById('createBookModal').classList.add('show');
    };
    document.getElementById('createBookBtn')?.addEventListener('click', openCreateModal);
    document.getElementById('createBookEmptyBtn')?.addEventListener('click', openCreateModal);
    document.getElementById('closeCreateBookModal')?.addEventListener('click', () => {
        document.getElementById('createBookModal').classList.remove('show');
    });
    document.getElementById('createBookModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('createBookModal')) e.target.classList.remove('show');
    });
    document.getElementById('createBookSubmitBtn')?.addEventListener('click', createNewBook);
}

// Initialize book listeners on first tab visit
setupBookDetailListeners();

export async function saveBookMeta() {
    if (!currentBookId) return;
    const token = sessionStorage.getItem('authToken');
    const title = document.getElementById('bookTitleInput').value.trim();
    const description = document.getElementById('bookDescInput').value.trim();
    const price = parseFloat(document.getElementById('bookPriceInput').value) || 0;

    if (price > 0 && !isPremium()) {
        showNotification('❌ Selling books (setting a price) is a premium-only feature.', 'error');
        return;
    }

    const is_public = document.getElementById('bookIsPublic')?.checked || false;
    const theme = document.querySelector('.book-theme-btn.active')?.dataset.theme || 'classic';
    const coverImg = document.getElementById('bookCoverPreview');
    const cover_photo = coverImg?.style.display !== 'none' ? coverImg.src : null;

    try {
        const res = await fetch(`${BOOK_API}/${currentBookId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title, description, theme, cover_photo, price, is_public })
        });
        if (!res.ok) throw new Error('Update failed');
        document.getElementById('bookDetailTitle').textContent = title;
        showNotification('✅ Book updated!', 'success');
    } catch (err) {
        console.error('Save book meta error:', err);
        showNotification('❌ Failed to save changes', 'error');
    }
}

export async function createNewBook() {
    const token = sessionStorage.getItem('authToken');
    const title = document.getElementById('newBookTitle').value.trim();
    const description = document.getElementById('newBookDesc').value.trim();
    const price = parseFloat(document.getElementById('newBookPrice').value) || 0;
    if (!title) { showNotification('❌ Please enter a book title', 'error'); return; }

    if (price > 0 && !isPremium()) {
        showNotification('❌ Selling books (setting a price) is a premium-only feature.', 'error');
        return;
    }

    try {
        const res = await fetch(BOOK_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title, description, price })
        });
        const data = await res.json();
        if (!res.ok) {
            showNotification(`❌ ${data.message || data.error}`, 'error');
            if (data.code === 'LIMIT_REACHED') {
                setTimeout(() => showUpgradePrompt('default', 'book'), 500);
            }
            return;
        }
        document.getElementById('createBookModal').classList.remove('show');
        showNotification('✅ Book created!', 'success');
        loadBooks();
    } catch (err) {
        console.error('Create book error:', err);
        showNotification('❌ Failed to create book', 'error');
    }
}

export async function deleteCurrentBook() {
    if (!currentBookId) return;
    if (!confirm('Are you sure you want to delete this book? This cannot be undone.')) return;
    const token = sessionStorage.getItem('authToken');
    try {
        await fetch(`${BOOK_API}/${currentBookId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        showNotification('🗑️ Book deleted', 'success');
        loadBooks();
    } catch (err) {
        showNotification('❌ Failed to delete book', 'error');
    }
}

export async function openRecipePicker() {
    if (!currentBookId) return;
    const token = sessionStorage.getItem('authToken');
    const list = document.getElementById('recipePickerList');
    const searchInput = document.getElementById('recipePickerSearch');
    list.innerHTML = '<p style="text-align:center;padding:20px">Loading...</p>';
    document.getElementById('bookRecipePickerModal').classList.add('show');
    document.getElementById('recipePickerCount').textContent = '0';
    if (searchInput) searchInput.value = '';

    try {
        const res = await fetch(`${BOOK_API}/${currentBookId}/available-recipes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const recipes = await res.json();
        window._pickerRecipes = recipes;
        renderPickerList(recipes);

        if (searchInput) {
            searchInput.oninput = () => {
                const q = searchInput.value.toLowerCase().trim();
                const filtered = recipes.filter(r => r.name.toLowerCase().includes(q) || (r.category || '').toLowerCase().includes(q));
                renderPickerList(filtered);
            };
        }
    } catch (err) {
        list.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">Failed to load recipes.</p>';
    }
}

export function renderPickerList(recipes) {
    const list = document.getElementById('recipePickerList');
    list.innerHTML = '';

    if (recipes.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:30px">No recipes found. Add recipes in the My Recipes tab first!</p>';
        return;
    }

    recipes.forEach(r => {
        const item = document.createElement('div');
        const inBook = r.in_book === true || r.in_book === 't';
        item.className = `recipe-picker-item${inBook ? ' in-book' : ''}`;
        item.dataset.id = r.id;

        const photoHtml = r.photo
            ? `<img class="recipe-picker-photo" src="${r.photo}" alt="${r.name}">`
            : `<div class="recipe-picker-photo-placeholder">${getCategoryEmoji(r.category)}</div>`;

        item.innerHTML = `
            <div class="recipe-picker-checkbox">${inBook ? '✓' : ''}</div>
            ${photoHtml}
            <div class="recipe-picker-info">
                <div class="recipe-picker-name">${r.name}</div>
                <div class="recipe-picker-detail">${r.category || 'Uncategorized'}${inBook ? ' • Already in book' : ''}</div>
            </div>
        `;

        if (!inBook) {
            item.onclick = () => {
                item.classList.toggle('selected');
                const cb = item.querySelector('.recipe-picker-checkbox');
                cb.textContent = item.classList.contains('selected') ? '✓' : '';
                updatePickerCount();
            };
        }
        list.appendChild(item);
    });
}

export function updatePickerCount() {
    const count = document.querySelectorAll('.recipe-picker-item.selected').length;
    document.getElementById('recipePickerCount').textContent = count;
}

export async function addSelectedRecipes() {
    const selected = document.querySelectorAll('.recipe-picker-item.selected');
    if (selected.length === 0) { showNotification('Select at least one recipe', 'error'); return; }
    const recipeIds = Array.from(selected).map(el => parseInt(el.dataset.id));
    const token = sessionStorage.getItem('authToken');

    try {
        const res = await fetch(`${BOOK_API}/${currentBookId}/recipes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ recipeIds })
        });
        if (!res.ok) throw new Error('Failed');
        document.getElementById('bookRecipePickerModal').classList.remove('show');
        showNotification(`✅ Added ${recipeIds.length} recipe(s)!`, 'success');
        openBookDetail(currentBookId);
    } catch (err) {
        showNotification('❌ Failed to add recipes', 'error');
    }
}

window.removeBookRecipe = async function (recipeId) {
    if (!currentBookId) return;
    const token = sessionStorage.getItem('authToken');
    try {
        await fetch(`${BOOK_API}/${currentBookId}/recipes/${recipeId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        currentBookRecipes = currentBookRecipes.filter(r => r.id !== recipeId);
        renderBookRecipesList();
        showNotification('Recipe removed from book', 'success');
    } catch (err) {
        showNotification('❌ Failed to remove recipe', 'error');
    }
};

window.moveBookRecipe = async function (index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentBookRecipes.length) return;

    // Swap in array
    [currentBookRecipes[index], currentBookRecipes[newIndex]] = [currentBookRecipes[newIndex], currentBookRecipes[index]];
    renderBookRecipesList();

    // Save new order
    const token = sessionStorage.getItem('authToken');
    const recipeOrder = currentBookRecipes.map((r, i) => ({ recipeId: r.id, orderIndex: i }));
    try {
        await fetch(`${BOOK_API}/${currentBookId}/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ recipeOrder })
        });
    } catch (err) {
        console.error('Reorder error:', err);
    }
};

export function openBookPreview() {
    const body = document.getElementById('bookPreviewBody');
    const title = document.getElementById('bookTitleInput').value.trim() || 'My Chef Book';
    const desc = document.getElementById('bookDescInput').value.trim();
    const coverImg = document.getElementById('bookCoverPreview');
    const hasCover = coverImg?.style.display !== 'none' && coverImg?.src;

    let html = '';

    // Cover page
    html += `<div class="book-preview-page book-preview-cover">`;
    if (hasCover) {
        html += `<img class="book-preview-cover-img" src="${coverImg.src}" alt="Cover">`;
    } else {
        html += `<div class="book-preview-cover-placeholder">📚</div>`;
    }
    html += `<h1>${title}</h1>`;
    if (desc) html += `<p>${desc}</p>`;
    html += `<p style="opacity:0.5;font-size:0.9rem">${new Date().toLocaleDateString()}</p>`;
    html += `</div>`;

    // Table of Contents
    if (currentBookRecipes.length > 0) {
        html += `<div class="book-preview-page book-preview-toc"><h2>Table of Contents</h2>`;
        currentBookRecipes.forEach((r, i) => {
            html += `<div class="toc-item"><span><span class="toc-number">${i + 1}.</span> ${r.name}</span><span>${r.category || ''}</span></div>`;
        });
        html += `</div>`;

        // Recipe pages
        currentBookRecipes.forEach((r, i) => {
            html += `<div class="book-preview-page book-preview-recipe">`;
            html += `<h2>${getCategoryEmoji(r.category)} ${r.name}</h2>`;
            html += `<div class="book-preview-recipe-meta">`;
            html += `<span>📂 ${r.category || 'Uncategorized'}</span>`;
            html += `<span>⏱️ Prep: ${r.prep_time || 0}min</span>`;
            html += `<span>🔥 Cook: ${r.cook_time || 0}min</span>`;
            html += `<span>${getDifficultyText(r.difficulty)}</span>`;
            html += `</div>`;
            if (r.photo) html += `<img class="book-preview-recipe-photo" src="${r.photo}" alt="${r.name}">`;
            if (r.ingredients) html += `<h3>🧂 Ingredients</h3><p>${r.ingredients}</p>`;
            if (r.instructions) html += `<h3>📝 Instructions</h3><p>${r.instructions}</p>`;
            if (r.notes) html += `<h3>💡 Chef's Notes</h3><p>${r.notes}</p>`;
            html += `</div>`;
        });
    }

    body.innerHTML = html;
    document.getElementById('bookPreviewModal').classList.add('show');
}

export function exportBookPdf() {
    if (!isPremium()) {
        showUpgradePrompt('pdf_export');
        return;
    }
    if (currentBookRecipes.length === 0) {
        showNotification('Add recipes to your book first!', 'error');
        return;
    }

    const title = document.getElementById('bookTitleInput').value.trim() || 'My Chef Book';
    const theme = document.querySelector('.book-theme-btn.active')?.dataset.theme || 'classic';
    const colors = { classic: [198, 123, 75], modern: [102, 126, 234], minimal: [44, 62, 80], rustic: [139, 105, 20] };
    const c = colors[theme] || colors.classic;

    const doc = new jsPDF();

    // Cover
    doc.setFillColor(c[0], c[1], c[2]);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(title, 160);
    doc.text(titleLines, 105, 120, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`${currentBookRecipes.length} Recipes`, 105, 160, { align: 'center' });
    doc.text(new Date().toLocaleDateString(), 105, 280, { align: 'center' });

    // TOC
    doc.addPage();
    doc.setTextColor(c[0], c[1], c[2]);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Table of Contents', 20, 30);
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    currentBookRecipes.forEach((r, i) => {
        doc.text(`${i + 1}. ${r.name}`, 25, 50 + i * 10);
    });

    // Recipe pages
    currentBookRecipes.forEach((r, i) => {
        doc.addPage();
        doc.setFillColor(c[0], c[1], c[2]);
        doc.rect(0, 0, 210, 35, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(r.name, 15, 23);

        let y = 45;
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`${r.category || ''} | Prep: ${r.prep_time || 0}min | Cook: ${r.cook_time || 0}min | ${r.difficulty || 'Medium'}`, 15, y);
        y += 15;

        if (r.ingredients) {
            doc.setTextColor(c[0], c[1], c[2]);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Ingredients', 15, y); y += 8;
            doc.setTextColor(60, 60, 60);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const ingLines = doc.splitTextToSize(r.ingredients, 180);
            doc.text(ingLines, 15, y); y += ingLines.length * 5 + 10;
        }
        if (r.instructions) {
            if (y > 240) { doc.addPage(); y = 20; }
            doc.setTextColor(c[0], c[1], c[2]);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Instructions', 15, y); y += 8;
            doc.setTextColor(60, 60, 60);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const insLines = doc.splitTextToSize(r.instructions, 180);
            doc.text(insLines, 15, y); y += insLines.length * 5 + 10;
        }
        if (r.notes) {
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setTextColor(c[0], c[1], c[2]);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("Chef's Notes", 15, y); y += 8;
            doc.setTextColor(60, 60, 60);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const noteLines = doc.splitTextToSize(r.notes, 180);
            doc.text(noteLines, 15, y);
        }

        doc.setTextColor(150, 150, 150);
        doc.setFontSize(9);
        doc.text(`Recipe ${i + 1} of ${currentBookRecipes.length}`, 105, 290, { align: 'center' });
    });

    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    doc.save(`${safeTitle}.pdf`);
    showNotification('📄 Book exported as PDF!', 'success');
}

// ===== BOOK MARKETPLACE FUNCTIONS =====

// Sub-tab switching
document.querySelectorAll('.book-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.book-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tab = btn.dataset.bookTab;
        document.getElementById('myBooksSection').style.display = tab === 'my-books' ? '' : 'none';
        document.getElementById('browseBooksSection').style.display = tab === 'browse-books' ? '' : 'none';
        document.getElementById('purchasedBooksSection').style.display = tab === 'purchased-books' ? '' : 'none';

        if (tab === 'browse-books') loadBrowseBooks();
        if (tab === 'purchased-books') loadPurchasedBooks();
        if (tab === 'my-books') loadBooks();
    });
});

// Browse public books
export async function loadBrowseBooks() {
    const grid = document.getElementById('browseBooksGrid');
    const empty = document.getElementById('browseBooksEmpty');
    if (!grid) return;

    grid.innerHTML = '<div class="loading">Loading marketplace...</div>';
    empty.style.display = 'none';

    try {
        const res = await fetch(`${BOOK_API}/public/browse`);
        const books = await res.json();

        grid.innerHTML = '';
        if (books.length === 0) {
            empty.style.display = '';
            grid.style.display = 'none';
        } else {
            empty.style.display = 'none';
            grid.style.display = '';
            books.forEach(book => {
                grid.appendChild(createPublicBookCard(book));
            });
        }
    } catch (err) {
        console.error('Browse books error:', err);
        grid.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">Failed to load books.</p>';
    }
}

export function createPublicBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-card book-card-public';
    card.onclick = () => viewPublicBook(book.id);

    const themeColor = bookThemeColors[book.theme] || bookThemeColors.classic;
    const coverHtml = book.coverPhoto
        ? `<img class="book-card-cover" src="${book.coverPhoto}" alt="${book.title}">`
        : `<div class="book-card-cover-placeholder">📚</div>`;

    const priceVal = book.price || 0;
    const priceHtml = priceVal > 0
        ? `<span class="book-card-price" style="color: #10b981; font-weight: 700;">$${priceVal.toFixed(2)}</span>`
        : `<span class="book-card-price" style="color: var(--accent-orange); font-weight: 600;">Free</span>`;

    const authorPic = book.author?.pic
        ? `<img src="${book.author.pic}" alt="" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.2);">`
        : `<span style="font-size: 1rem;">👨‍🍳</span>`;

    card.innerHTML = `
        <div class="book-card-theme-dot" style="background: ${themeColor};"></div>
        ${coverHtml}
        <div class="book-card-body">
            <div class="book-card-title">${book.title}</div>
            ${book.description ? `<p style="font-size: 0.82rem; color: var(--text-secondary); margin: 4px 0 8px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${book.description}</p>` : ''}
            <div class="book-card-author" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                ${authorPic}
                <span style="font-size: 0.85rem; color: var(--accent-orange); font-weight: 500;">@${book.author?.username || 'unknown'}</span>
            </div>
            <div class="book-card-meta">
                <span class="book-card-count">📖 ${book.recipeCount || 0} recipes</span>
                ${priceHtml}
            </div>
        </div>
    `;
    return card;
}

// View public book modal
export async function viewPublicBook(bookId) {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
        showNotification('Please log in to view books', 'error');
        return;
    }

    const body = document.getElementById('publicBookBody');
    body.innerHTML = '<div class="loading" style="padding: 40px; text-align: center;">Loading book...</div>';
    document.getElementById('viewPublicBookModal').classList.add('show');

    try {
        const res = await fetch(`${BOOK_API}/public/${bookId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load book');
        const data = await res.json();

        const priceVal = data.price || 0;
        const coverHtml = data.coverPhoto
            ? `<img src="${data.coverPhoto}" alt="${data.title}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 16px; margin-bottom: 20px;">`
            : '';

        const authorPic = data.author?.pic
            ? `<img src="${data.author.pic}" alt="" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(198,123,75,0.3);">`
            : `<div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, rgba(198,123,75,0.2), rgba(139,69,19,0.2)); display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">👨‍🍳</div>`;

        let actionHtml = '';
        if (data.isOwner) {
            actionHtml = '<div style="padding: 12px 20px; background: rgba(198,123,75,0.1); border-radius: 12px; text-align: center; color: var(--accent-orange); font-weight: 600;">📚 This is your book</div>';
        } else if (data.hasPurchased || priceVal === 0) {
            actionHtml = '<div style="padding: 12px 20px; background: rgba(16,185,129,0.1); border-radius: 12px; text-align: center; color: #10b981; font-weight: 600;">✅ You own this book</div>';
        } else {
            actionHtml = `
                <div style="margin-bottom: 10px;">
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 10px; text-align: center; font-weight: 600;">Choose Payment Method</p>
                </div>
                <button id="bookWalletBtn" class="btn" style="width: 100%; padding: 14px 16px; font-size: 1rem; border-radius: 14px; font-weight: 700; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 10px; transition: all 0.3s ease;" onclick="purchaseBook(${bookId}, 'wallet')">
                    <span style="font-size: 1.2rem;">💰</span>
                    <span>Pay with Wallet</span>
                    <span id="bookWalletBalanceTag" style="background: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">Loading...</span>
                </button>
                <p id="bookWalletInsufficientMsg" style="display: none; text-align: center; font-size: 0.78rem; color: #ef4444; margin: -4px 0 10px;">⚠️ Insufficient wallet balance. Deposit funds in your wallet first.</p>
                <button id="bookStripeBtn" class="btn" style="width: 100%; padding: 14px 16px; font-size: 1rem; border-radius: 14px; font-weight: 700; background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.3s ease;" onclick="purchaseBook(${bookId}, 'stripe')">
                    <span style="font-size: 1.2rem;">💳</span>
                    <span>Pay with Stripe</span>
                    <span style="background: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">Visa / Card</span>
                </button>
            `;
        }

        let recipesHtml = '';
        if (data.canViewFull && data.recipes && data.recipes.length > 0) {
            recipesHtml = '<div style="margin-top: 24px;"><h3 style="font-family: \'Playfair Display\', serif; font-size: 1.4rem; margin-bottom: 16px;">📖 Recipes</h3>';
            data.recipes.forEach((r, i) => {
                const photoHtml = r.photo
                    ? `<img src="${r.photo}" alt="${r.name}" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover; flex-shrink: 0;">`
                    : `<div style="width: 60px; height: 60px; border-radius: 12px; background: linear-gradient(135deg, rgba(198,123,75,0.15), rgba(139,69,19,0.15)); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0;">🍽️</div>`;

                recipesHtml += `
                    <div style="display: flex; align-items: center; gap: 16px; padding: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; margin-bottom: 10px; cursor: pointer;" onclick="this.querySelector('.recipe-expand')?.classList.toggle('show')">
                        <div style="width: 32px; height: 32px; background: var(--primary-gradient); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.85rem; flex-shrink: 0;">${i + 1}</div>
                        ${photoHtml}
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; color: var(--text-primary);">${r.name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">${r.category || ''} • ${r.difficulty || 'Medium'}</div>
                        </div>
                        <span style="font-size: 1.2rem; opacity: 0.5;">▼</span>
                    </div>
                    <div class="recipe-expand" style="display: none; padding: 16px 20px; margin: -10px 0 10px; background: rgba(198,123,75,0.04); border-radius: 0 0 14px 14px; border: 1px solid rgba(255,255,255,0.06); border-top: none;">
                        ${r.ingredients ? `<h4 style="color: var(--accent-orange); margin-bottom: 6px;">🧂 Ingredients</h4><p style="font-size: 0.9rem; color: var(--text-secondary); white-space: pre-wrap; margin-bottom: 12px;">${r.ingredients}</p>` : ''}
                        ${r.instructions ? `<h4 style="color: var(--accent-orange); margin-bottom: 6px;">📝 Instructions</h4><p style="font-size: 0.9rem; color: var(--text-secondary); white-space: pre-wrap; margin-bottom: 12px;">${r.instructions}</p>` : ''}
                        ${r.notes ? `<h4 style="color: var(--accent-orange); margin-bottom: 6px;">💡 Chef's Notes</h4><p style="font-size: 0.9rem; color: var(--text-secondary); white-space: pre-wrap; margin-bottom: 12px;">${r.notes}</p>` : ''}
                        <button class="btn btn-primary" style="width: 100%; margin-top: 10px; padding: 10px; border-radius: 10px; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="event.stopPropagation(); window.openDayPickerModal(${JSON.stringify(r).replace(/"/g, '&quot;')})">
                            <span>📅</span> Add to Menu
                        </button>
                    </div>
                `;
            });
            recipesHtml += '</div>';
        } else if (!data.canViewFull) {
            recipesHtml = `
                <div style="margin-top: 24px; text-align: center; padding: 40px 20px; background: rgba(255,255,255,0.02); border-radius: 16px; border: 2px dashed rgba(198,123,75,0.15);">
                    <div style="font-size: 3rem; margin-bottom: 12px;">🔒</div>
                    <h3 style="color: var(--text-primary); margin-bottom: 8px;">Purchase to unlock ${data.recipeCount} recipe${data.recipeCount !== 1 ? 's' : ''}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">Buy this book to see all the recipes inside.</p>
                </div>
            `;
        }

        body.innerHTML = `
            ${coverHtml}
            <div style="padding: 0 4px;">
                <h2 style="font-family: 'Playfair Display', serif; font-size: 2rem; margin-bottom: 8px;">${data.title}</h2>
                ${data.description ? `<p style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.5; margin-bottom: 16px;">${data.description}</p>` : ''}
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px 16px; background: rgba(255,255,255,0.03); border-radius: 12px;">
                    ${authorPic}
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary);">${data.author?.name || 'Unknown Chef'}</div>
                        <div style="font-size: 0.85rem; color: var(--accent-orange);">@${data.author?.username || 'unknown'}</div>
                    </div>
                    <div style="margin-left: auto; text-align: right;">
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">📖 ${data.recipeCount} recipes</div>
                        <div style="font-weight: 700; color: ${priceVal > 0 ? '#10b981' : 'var(--accent-orange)'}; font-size: 1.1rem;">${priceVal > 0 ? '$' + priceVal.toFixed(2) : 'Free'}</div>
                    </div>
                </div>
                ${actionHtml}
                ${recipesHtml}
            </div>
        `;

        // Add expand toggle
        body.querySelectorAll('.recipe-expand').forEach(el => {
            el.classList.add = function (cls) {
                if (cls === 'show') {
                    this.style.display = this.style.display === 'none' ? 'block' : 'none';
                }
            };
        });
        // Fix expand toggles
        body.querySelectorAll('[onclick*="recipe-expand"]').forEach(el => {
            el.onclick = function () {
                const expand = this.nextElementSibling;
                if (expand) expand.style.display = expand.style.display === 'none' ? 'block' : 'none';
            };
        });

        // Fetch wallet balance for book purchase buttons
        if (!data.isOwner && !data.hasPurchased && priceVal > 0) {
            fetchAndUpdateWalletBtn(priceVal, 'bookWalletBtn', 'bookWalletBalanceTag', 'bookWalletInsufficientMsg');
        }

    } catch (err) {
        console.error('View public book error:', err);
        body.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-secondary)">Failed to load book.</p>';
    }
}

// Purchase a book
window.purchaseBook = async function (bookId, method = 'wallet') {
    const token = sessionStorage.getItem('authToken');
    if (!token) { showNotification('Please log in', 'error'); return; }

    const walletBtn = document.getElementById('bookWalletBtn');
    const stripeBtn = document.getElementById('bookStripeBtn');
    const activeBtn = method === 'stripe' ? stripeBtn : walletBtn;
    const originalContent = activeBtn ? activeBtn.innerHTML : '';

    if (activeBtn) {
        activeBtn.disabled = true;
        activeBtn.innerHTML = '<span class="loading-spinner"></span> Processing...';
    }

    try {
        if (method === 'stripe') {
            // Create Stripe checkout session for book
            const response = await fetch(`${BOOK_API}/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    bookId: bookId,
                    successUrl: `${window.location.origin}/pages/payment-success.html?type=book&book_id=${bookId}`,
                    cancelUrl: `${window.location.origin}/index.html`
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
            const response = await fetch(`/api/books/public/${bookId}/purchase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showNotification(data.message || 'Book purchased successfully! 🎉', 'success');
                if (typeof viewPublicBook === 'function') {
                    viewPublicBook(bookId);
                }
            } else {
                showNotification(data.error || data.message || '❌ Purchase failed.', 'error');
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
};

// Load purchased books
export async function loadPurchasedBooks() {
    const grid = document.getElementById('purchasedBooksGrid');
    const empty = document.getElementById('purchasedBooksEmpty');
    const token = sessionStorage.getItem('authToken');
    if (!grid || !token) return;

    grid.innerHTML = '<div class="loading">Loading purchased books...</div>';
    empty.style.display = 'none';

    try {
        const res = await fetch(`${BOOK_API}/purchased/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const books = await res.json();

        grid.innerHTML = '';
        if (books.length === 0) {
            empty.style.display = '';
            grid.style.display = 'none';
        } else {
            empty.style.display = 'none';
            grid.style.display = '';
            books.forEach(book => {
                const card = createPublicBookCard(book);
                // Add "Owned" badge
                const badge = document.createElement('div');
                badge.className = 'book-owned-badge';
                badge.innerHTML = '✅ Owned';
                badge.style.cssText = 'position: absolute; top: 12px; left: 12px; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; z-index: 3;';
                card.appendChild(badge);
                grid.appendChild(card);
            });
        }
    } catch (err) {
        console.error('Load purchased books error:', err);
        grid.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">Failed to load purchased books.</p>';
    }
}

// Close public book modal
document.getElementById('closeViewPublicBookModal')?.addEventListener('click', () => {
    document.getElementById('viewPublicBookModal').classList.remove('show');
});
document.getElementById('viewPublicBookModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('viewPublicBookModal')) {
        e.target.classList.remove('show');
    }
});
