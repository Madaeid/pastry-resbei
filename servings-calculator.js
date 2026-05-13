/**
 * Smart Servings Calculator
 * 
 * Parses ingredient lines to extract numeric quantities, then scales them
 * proportionally when the user changes the serving count.
 * 
 * Supports formats like:
 *   - "200g flour"          -> numeric + unit + name
 *   - "1/2 cup sugar"       -> fraction + unit + name
 *   - "3 eggs"              -> integer + name
 *   - "1 1/2 tsp vanilla"   -> mixed number + unit + name
 *   - "2.5 cups milk"       -> decimal + unit + name
 *   - "a pinch of salt"     -> non-numeric (left unchanged)
 */

// ─── Fraction Helpers ──────────────────────────────────────

/**
 * Parse a string that may contain fractions, mixed numbers, or decimals
 * Returns the numeric value, or null if no number found
 */
function parseQuantity(str) {
    if (!str || !str.trim()) return null;
    str = str.trim();

    // Unicode fractions
    const unicodeFractions = {
        '½': 0.5, '⅓': 1/3, '⅔': 2/3,
        '¼': 0.25, '¾': 0.75, '⅕': 0.2,
        '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
        '⅙': 1/6, '⅚': 5/6, '⅛': 0.125,
        '⅜': 0.375, '⅝': 0.625, '⅞': 0.875
    };

    // Mixed number with unicode fraction: "1½"
    const unicodeMixedMatch = str.match(/^(\d+)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/);
    if (unicodeMixedMatch) {
        return parseInt(unicodeMixedMatch[1]) + unicodeFractions[unicodeMixedMatch[2]];
    }

    // Standalone unicode fraction: "½"
    if (unicodeFractions[str]) {
        return unicodeFractions[str];
    }

    // Mixed number: "1 1/2" or "1-1/2"
    const mixedMatch = str.match(/^(\d+)\s*[- ](\d+)\/(\d+)/);
    if (mixedMatch) {
        return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
    }

    // Fraction: "1/2"
    const fracMatch = str.match(/^(\d+)\/(\d+)/);
    if (fracMatch) {
        return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
    }

    // Decimal or integer: "2.5" or "200"
    const numMatch = str.match(/^(\d+(?:\.\d+)?)/);
    if (numMatch) {
        return parseFloat(numMatch[1]);
    }

    return null;
}

/**
 * Convert a decimal number to a human-friendly string,
 * using fractions where appropriate
 */
function formatQuantity(num) {
    if (num === null || num === undefined || isNaN(num)) return '';

    // Round to avoid floating-point noise
    num = Math.round(num * 1000) / 1000;

    // Check if it's a whole number
    if (Number.isInteger(num)) return num.toString();

    const whole = Math.floor(num);
    const frac = num - whole;

    // Common fraction mappings (tolerance-based)
    const fractions = [
        { val: 0.125, str: '⅛' },
        { val: 0.2, str: '⅕' },
        { val: 0.25, str: '¼' },
        { val: 1/3, str: '⅓' },
        { val: 0.375, str: '⅜' },
        { val: 0.4, str: '⅖' },
        { val: 0.5, str: '½' },
        { val: 0.6, str: '⅗' },
        { val: 0.625, str: '⅝' },
        { val: 2/3, str: '⅔' },
        { val: 0.75, str: '¾' },
        { val: 0.8, str: '⅘' },
        { val: 0.875, str: '⅞' },
        { val: 5/6, str: '⅚' }
    ];

    for (const f of fractions) {
        if (Math.abs(frac - f.val) < 0.03) {
            return whole > 0 ? `${whole}${f.str}` : f.str;
        }
    }

    // Fall back to 1 decimal place
    return num.toFixed(1).replace(/\.0$/, '');
}


// ─── Ingredient Parsing ──────────────────────────────────────

/**
 * Regex to match a numeric quantity at the start of an ingredient line.
 * Captures: quantity part + rest of line
 */
const QUANTITY_REGEX = /^(\d+\s*[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\d+\s*[-\s]\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(.*)/;

/**
 * Parse a single ingredient line into { quantity, rest, original }
 */
function parseIngredientLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return { quantity: null, rest: trimmed, original: trimmed };

    const match = trimmed.match(QUANTITY_REGEX);
    if (match) {
        const qtyStr = match[1];
        const rest = match[2] || '';
        const quantity = parseQuantity(qtyStr);
        return { quantity, rest, original: trimmed, qtyStr };
    }

    return { quantity: null, rest: trimmed, original: trimmed };
}

/**
 * Scale an ingredient line by a ratio
 * Returns the new line as a string
 */
function scaleIngredientLine(line, ratio) {
    const parsed = parseIngredientLine(line);
    if (parsed.quantity === null || ratio === 1) {
        return line;
    }

    const newQty = parsed.quantity * ratio;
    const formatted = formatQuantity(newQty);
    return `${formatted} ${parsed.rest}`;
}


// ─── UI Integration ──────────────────────────────────────

/**
 * Build the servings calculator HTML widget
 */
function buildServingsCalculatorHTML(currentServings) {
    return `
        <div class="servings-calculator" id="servingsCalculator">
            <div class="servings-calculator-label">
                <span class="scalc-icon">⚖️</span>
                <span>Servings</span>
            </div>
            <div class="servings-controls">
                <button type="button" class="servings-btn" id="servingsDecrease" aria-label="Decrease servings">−</button>
                <div class="servings-display">
                    <span class="servings-number" id="servingsNumber">${currentServings}</span>
                </div>
                <button type="button" class="servings-btn" id="servingsIncrease" aria-label="Increase servings">+</button>
            </div>
            <button type="button" class="servings-reset" id="servingsReset" title="Reset to original">
                ↺ Reset
            </button>
        </div>
    `;
}

/**
 * Initialize the servings calculator interactivity
 * Should be called after the recipe modal HTML is injected into the DOM
 * 
 * @param {number} originalServings - The recipe's original serving count
 * @param {string} originalIngredients - The raw ingredients string (newline-separated)
 * @param {HTMLElement} modalBodyEl - The modal body element containing the rendered recipe
 */
function initServingsCalculator(originalServings, originalIngredients, modalBodyEl) {
    const calculator = modalBodyEl.querySelector('#servingsCalculator');
    if (!calculator) return;

    const decreaseBtn = calculator.querySelector('#servingsDecrease');
    const increaseBtn = calculator.querySelector('#servingsIncrease');
    const numberDisplay = calculator.querySelector('#servingsNumber');
    const resetBtn = calculator.querySelector('#servingsReset');
    const ingredientsList = modalBodyEl.querySelector('.ingredients-list');
    const servingsMetaItem = modalBodyEl.querySelector('.servings-meta');

    let currentServings = originalServings || 1;
    const originalLines = (originalIngredients || '').split('\n').filter(l => l.trim());

    function updateUI() {
        const ratio = currentServings / (originalServings || 1);
        const isModified = currentServings !== originalServings;

        // Update number display with animation
        numberDisplay.textContent = currentServings;

        // Update button states
        decreaseBtn.disabled = currentServings <= 1;

        // Show/hide reset button
        if (isModified) {
            resetBtn.classList.add('visible');
        } else {
            resetBtn.classList.remove('visible');
        }

        // Update the servings meta item
        if (servingsMetaItem) {
            const metaContent = `<span class="meta-icon">👥</span> ${currentServings} servings`;
            const multiplierHtml = isModified
                ? ` <span class="servings-multiplier">${ratio > 1 ? '↑' : '↓'} ×${ratio.toFixed(2).replace(/\.?0+$/, '')}</span>`
                : '';
            servingsMetaItem.innerHTML = metaContent + multiplierHtml;

            if (isModified) {
                servingsMetaItem.classList.add('modified');
            } else {
                servingsMetaItem.classList.remove('modified');
            }
        }

        // Recalculate ingredients
        if (ingredientsList) {
            const items = ingredientsList.querySelectorAll('li');
            originalLines.forEach((line, i) => {
                if (items[i]) {
                    const scaled = scaleIngredientLine(line, ratio);
                    let badgeHtml = '';
                    if (isModified) {
                        const parsed = parseIngredientLine(line);
                        if (parsed.quantity !== null) {
                            const cls = ratio > 1 ? 'scale-up' : 'scale-down';
                            const arrow = ratio > 1 ? '↑' : '↓';
                            badgeHtml = ` <span class="ingredient-scale-badge ${cls}">${arrow} ×${ratio.toFixed(2).replace(/\.?0+$/, '')}</span>`;
                        }
                    }
                    items[i].innerHTML = `${scaled}${badgeHtml}`;

                    // Flash animation
                    if (isModified) {
                        items[i].classList.remove('ingredient-updated');
                        // Force reflow
                        void items[i].offsetWidth;
                        items[i].classList.add('ingredient-updated');
                    }
                }
            });
        }
    }

    function changeServings(delta) {
        const next = currentServings + delta;
        if (next < 1) return;

        currentServings = next;

        // Number bump animation
        numberDisplay.classList.remove('bump-up', 'bump-down');
        void numberDisplay.offsetWidth;
        numberDisplay.classList.add(delta > 0 ? 'bump-up' : 'bump-down');

        updateUI();
    }

    // Event listeners
    decreaseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        changeServings(-1);
    });

    increaseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        changeServings(1);
    });

    resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentServings = originalServings || 1;
        numberDisplay.classList.remove('bump-up', 'bump-down');
        updateUI();
    });

    // Initial state
    updateUI();
}

// ─── Exports ──────────────────────────────────────

export {
    buildServingsCalculatorHTML,
    initServingsCalculator,
    parseIngredientLine,
    scaleIngredientLine,
    parseQuantity,
    formatQuantity
};
