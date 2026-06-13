// AI Recipe Generator — Premium Feature Module
// Enter ingredients and let AI create a complete recipe
import { isPremium } from './payment.js';
import { showNotification } from './ui-utils.js';

const API_URL = '/api';
let generatorModal = null;
let isGenerating = false;
let lastGeneratedRecipe = null;
let ingredientTags = [];

// ===== Initialize Generator =====
export function initRecipeGenerator() {
    createGeneratorModal();
}

// ===== Create the Generator Modal =====
function createGeneratorModal() {
    if (document.getElementById('aiRecipeGeneratorModal')) return;

    const modal = document.createElement('div');
    modal.id = 'aiRecipeGeneratorModal';
    modal.className = 'modal ai-generator-modal';
    modal.innerHTML = `
        <div class="modal-content ai-generator-content">
            <button class="modal-close" id="closeGeneratorModal">&times;</button>

            <!-- Generator Header -->
            <div class="generator-header">
                <div class="generator-logo">
                    <span class="generator-logo-icon">🧑‍🍳</span>
                    <div class="generator-logo-ring"></div>
                </div>
                <h2>AI Recipe Creator</h2>
                <p class="generator-subtitle">Tell me what ingredients you have, and I'll craft a recipe for you</p>
                <div class="generator-premium-badge">
                    <span>💎</span> Premium Feature
                </div>
            </div>

            <!-- Premium Gate -->
            <div class="generator-premium-gate" id="generatorPremiumGate" style="display: none;">
                <div class="premium-gate-visual">
                    <div class="gate-icon-container">
                        <span class="gate-icon">🔒</span>
                        <div class="gate-glow"></div>
                    </div>
                    <h3>Unlock AI Recipe Creator</h3>
                    <p>Premium members get unlimited AI-powered recipe generation from any ingredients.</p>
                    <ul class="gate-features">
                        <li><span>🧑‍🍳</span> Generate recipes from any ingredients</li>
                        <li><span>🎯</span> Choose category & difficulty</li>
                        <li><span>📝</span> Full instructions & chef tips</li>
                        <li><span>💾</span> Save directly to your recipe book</li>
                    </ul>
                    <a href="./pages/payment.html?source=generator" class="btn btn-primary scanner-upgrade-btn">
                        <span class="btn-icon">💎</span>
                        <span>Upgrade to Premium</span>
                    </a>
                </div>
            </div>

            <!-- Generator Body -->
            <div class="generator-body" id="generatorBody" style="display: none;">
                <!-- Input Section -->
                <div class="generator-input-section" id="generatorInputSection">
                    <!-- Ingredient Tags Input -->
                    <div class="generator-form-group">
                        <label class="generator-label">
                            <span class="label-icon">🥚</span>
                            What ingredients do you have?
                        </label>
                        <div class="ingredient-tags-container" id="ingredientTagsContainer">
                            <div class="ingredient-tags-list" id="ingredientTagsList">
                                <!-- Tags will appear here -->
                            </div>
                            <input type="text" 
                                   id="ingredientInput" 
                                   class="ingredient-tag-input" 
                                   placeholder="Type an ingredient and press Enter..."
                                   autocomplete="off">
                        </div>
                        <p class="generator-hint">Press <kbd>Enter</kbd> or <kbd>,</kbd> to add • Minimum 2 ingredients</p>
                    </div>

                    <!-- Quick Add Suggestions -->
                    <div class="quick-add-section">
                        <span class="quick-add-label">Quick add:</span>
                        <div class="quick-add-chips">
                            <button type="button" class="quick-chip" data-ingredient="Flour">🌾 Flour</button>
                            <button type="button" class="quick-chip" data-ingredient="Sugar">🍬 Sugar</button>
                            <button type="button" class="quick-chip" data-ingredient="Butter">🧈 Butter</button>
                            <button type="button" class="quick-chip" data-ingredient="Eggs">🥚 Eggs</button>
                            <button type="button" class="quick-chip" data-ingredient="Chocolate">🍫 Chocolate</button>
                            <button type="button" class="quick-chip" data-ingredient="Cream">🥛 Cream</button>
                            <button type="button" class="quick-chip" data-ingredient="Vanilla">🌿 Vanilla</button>
                            <button type="button" class="quick-chip" data-ingredient="Berries">🫐 Berries</button>
                        </div>
                    </div>

                    <!-- Options Row -->
                    <div class="generator-options-row">
                        <div class="generator-form-group generator-option">
                            <label class="generator-label">
                                <span class="label-icon">📂</span> Category
                            </label>
                            <select id="generatorCategory" class="generator-select">
                                <option value="">Any</option>
                                <option value="Cakes">🎂 Cakes</option>
                                <option value="Cookies">🍪 Cookies</option>
                                <option value="Pastries">🥐 Pastries</option>
                                <option value="Pies & Tarts">🥧 Pies & Tarts</option>
                                <option value="Breads">🍞 Breads</option>
                                <option value="Desserts">🍰 Desserts</option>
                                <option value="Chocolates">🍫 Chocolates</option>
                                <option value="Other">✨ Other</option>
                            </select>
                        </div>
                        <div class="generator-form-group generator-option">
                            <label class="generator-label">
                                <span class="label-icon">📊</span> Difficulty
                            </label>
                            <select id="generatorDifficulty" class="generator-select">
                                <option value="">Any</option>
                                <option value="Easy">🟢 Easy</option>
                                <option value="Medium" selected>🟡 Medium</option>
                                <option value="Hard">🔴 Hard</option>
                            </select>
                        </div>
                        <div class="generator-form-group generator-option">
                            <label class="generator-label">
                                <span class="label-icon">🍽️</span> Servings
                            </label>
                            <select id="generatorServings" class="generator-select">
                                <option value="2">2</option>
                                <option value="4" selected>4</option>
                                <option value="6">6</option>
                                <option value="8">8</option>
                                <option value="12">12</option>
                            </select>
                        </div>
                    </div>

                    <!-- Dietary Notes -->
                    <div class="generator-form-group">
                        <label class="generator-label">
                            <span class="label-icon">📝</span>
                            Special notes <span class="optional-label">(optional)</span>
                        </label>
                        <input type="text" 
                               id="generatorDietaryNotes" 
                               class="generator-text-input"
                               placeholder="e.g., gluten-free, no nuts, vegan...">
                    </div>

                    <!-- Generate Button -->
                    <button type="button" class="generator-submit-btn" id="generateRecipeBtn">
                        <span class="btn-sparkle">✨</span>
                        <span class="btn-text">Generate Recipe</span>
                        <span class="btn-sparkle">✨</span>
                    </button>
                </div>

                <!-- Processing State -->
                <div class="generator-processing" id="generatorProcessing" style="display: none;">
                    <div class="processing-animation">
                        <div class="processing-ring"></div>
                        <span class="processing-icon">🧑‍🍳</span>
                    </div>
                    <h3>Creating your recipe...</h3>
                    <p class="processing-hint" id="generatorProcessingHint">Our AI chef is crafting something special</p>
                    <div class="processing-dots">
                        <span></span><span></span><span></span>
                    </div>
                </div>

                <!-- Results -->
                <div class="generator-results" id="generatorResults" style="display: none;">
                    <div class="recipe-result-card">
                        <div class="result-card-header">
                            <div class="result-card-badge">
                                <span>✨</span> AI Generated
                            </div>
                            <h3 class="result-recipe-name" id="resultRecipeName">Recipe Name</h3>
                            <p class="result-recipe-desc" id="resultRecipeDesc">Description</p>
                        </div>

                        <div class="result-meta-row">
                            <span class="result-meta-item" id="resultCategory">
                                <span class="meta-icon">📂</span>
                                <span class="meta-value">Category</span>
                            </span>
                            <span class="result-meta-item" id="resultDifficulty">
                                <span class="meta-icon">📊</span>
                                <span class="meta-value">Medium</span>
                            </span>
                            <span class="result-meta-item" id="resultPrepTime">
                                <span class="meta-icon">⏱️</span>
                                <span class="meta-value">15 min prep</span>
                            </span>
                            <span class="result-meta-item" id="resultCookTime">
                                <span class="meta-icon">🔥</span>
                                <span class="meta-value">30 min cook</span>
                            </span>
                            <span class="result-meta-item" id="resultServings">
                                <span class="meta-icon">🍽️</span>
                                <span class="meta-value">4 servings</span>
                            </span>
                        </div>

                        <div class="result-section">
                            <h4><span>🥚</span> Ingredients</h4>
                            <div class="result-ingredients-list" id="resultIngredients">
                                <!-- Ingredients listed here -->
                            </div>
                        </div>

                        <div class="result-section">
                            <h4><span>📋</span> Instructions</h4>
                            <div class="result-instructions-list" id="resultInstructions">
                                <!-- Steps listed here -->
                            </div>
                        </div>

                        <div class="result-section result-notes-section" id="resultNotesSection" style="display: none;">
                            <h4><span>💡</span> Chef's Notes</h4>
                            <p class="result-notes-text" id="resultNotes"></p>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="generator-result-actions">
                        <button type="button" class="btn btn-secondary" id="regenerateBtn">
                            <span class="btn-icon">🔄</span>
                            <span>Try Again</span>
                        </button>
                        <button type="button" class="btn btn-primary" id="saveGeneratedRecipeBtn">
                            <span class="btn-icon">💾</span>
                            <span>Save to My Recipes</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    generatorModal = modal;

    setupGeneratorEvents();
}

// ===== Open Generator =====
export function openRecipeGenerator() {
    if (!generatorModal) createGeneratorModal();

    const premiumGate = document.getElementById('generatorPremiumGate');
    const generatorBody = document.getElementById('generatorBody');

    if (isPremium()) {
        premiumGate.style.display = 'none';
        generatorBody.style.display = 'block';
    } else {
        premiumGate.style.display = 'block';
        generatorBody.style.display = 'none';
    }

    // Reset state
    resetGenerator();

    generatorModal.style.display = 'flex';
    generatorModal.classList.add('show');

    // Focus the input after a brief delay for the animation
    setTimeout(() => {
        const input = document.getElementById('ingredientInput');
        if (input) input.focus();
    }, 300);
}

// ===== Close Generator =====
function closeGenerator() {
    if (generatorModal) {
        generatorModal.style.display = 'none';
        generatorModal.classList.remove('show');
    }
}

// ===== Reset Generator State =====
function resetGenerator() {
    const inputSection = document.getElementById('generatorInputSection');
    const processing = document.getElementById('generatorProcessing');
    const results = document.getElementById('generatorResults');

    if (inputSection) inputSection.style.display = 'block';
    if (processing) processing.style.display = 'none';
    if (results) results.style.display = 'none';

    // Clear ingredients
    ingredientTags = [];
    renderTags();

    // Reset fields
    const input = document.getElementById('ingredientInput');
    const notes = document.getElementById('generatorDietaryNotes');
    if (input) input.value = '';
    if (notes) notes.value = '';

    isGenerating = false;
    lastGeneratedRecipe = null;
}

// ===== Setup Event Listeners =====
function setupGeneratorEvents() {
    // Close
    const closeBtn = document.getElementById('closeGeneratorModal');
    if (closeBtn) closeBtn.addEventListener('click', closeGenerator);

    generatorModal.addEventListener('click', (e) => {
        if (e.target === generatorModal) closeGenerator();
    });

    // Ingredient Input
    const input = document.getElementById('ingredientInput');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addIngredient(input.value);
                input.value = '';
            }
            // Backspace on empty input removes last tag
            if (e.key === 'Backspace' && !input.value && ingredientTags.length > 0) {
                ingredientTags.pop();
                renderTags();
            }
        });

        // Also handle paste (comma-separated)
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text');
            const items = text.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
            items.forEach(item => addIngredient(item));
            input.value = '';
        });
    }

    // Click on tags container focuses input
    const tagsContainer = document.getElementById('ingredientTagsContainer');
    if (tagsContainer) {
        tagsContainer.addEventListener('click', () => {
            input?.focus();
        });
    }

    // Quick Add chips
    const quickChips = generatorModal.querySelectorAll('.quick-chip');
    quickChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const ingredient = chip.dataset.ingredient;
            if (addIngredient(ingredient)) {
                chip.classList.add('chip-added');
                setTimeout(() => chip.classList.remove('chip-added'), 600);
            }
        });
    });

    // Generate button
    const generateBtn = document.getElementById('generateRecipeBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerate);
    }

    // Regenerate button
    const regenerateBtn = document.getElementById('regenerateBtn');
    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', () => {
            const inputSection = document.getElementById('generatorInputSection');
            const results = document.getElementById('generatorResults');
            if (results) results.style.display = 'none';
            if (inputSection) inputSection.style.display = 'block';
        });
    }

    // Save button
    const saveBtn = document.getElementById('saveGeneratedRecipeBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveGeneratedRecipe);
    }
}

// ===== Add Ingredient Tag =====
function addIngredient(value) {
    const trimmed = value.trim().replace(/,+$/, '').trim();
    if (!trimmed) return false;

    // Check duplicates (case-insensitive)
    if (ingredientTags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
        showNotification('⚠️ Ingredient already added.', 'error');
        return false;
    }

    if (ingredientTags.length >= 30) {
        showNotification('⚠️ Maximum 30 ingredients allowed.', 'error');
        return false;
    }

    ingredientTags.push(trimmed);
    renderTags();
    return true;
}

// ===== Render Ingredient Tags =====
function renderTags() {
    const list = document.getElementById('ingredientTagsList');
    if (!list) return;

    list.innerHTML = ingredientTags.map((tag, i) => `
        <span class="ingredient-tag" style="animation-delay: ${i * 0.03}s">
            <span class="tag-text">${tag}</span>
            <button type="button" class="tag-remove" data-idx="${i}" title="Remove">&times;</button>
        </span>
    `).join('');

    // Remove button listeners
    list.querySelectorAll('.tag-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx);
            ingredientTags.splice(idx, 1);
            renderTags();
        });
    });

    // Update generate button state
    const generateBtn = document.getElementById('generateRecipeBtn');
    if (generateBtn) {
        generateBtn.disabled = ingredientTags.length < 2;
    }
}

// ===== Handle Generate =====
async function handleGenerate() {
    if (isGenerating) return;

    if (ingredientTags.length < 2) {
        showNotification('⚠️ Please add at least 2 ingredients.', 'error');
        return;
    }

    isGenerating = true;

    const inputSection = document.getElementById('generatorInputSection');
    const processing = document.getElementById('generatorProcessing');
    const hint = document.getElementById('generatorProcessingHint');

    if (inputSection) inputSection.style.display = 'none';
    if (processing) processing.style.display = 'flex';

    // Rotate processing hints
    const hints = [
        'Our AI chef is crafting something special',
        'Selecting the perfect technique for your ingredients',
        'Balancing flavors and textures',
        'Writing step-by-step instructions',
        'Adding professional chef tips',
        'Almost there...'
    ];
    let hintIdx = 0;
    const hintInterval = setInterval(() => {
        hintIdx = (hintIdx + 1) % hints.length;
        if (hint) hint.textContent = hints[hintIdx];
    }, 2500);

    try {
        const category = document.getElementById('generatorCategory')?.value || '';
        const difficulty = document.getElementById('generatorDifficulty')?.value || '';
        const servings = document.getElementById('generatorServings')?.value || '4';
        const dietaryNotes = document.getElementById('generatorDietaryNotes')?.value || '';

        const token = sessionStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/scanner/generate-recipe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                ingredients: ingredientTags,
                category,
                difficulty,
                servings: parseInt(servings),
                dietaryNotes
            })
        });

        const data = await response.json();

        clearInterval(hintInterval);

        if (data.requiresPremium) {
            if (processing) processing.style.display = 'none';
            document.getElementById('generatorPremiumGate').style.display = 'block';
            document.getElementById('generatorBody').style.display = 'none';
            isGenerating = false;
            return;
        }

        if (!response.ok) {
            throw new Error(data.error || 'Generation failed');
        }

        lastGeneratedRecipe = data;
        showRecipeResult(data);

    } catch (err) {
        clearInterval(hintInterval);
        console.error('Generation error:', err);
        showNotification(`❌ ${err.message || 'Failed to generate recipe. Please try again.'}`, 'error');
        if (inputSection) inputSection.style.display = 'block';
        if (processing) processing.style.display = 'none';
    }

    isGenerating = false;
}

// ===== Show Recipe Result =====
function showRecipeResult(data) {
    const processing = document.getElementById('generatorProcessing');
    const results = document.getElementById('generatorResults');

    if (processing) processing.style.display = 'none';
    if (results) results.style.display = 'block';

    // Name & description
    const nameEl = document.getElementById('resultRecipeName');
    const descEl = document.getElementById('resultRecipeDesc');
    if (nameEl) nameEl.textContent = data.name;
    if (descEl) descEl.textContent = data.description || '';

    // Meta
    const categoryEl = document.getElementById('resultCategory');
    const diffEl = document.getElementById('resultDifficulty');
    const prepEl = document.getElementById('resultPrepTime');
    const cookEl = document.getElementById('resultCookTime');
    const servingsEl = document.getElementById('resultServings');

    if (categoryEl) categoryEl.querySelector('.meta-value').textContent = data.category;
    if (diffEl) diffEl.querySelector('.meta-value').textContent = data.difficulty;
    if (prepEl) prepEl.querySelector('.meta-value').textContent = `${data.prepTime} min prep`;
    if (cookEl) cookEl.querySelector('.meta-value').textContent = `${data.cookTime} min cook`;
    if (servingsEl) servingsEl.querySelector('.meta-value').textContent = `${data.servings} servings`;

    // Ingredients
    const ingredientsEl = document.getElementById('resultIngredients');
    if (ingredientsEl) {
        const ingredientLines = data.ingredients.split('\n').filter(l => l.trim());
        ingredientsEl.innerHTML = ingredientLines.map((line, i) => `
            <div class="result-ingredient-item" style="animation-delay: ${i * 0.05}s">
                <span class="ingredient-bullet">•</span>
                <span>${line.trim()}</span>
            </div>
        `).join('');
    }

    // Instructions
    const instructionsEl = document.getElementById('resultInstructions');
    if (instructionsEl) {
        const steps = data.instructions.split('\n').filter(l => l.trim());
        instructionsEl.innerHTML = steps.map((step, i) => `
            <div class="result-step-item" style="animation-delay: ${i * 0.08}s">
                <span class="step-number">${i + 1}</span>
                <span class="step-text">${step.replace(/^\d+\.\s*/, '').trim()}</span>
            </div>
        `).join('');
    }

    // Notes
    const notesSection = document.getElementById('resultNotesSection');
    const notesEl = document.getElementById('resultNotes');
    if (data.notes && notesSection && notesEl) {
        notesSection.style.display = 'block';
        notesEl.textContent = data.notes;
    } else if (notesSection) {
        notesSection.style.display = 'none';
    }

    // Smooth scroll to top of results
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== Save Generated Recipe to Add Recipe Form =====
function saveGeneratedRecipe() {
    if (!lastGeneratedRecipe) return;

    const recipe = lastGeneratedRecipe;

    // Open the Add Recipe modal
    const addRecipeModal = document.getElementById('addRecipeModal');
    if (addRecipeModal) {
        addRecipeModal.style.display = 'flex';
    }

    // Fill in the form fields
    const nameField = document.getElementById('addRecipeName');
    const categoryField = document.getElementById('addRecipeCategory');
    const ingredientsField = document.getElementById('addRecipeIngredients');
    const instructionsField = document.getElementById('addRecipeInstructions');
    const notesField = document.getElementById('addRecipeNotes');
    const prepTimeField = document.getElementById('addPrepTime');
    const cookTimeField = document.getElementById('addCookTime');
    const difficultyField = document.getElementById('addRecipeDifficulty');

    if (nameField) {
        nameField.value = recipe.name;
        nameField.classList.add('scanner-filled');
        setTimeout(() => nameField.classList.remove('scanner-filled'), 1500);
    }

    if (categoryField) {
        // Try to match the category option
        const options = categoryField.querySelectorAll('option');
        for (const opt of options) {
            if (opt.value.toLowerCase().includes(recipe.category.toLowerCase()) ||
                recipe.category.toLowerCase().includes(opt.value.toLowerCase())) {
                categoryField.value = opt.value;
                break;
            }
        }
    }

    if (ingredientsField) {
        ingredientsField.value = recipe.ingredients;
        ingredientsField.classList.add('scanner-filled');
        setTimeout(() => ingredientsField.classList.remove('scanner-filled'), 1500);
    }

    if (instructionsField) {
        instructionsField.value = recipe.instructions;
        instructionsField.classList.add('scanner-filled');
        setTimeout(() => instructionsField.classList.remove('scanner-filled'), 1500);
    }

    if (notesField && recipe.notes) {
        notesField.value = recipe.notes;
    }

    if (prepTimeField) {
        prepTimeField.value = recipe.prepTime;
    }

    if (cookTimeField) {
        cookTimeField.value = recipe.cookTime;
    }

    // Set difficulty buttons
    if (difficultyField && recipe.difficulty) {
        difficultyField.value = recipe.difficulty;
        const addRecipeModalEl = document.getElementById('addRecipeModal');
        if (addRecipeModalEl) {
            const diffBtns = addRecipeModalEl.querySelectorAll('.diff-btn');
            diffBtns.forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-value') === recipe.difficulty) {
                    btn.classList.add('active');
                }
            });
        }
    }

    showNotification(`✨ Recipe "${recipe.name}" loaded into form! Review and save.`, 'success');
    closeGenerator();
}
