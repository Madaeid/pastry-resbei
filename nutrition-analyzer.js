// Nutrition Analyzer — Automatic nutritional analysis module
// Analyzes recipe ingredients using AI NLP and displays calories & macros
import { showNotification } from './ui-utils.js';

const API_URL = '/api';
let nutritionPanel = null;
let isAnalyzing = false;
let lastAnalysisResult = null;
let debounceTimer = null;

// ===== Initialize Nutrition Analyzer =====
export function initNutritionAnalyzer() {
    // Attach to add-recipe form ingredients textarea
    const addIngredientsField = document.getElementById('addRecipeIngredients');
    if (addIngredientsField) {
        attachAnalyzerToField(addIngredientsField, 'addRecipe');
    }

    // Attach to sell-recipe form ingredients textarea
    const sellIngredientsField = document.getElementById('sellRecipeIngredients');
    if (sellIngredientsField) {
        attachAnalyzerToField(sellIngredientsField, 'sellRecipe');
    }
}

// ===== Attach Analyzer to an Ingredients Field =====
function attachAnalyzerToField(textarea, context) {
    // Create the nutrition panel below the textarea
    const panel = createNutritionPanel(context);
    textarea.parentElement.appendChild(panel);

    // Create the analyze button next to the label
    const label = textarea.parentElement.querySelector('label');
    if (label) {
        const analyzeBtn = document.createElement('button');
        analyzeBtn.type = 'button';
        analyzeBtn.className = 'nutrition-analyze-trigger';
        analyzeBtn.id = `nutritionAnalyzeBtn_${context}`;
        analyzeBtn.innerHTML = `
            <span class="nutrition-icon">🔬</span>
            <span class="nutrition-label">Nutrition</span>
        `;
        analyzeBtn.title = 'Analyze nutritional values';
        analyzeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            triggerAnalysis(textarea, context);
        });

        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.justifyContent = 'space-between';
        label.style.flexWrap = 'wrap';
        label.appendChild(analyzeBtn);
    }

    // Auto-analyze on textarea blur with debounce (only if content exists)
    textarea.addEventListener('blur', () => {
        const text = textarea.value.trim();
        if (text && text.split('\n').filter(Boolean).length >= 2) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                triggerAnalysis(textarea, context, true);
            }, 500);
        }
    });
}

// ===== Create Nutrition Panel =====
function createNutritionPanel(context) {
    const panel = document.createElement('div');
    panel.className = 'nutrition-panel';
    panel.id = `nutritionPanel_${context}`;
    panel.style.display = 'none';
    panel.innerHTML = `
        <!-- Collapsed Summary Bar -->
        <div class="nutrition-summary-bar" id="nutritionSummaryBar_${context}">
            <div class="nutrition-summary-left">
                <span class="nutrition-summary-icon">📊</span>
                <span class="nutrition-summary-title">Nutritional Info</span>
                <span class="nutrition-health-badge" id="nutritionHealthBadge_${context}"></span>
            </div>
            <div class="nutrition-summary-macros" id="nutritionQuickMacros_${context}">
                <!-- Quick macro summary here -->
            </div>
            <button type="button" class="nutrition-expand-btn" id="nutritionExpandBtn_${context}">
                <span class="expand-icon">▼</span>
            </button>
        </div>

        <!-- Expandable Detail Panel -->
        <div class="nutrition-detail" id="nutritionDetail_${context}" style="display: none;">
            <!-- Loading State -->
            <div class="nutrition-loading" id="nutritionLoading_${context}" style="display: none;">
                <div class="nutrition-loading-spinner"></div>
                <span>Analyzing ingredients...</span>
            </div>

            <!-- Calorie Ring -->
            <div class="nutrition-hero-row">
                <div class="nutrition-calorie-ring" id="nutritionCalorieRing_${context}">
                    <svg viewBox="0 0 120 120" class="calorie-ring-svg">
                        <circle class="ring-bg" cx="60" cy="60" r="52"/>
                        <circle class="ring-progress" cx="60" cy="60" r="52" id="calorieRingProgress_${context}"/>
                    </svg>
                    <div class="calorie-ring-center">
                        <span class="calorie-number" id="calorieNumber_${context}">0</span>
                        <span class="calorie-unit">kcal</span>
                        <span class="calorie-label">per serving</span>
                    </div>
                </div>
                <div class="nutrition-macro-bars">
                    <div class="macro-bar-item">
                        <div class="macro-bar-header">
                            <span class="macro-bar-name">🥩 Protein</span>
                            <span class="macro-bar-value" id="proteinValue_${context}">0g</span>
                        </div>
                        <div class="macro-bar-track">
                            <div class="macro-bar-fill protein-fill" id="proteinBar_${context}"></div>
                        </div>
                    </div>
                    <div class="macro-bar-item">
                        <div class="macro-bar-header">
                            <span class="macro-bar-name">🍞 Carbs</span>
                            <span class="macro-bar-value" id="carbsValue_${context}">0g</span>
                        </div>
                        <div class="macro-bar-track">
                            <div class="macro-bar-fill carbs-fill" id="carbsBar_${context}"></div>
                        </div>
                    </div>
                    <div class="macro-bar-item">
                        <div class="macro-bar-header">
                            <span class="macro-bar-name">🧈 Fat</span>
                            <span class="macro-bar-value" id="fatValue_${context}">0g</span>
                        </div>
                        <div class="macro-bar-track">
                            <div class="macro-bar-fill fat-fill" id="fatBar_${context}"></div>
                        </div>
                    </div>
                    <div class="macro-bar-item">
                        <div class="macro-bar-header">
                            <span class="macro-bar-name">🌾 Fiber</span>
                            <span class="macro-bar-value" id="fiberValue_${context}">0g</span>
                        </div>
                        <div class="macro-bar-track">
                            <div class="macro-bar-fill fiber-fill" id="fiberBar_${context}"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Extra Macros -->
            <div class="nutrition-extra-row" id="nutritionExtraRow_${context}">
                <div class="nutrition-extra-item">
                    <span class="extra-label">Sugar</span>
                    <span class="extra-value" id="sugarValue_${context}">0g</span>
                </div>
                <div class="nutrition-extra-item">
                    <span class="extra-label">Sodium</span>
                    <span class="extra-value" id="sodiumValue_${context}">0mg</span>
                </div>
                <div class="nutrition-extra-item">
                    <span class="extra-label">Servings</span>
                    <span class="extra-value" id="servingsValue_${context}">1</span>
                </div>
            </div>

            <!-- Allergen Tags -->
            <div class="nutrition-allergens" id="nutritionAllergens_${context}" style="display: none;">
                <span class="allergens-label">⚠️ Allergens:</span>
                <div class="allergen-tags" id="allergenTags_${context}"></div>
            </div>

            <!-- Health Tip -->
            <div class="nutrition-tip" id="nutritionTip_${context}" style="display: none;">
                <span class="tip-icon">💡</span>
                <span class="tip-text" id="nutritionTipText_${context}"></span>
            </div>

            <!-- Per-Ingredient Breakdown (Collapsible) -->
            <div class="nutrition-breakdown">
                <button type="button" class="breakdown-toggle" id="breakdownToggle_${context}">
                    <span>📋 Per-ingredient breakdown</span>
                    <span class="breakdown-arrow">▶</span>
                </button>
                <div class="breakdown-list" id="breakdownList_${context}" style="display: none;">
                    <!-- Ingredient rows here -->
                </div>
            </div>

            <!-- Confidence Badge -->
            <div class="nutrition-confidence" id="nutritionConfidence_${context}">
                <span class="confidence-text">AI Estimate</span>
            </div>
        </div>
    `;

    // Setup event listeners for the panel
    setTimeout(() => {
        const expandBtn = document.getElementById(`nutritionExpandBtn_${context}`);
        const detail = document.getElementById(`nutritionDetail_${context}`);
        const summaryBar = document.getElementById(`nutritionSummaryBar_${context}`);

        if (expandBtn && detail) {
            const toggleDetail = () => {
                const isExpanded = detail.style.display !== 'none';
                detail.style.display = isExpanded ? 'none' : 'block';
                expandBtn.querySelector('.expand-icon').textContent = isExpanded ? '▼' : '▲';
                panel.classList.toggle('expanded', !isExpanded);
            };

            expandBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleDetail();
            });

            summaryBar.addEventListener('click', (e) => {
                if (!e.target.closest('.nutrition-expand-btn')) {
                    toggleDetail();
                }
            });
        }

        const breakdownToggle = document.getElementById(`breakdownToggle_${context}`);
        const breakdownList = document.getElementById(`breakdownList_${context}`);
        if (breakdownToggle && breakdownList) {
            breakdownToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isVisible = breakdownList.style.display !== 'none';
                breakdownList.style.display = isVisible ? 'none' : 'block';
                breakdownToggle.querySelector('.breakdown-arrow').textContent = isVisible ? '▶' : '▼';
            });
        }
    }, 100);

    return panel;
}

// ===== Trigger Analysis =====
async function triggerAnalysis(textarea, context, silent = false) {
    if (isAnalyzing) return;

    const ingredientsText = textarea.value.trim();
    if (!ingredientsText) {
        if (!silent) showNotification('⚠️ Please enter some ingredients first.', 'error');
        return;
    }

    const lines = ingredientsText.split('\n').filter(l => l.trim());
    if (lines.length < 1) {
        if (!silent) showNotification('⚠️ Please enter at least one ingredient.', 'error');
        return;
    }

    isAnalyzing = true;
    const panel = document.getElementById(`nutritionPanel_${context}`);
    const loading = document.getElementById(`nutritionLoading_${context}`);
    const detail = document.getElementById(`nutritionDetail_${context}`);

    // Show the panel
    if (panel) panel.style.display = 'block';
    if (loading) loading.style.display = 'flex';

    // Get servings from the form if available
    let servings = 1;
    const servingsInput = document.getElementById('addPrepTime')?.closest('.form-row')
        ?.parentElement?.querySelector('#generatorServings');
    // Try common servings inputs
    const possibleServingsIds = ['addRecipeServings', 'generatorServings', 'sellRecipeServings'];
    for (const id of possibleServingsIds) {
        const el = document.getElementById(id);
        if (el) { servings = parseInt(el.value) || 1; break; }
    }
    // Fallback: parse from cost-calculator or just default
    if (servings <= 0) servings = 4;

    try {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/nutrition/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                ingredients: ingredientsText,
                servings
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Analysis failed');
        }

        lastAnalysisResult = data;
        displayNutritionResults(data, context);

        if (!silent) {
            showNotification('📊 Nutritional analysis complete!', 'success');
        }

    } catch (err) {
        console.error('Nutrition analysis error:', err);
        if (!silent) {
            showNotification(`❌ ${err.message || 'Failed to analyze nutrition.'}`, 'error');
        }
        if (panel) panel.style.display = 'none';
    }

    if (loading) loading.style.display = 'none';
    isAnalyzing = false;
}

// ===== Display Nutrition Results =====
function displayNutritionResults(data, context) {
    const panel = document.getElementById(`nutritionPanel_${context}`);
    if (!panel) return;

    panel.style.display = 'block';
    panel.classList.add('has-data');

    const ps = data.perServing;

    // --- Summary Bar ---
    const quickMacros = document.getElementById(`nutritionQuickMacros_${context}`);
    if (quickMacros) {
        quickMacros.innerHTML = `
            <span class="quick-macro"><strong>${ps.calories}</strong> kcal</span>
            <span class="quick-macro-sep">•</span>
            <span class="quick-macro">P ${ps.protein}g</span>
            <span class="quick-macro-sep">•</span>
            <span class="quick-macro">C ${ps.carbs}g</span>
            <span class="quick-macro-sep">•</span>
            <span class="quick-macro">F ${ps.fat}g</span>
        `;
    }

    // Health badge
    const healthBadge = document.getElementById(`nutritionHealthBadge_${context}`);
    if (healthBadge) {
        const badges = {
            healthy: { emoji: '🥗', text: 'Healthy', cls: 'health-healthy' },
            moderate: { emoji: '⚖️', text: 'Moderate', cls: 'health-moderate' },
            indulgent: { emoji: '🍰', text: 'Indulgent', cls: 'health-indulgent' }
        };
        const b = badges[data.healthScore] || badges.moderate;
        healthBadge.className = `nutrition-health-badge ${b.cls}`;
        healthBadge.innerHTML = `${b.emoji} ${b.text}`;
    }

    // --- Calorie Ring ---
    const calorieNumber = document.getElementById(`calorieNumber_${context}`);
    if (calorieNumber) {
        animateNumber(calorieNumber, 0, ps.calories, 800);
    }

    // Ring progress (based on 2000 kcal daily reference)
    const ringProgress = document.getElementById(`calorieRingProgress_${context}`);
    if (ringProgress) {
        const circumference = 2 * Math.PI * 52;
        const pct = Math.min(ps.calories / 2000, 1);
        const offset = circumference - (pct * circumference);
        ringProgress.style.strokeDasharray = `${circumference}`;
        ringProgress.style.strokeDashoffset = `${circumference}`;
        setTimeout(() => {
            ringProgress.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
            ringProgress.style.strokeDashoffset = `${offset}`;
        }, 100);
    }

    // --- Macro Bars ---
    const totalMacro = ps.protein + ps.carbs + ps.fat;
    setMacroBar(context, 'protein', ps.protein, totalMacro);
    setMacroBar(context, 'carbs', ps.carbs, totalMacro);
    setMacroBar(context, 'fat', ps.fat, totalMacro);
    setMacroBar(context, 'fiber', ps.fiber, 30); // 30g daily reference

    // --- Extra Row ---
    setText(`sugarValue_${context}`, `${ps.sugar}g`);
    setText(`sodiumValue_${context}`, `${ps.sodium}mg`);
    setText(`servingsValue_${context}`, `${data.servings}`);

    // --- Allergens ---
    const allergensSection = document.getElementById(`nutritionAllergens_${context}`);
    const allergenTags = document.getElementById(`allergenTags_${context}`);
    if (data.allergens && data.allergens.length > 0 && allergensSection && allergenTags) {
        allergensSection.style.display = 'flex';
        allergenTags.innerHTML = data.allergens.map(a =>
            `<span class="allergen-tag">${a}</span>`
        ).join('');
    } else if (allergensSection) {
        allergensSection.style.display = 'none';
    }

    // --- Health Tip ---
    const tipSection = document.getElementById(`nutritionTip_${context}`);
    const tipText = document.getElementById(`nutritionTipText_${context}`);
    if (data.healthTip && tipSection && tipText) {
        tipSection.style.display = 'flex';
        tipText.textContent = data.healthTip;
    }

    // --- Per-Ingredient Breakdown ---
    const breakdownList = document.getElementById(`breakdownList_${context}`);
    if (breakdownList && data.items && data.items.length > 0) {
        breakdownList.innerHTML = `
            <div class="breakdown-header-row">
                <span class="bh-name">Ingredient</span>
                <span class="bh-cal">Cal</span>
                <span class="bh-macro">P</span>
                <span class="bh-macro">C</span>
                <span class="bh-macro">F</span>
            </div>
            ${data.items.map((item, i) => `
                <div class="breakdown-row" style="animation-delay: ${i * 0.05}s">
                    <span class="br-name" title="${item.quantity}">${item.name}</span>
                    <span class="br-cal">${item.calories}</span>
                    <span class="br-macro">${item.protein}g</span>
                    <span class="br-macro">${item.carbs}g</span>
                    <span class="br-macro">${item.fat}g</span>
                </div>
            `).join('')}
            <div class="breakdown-total-row">
                <span class="br-name"><strong>Total (recipe)</strong></span>
                <span class="br-cal"><strong>${data.totalPerRecipe.calories}</strong></span>
                <span class="br-macro"><strong>${data.totalPerRecipe.protein}g</strong></span>
                <span class="br-macro"><strong>${data.totalPerRecipe.carbs}g</strong></span>
                <span class="br-macro"><strong>${data.totalPerRecipe.fat}g</strong></span>
            </div>
        `;
    }

    // --- Confidence ---
    const confidence = document.getElementById(`nutritionConfidence_${context}`);
    if (confidence) {
        const labels = {
            high: '✅ High accuracy',
            medium: '🟡 Estimated',
            low: '🔴 Rough estimate'
        };
        confidence.querySelector('.confidence-text').textContent =
            `${labels[data.confidence] || labels.medium} • AI-powered nutritional analysis`;
    }
}

// ===== Helper: Set Macro Bar =====
function setMacroBar(context, name, value, maxValue) {
    const valueEl = document.getElementById(`${name}Value_${context}`);
    const barEl = document.getElementById(`${name}Bar_${context}`);
    if (valueEl) valueEl.textContent = `${value}g`;
    if (barEl) {
        const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
        barEl.style.width = '0%';
        setTimeout(() => {
            barEl.style.transition = 'width 1s cubic-bezier(0.4, 0, 0.2, 1)';
            barEl.style.width = `${pct}%`;
        }, 200);
    }
}

// ===== Helper: Animate Number =====
function animateNumber(el, start, end, duration) {
    const range = end - start;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.round(start + range * eased);
        el.textContent = current;
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// ===== Helper: Set Text =====
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// ===== Create Inline Nutrition Badge (for recipe cards) =====
export function createNutritionBadge(ingredients, servings = 1) {
    // Quick client-side estimate for recipe cards (no API call)
    const lines = (ingredients || '').split('\n').filter(l => l.trim());
    if (lines.length === 0) return null;

    let totalCals = 0;
    for (const line of lines) {
        const lower = line.toLowerCase();
        let cals = 30;
        if (lower.includes('flour')) cals = 110;
        else if (lower.includes('sugar')) cals = 90;
        else if (lower.includes('butter')) cals = 180;
        else if (lower.includes('egg')) cals = 40;
        else if (lower.includes('chocolate')) cals = 140;
        else if (lower.includes('cream')) cals = 80;
        else if (lower.includes('oil')) cals = 120;
        else if (lower.includes('milk')) cals = 40;
        totalCals += cals;
    }

    const perServing = Math.round(totalCals / (servings || 1));

    const badge = document.createElement('span');
    badge.className = 'nutrition-inline-badge';
    badge.title = `~${perServing} kcal per serving (estimate)`;
    badge.innerHTML = `🔥 ~${perServing} kcal`;
    return badge;
}
