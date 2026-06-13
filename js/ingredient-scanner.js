// AI Ingredient Scanner — Premium Feature Module
// Provides camera/upload scanning with AI ingredient detection
import { isPremium } from './payment.js';
import { showNotification } from './ui-utils.js';

const API_URL = '/api';
let scannerModal = null;
let isScanning = false;
let currentStream = null;

// ===== Initialize Scanner =====
export function initScanner() {
    createScannerModal();
    attachScannerButtons();
}

// ===== Create the Scanner Modal =====
function createScannerModal() {
    // Don't duplicate
    if (document.getElementById('aiScannerModal')) return;

    const modal = document.createElement('div');
    modal.id = 'aiScannerModal';
    modal.className = 'modal ai-scanner-modal';
    modal.innerHTML = `
        <div class="modal-content ai-scanner-content">
            <button class="modal-close" id="closeScannerModal">&times;</button>

            <!-- Scanner Header -->
            <div class="scanner-header">
                <div class="scanner-logo">
                    <span class="scanner-logo-icon">🤖</span>
                    <div class="scanner-logo-ring"></div>
                </div>
                <h2>AI Ingredient Scanner</h2>
                <p class="scanner-subtitle">Snap a photo and let AI identify your ingredients</p>
                <div class="scanner-premium-badge">
                    <span>💎</span> Premium Feature
                </div>
            </div>

            <!-- Premium Gate (shown to free users) -->
            <div class="scanner-premium-gate" id="scannerPremiumGate" style="display: none;">
                <div class="premium-gate-visual">
                    <div class="gate-icon-container">
                        <span class="gate-icon">🔒</span>
                        <div class="gate-glow"></div>
                    </div>
                    <h3>Unlock AI Scanning</h3>
                    <p>Premium members get unlimited AI-powered ingredient detection from photos.</p>
                    <ul class="gate-features">
                        <li><span>📸</span> Scan ingredients from photos</li>
                        <li><span>🍰</span> Reverse-engineer dishes</li>
                        <li><span>📋</span> Extract from menus & recipes</li>
                        <li><span>⚡</span> Instant auto-fill to recipe form</li>
                    </ul>
                    <a href="./pages/payment.html?source=scanner" class="btn btn-primary scanner-upgrade-btn">
                        <span class="btn-icon">💎</span>
                        <span>Upgrade to Premium</span>
                    </a>
                </div>
            </div>

            <!-- Scanner Body (shown to premium users) -->
            <div class="scanner-body" id="scannerBody" style="display: none;">
                <!-- Mode Selection -->
                <div class="scanner-mode-tabs">
                    <button class="scanner-mode-btn active" data-mode="ingredients" id="modeBtnIngredients">
                        <span class="mode-icon">🥚</span>
                        <span class="mode-label">Ingredients</span>
                    </button>
                    <button class="scanner-mode-btn" data-mode="dish" id="modeBtnDish">
                        <span class="mode-icon">🍰</span>
                        <span class="mode-label">Dish</span>
                    </button>
                    <button class="scanner-mode-btn" data-mode="menu" id="modeBtnMenu">
                        <span class="mode-icon">📋</span>
                        <span class="mode-label">Menu/Text</span>
                    </button>
                </div>

                <!-- Camera/Upload Area -->
                <div class="scanner-capture-area" id="scannerCaptureArea">
                    <div class="scanner-viewfinder" id="scannerViewfinder">
                        <video id="scannerVideo" autoplay playsinline></video>
                        <canvas id="scannerCanvas" style="display: none;"></canvas>
                        <img id="scannerPreview" style="display: none;" alt="Scan preview">
                        
                        <!-- Scan animation overlay -->
                        <div class="scanner-overlay" id="scannerOverlay" style="display: none;">
                            <div class="scan-line"></div>
                            <div class="scan-corners">
                                <span class="corner tl"></span>
                                <span class="corner tr"></span>
                                <span class="corner bl"></span>
                                <span class="corner br"></span>
                            </div>
                        </div>

                        <!-- Placeholder (no camera) -->
                        <div class="scanner-placeholder" id="scannerPlaceholder">
                            <span class="placeholder-icon">📸</span>
                            <p>Take a photo or upload an image</p>
                        </div>
                    </div>

                    <div class="scanner-action-row">
                        <button type="button" class="scanner-action-btn" id="scannerUploadBtn">
                            <span>📁</span>
                            <span>Upload</span>
                        </button>
                        <button type="button" class="scanner-capture-btn" id="scannerCaptureBtn">
                            <span class="capture-ring"></span>
                            <span class="capture-dot"></span>
                        </button>
                        <button type="button" class="scanner-action-btn" id="scannerCameraBtn">
                            <span>📷</span>
                            <span>Camera</span>
                        </button>
                    </div>
                    <input type="file" id="scannerFileInput" accept="image/*" hidden>
                </div>

                <!-- Scanning State -->
                <div class="scanner-processing" id="scannerProcessing" style="display: none;">
                    <div class="processing-animation">
                        <div class="processing-ring"></div>
                        <span class="processing-icon">🤖</span>
                    </div>
                    <h3>Analyzing your image...</h3>
                    <p class="processing-hint" id="processingHint">Our AI chef is identifying ingredients</p>
                    <div class="processing-dots">
                        <span></span><span></span><span></span>
                    </div>
                </div>

                <!-- Results -->
                <div class="scanner-results" id="scannerResults" style="display: none;">
                    <div class="results-header">
                        <span class="results-icon">✨</span>
                        <h3>Ingredients Found</h3>
                        <span class="results-confidence" id="resultsConfidence">High confidence</span>
                    </div>

                    <div class="results-suggestion" id="resultsSuggestion" style="display: none;">
                        <span class="suggestion-label">Suggested Recipe:</span>
                        <span class="suggestion-name" id="suggestedRecipeName"></span>
                        <span class="suggestion-category" id="suggestedCategory"></span>
                    </div>

                    <div class="results-list" id="resultsList">
                        <!-- Ingredient items will be dynamically added -->
                    </div>

                    <div class="results-tip" id="resultsTip" style="display: none;">
                        <span class="tip-icon">💡</span>
                        <span class="tip-text" id="tipText"></span>
                    </div>

                    <div class="results-actions">
                        <button type="button" class="btn btn-secondary" id="scanAgainBtn">
                            <span class="btn-icon">🔄</span>
                            <span>Scan Again</span>
                        </button>
                        <button type="button" class="btn btn-primary" id="applyResultsBtn">
                            <span class="btn-icon">✅</span>
                            <span>Apply to Recipe</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    scannerModal = modal;

    // Setup event listeners
    setupScannerEvents();
}

// ===== Attach Scanner Trigger Buttons =====
function attachScannerButtons() {
    // Add Recipe form — scanner button
    const addRecipeIngredientsLabel = document.querySelector('label[for="addRecipeIngredients"]');
    if (addRecipeIngredientsLabel) {
        const scanBtn = createScannerTriggerButton('addRecipeScanBtn');
        addRecipeIngredientsLabel.style.display = 'flex';
        addRecipeIngredientsLabel.style.alignItems = 'center';
        addRecipeIngredientsLabel.style.justifyContent = 'space-between';
        addRecipeIngredientsLabel.appendChild(scanBtn);
    }

    // Sell Recipe form — scanner button
    const sellRecipeIngredientsLabel = document.querySelector('label[for="sellRecipeIngredients"]');
    if (!sellRecipeIngredientsLabel) {
        // Try to find by text content
        const allLabels = document.querySelectorAll('#sellRecipeForm label');
        for (const label of allLabels) {
            if (label.textContent.includes('Ingredients')) {
                const scanBtn = createScannerTriggerButton('sellRecipeScanBtn');
                label.style.display = 'flex';
                label.style.alignItems = 'center';
                label.style.justifyContent = 'space-between';
                label.appendChild(scanBtn);
                break;
            }
        }
    }
}

function createScannerTriggerButton(id) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = id;
    btn.className = 'ai-scan-trigger-btn';
    btn.innerHTML = `
        <span class="ai-scan-icon">🤖</span>
        <span class="ai-scan-label">AI Scan</span>
        <span class="ai-scan-badge">💎</span>
    `;
    btn.title = 'Scan ingredients with AI (Premium)';
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openScanner(id.includes('sell') ? 'sell' : 'add');
    });
    return btn;
}

// ===== Open Scanner =====
let scannerTarget = 'add'; // 'add' or 'sell'

export function openScanner(target = 'add') {
    scannerTarget = target;

    if (!scannerModal) createScannerModal();

    const premiumGate = document.getElementById('scannerPremiumGate');
    const scannerBody = document.getElementById('scannerBody');

    if (isPremium()) {
        premiumGate.style.display = 'none';
        scannerBody.style.display = 'block';
    } else {
        premiumGate.style.display = 'block';
        scannerBody.style.display = 'none';
    }

    // Reset state
    resetScanner();

    scannerModal.style.display = 'flex';
    scannerModal.classList.add('show');
}

// ===== Close Scanner =====
function closeScanner() {
    if (scannerModal) {
        scannerModal.style.display = 'none';
        scannerModal.classList.remove('show');
    }
    stopCamera();
    resetScanner();
}

// ===== Reset Scanner State =====
function resetScanner() {
    const captureArea = document.getElementById('scannerCaptureArea');
    const processing = document.getElementById('scannerProcessing');
    const results = document.getElementById('scannerResults');
    const preview = document.getElementById('scannerPreview');
    const placeholder = document.getElementById('scannerPlaceholder');
    const overlay = document.getElementById('scannerOverlay');

    if (captureArea) captureArea.style.display = 'block';
    if (processing) processing.style.display = 'none';
    if (results) results.style.display = 'none';
    if (preview) { preview.style.display = 'none'; preview.src = ''; }
    if (placeholder) placeholder.style.display = 'flex';
    if (overlay) overlay.style.display = 'none';

    isScanning = false;
}

// ===== Setup Event Listeners =====
function setupScannerEvents() {
    // Close modal
    const closeBtn = document.getElementById('closeScannerModal');
    if (closeBtn) closeBtn.addEventListener('click', closeScanner);

    scannerModal.addEventListener('click', (e) => {
        if (e.target === scannerModal) closeScanner();
    });

    // Mode tabs
    const modeBtns = scannerModal.querySelectorAll('.scanner-mode-btn');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Upload button
    const uploadBtn = document.getElementById('scannerUploadBtn');
    const fileInput = document.getElementById('scannerFileInput');
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileUpload);
    }

    // Camera button
    const cameraBtn = document.getElementById('scannerCameraBtn');
    if (cameraBtn) {
        cameraBtn.addEventListener('click', startCamera);
    }

    // Capture button
    const captureBtn = document.getElementById('scannerCaptureBtn');
    if (captureBtn) {
        captureBtn.addEventListener('click', capturePhoto);
    }

    // Scan Again
    const scanAgainBtn = document.getElementById('scanAgainBtn');
    if (scanAgainBtn) {
        scanAgainBtn.addEventListener('click', () => {
            resetScanner();
            stopCamera();
        });
    }

    // Apply Results
    const applyBtn = document.getElementById('applyResultsBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', applyResults);
    }
}

// ===== Camera Functions =====
async function startCamera() {
    try {
        const video = document.getElementById('scannerVideo');
        const placeholder = document.getElementById('scannerPlaceholder');
        const preview = document.getElementById('scannerPreview');

        if (currentStream) {
            stopCamera();
            return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment', // Rear camera on mobile
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        currentStream = stream;
        video.srcObject = stream;
        video.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        if (preview) preview.style.display = 'none';

        showNotification('📷 Camera active — tap capture to scan!', 'success');
    } catch (err) {
        console.error('Camera error:', err);
        showNotification('📷 Camera not available. Use the upload button instead.', 'error');
    }
}

function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    const video = document.getElementById('scannerVideo');
    if (video) {
        video.srcObject = null;
        video.style.display = 'none';
    }
}

function capturePhoto() {
    const video = document.getElementById('scannerVideo');
    const canvas = document.getElementById('scannerCanvas');

    if (!video || !video.srcObject) {
        showNotification('📷 Start the camera first, or upload an image.', 'error');
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.8);

    showPreviewAndScan(imageData);
}

// ===== File Upload Handler =====
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showNotification('❌ Please select an image file.', 'error');
        return;
    }

    // 5MB limit for scan images
    if (file.size > 5 * 1024 * 1024) {
        showNotification('❌ Image too large. Please use an image under 5MB.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        showPreviewAndScan(event.target.result);
    };
    reader.readAsDataURL(file);

    // Reset the input
    e.target.value = '';
}

// ===== Show Preview & Trigger Scan =====
function showPreviewAndScan(imageData) {
    const preview = document.getElementById('scannerPreview');
    const placeholder = document.getElementById('scannerPlaceholder');
    const overlay = document.getElementById('scannerOverlay');

    stopCamera();

    if (preview) {
        preview.src = imageData;
        preview.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (overlay) overlay.style.display = 'block';

    // Wait for scan animation, then call API
    setTimeout(() => {
        scanImage(imageData);
    }, 800);
}

// ===== Scan API Call =====
let lastScanResult = null;

async function scanImage(imageData) {
    if (isScanning) return;
    isScanning = true;

    const captureArea = document.getElementById('scannerCaptureArea');
    const processing = document.getElementById('scannerProcessing');
    const hint = document.getElementById('processingHint');

    // Show processing
    if (captureArea) captureArea.style.display = 'none';
    if (processing) processing.style.display = 'flex';

    // Rotate processing hints
    const hints = [
        'Our AI chef is identifying ingredients',
        'Detecting quantities and measurements',
        'Analyzing textures and food types',
        'Matching to our recipe database',
        'Almost there...'
    ];
    let hintIdx = 0;
    const hintInterval = setInterval(() => {
        hintIdx = (hintIdx + 1) % hints.length;
        if (hint) hint.textContent = hints[hintIdx];
    }, 2000);

    try {
        const activeMode = scannerModal.querySelector('.scanner-mode-btn.active');
        const mode = activeMode?.dataset.mode || 'ingredients';

        const token = sessionStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/scanner/scan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ image: imageData, mode })
        });

        const data = await response.json();

        clearInterval(hintInterval);

        if (data.requiresPremium) {
            // Premium gate triggered
            if (processing) processing.style.display = 'none';
            document.getElementById('scannerPremiumGate').style.display = 'block';
            document.getElementById('scannerBody').style.display = 'none';
            isScanning = false;
            return;
        }

        if (!response.ok) {
            throw new Error(data.error || 'Scan failed');
        }

        lastScanResult = data;
        showResults(data);

    } catch (err) {
        clearInterval(hintInterval);
        console.error('Scan error:', err);
        showNotification(`❌ ${err.message || 'Failed to scan. Please try again.'}`, 'error');
        resetScanner();
    }

    isScanning = false;
}

// ===== Display Results =====
function showResults(data) {
    const processing = document.getElementById('scannerProcessing');
    const results = document.getElementById('scannerResults');
    const resultsList = document.getElementById('resultsList');
    const confidence = document.getElementById('resultsConfidence');
    const suggestion = document.getElementById('resultsSuggestion');
    const suggestedName = document.getElementById('suggestedRecipeName');
    const suggestedCat = document.getElementById('suggestedCategory');
    const tipSection = document.getElementById('resultsTip');
    const tipText = document.getElementById('tipText');

    if (processing) processing.style.display = 'none';
    if (results) results.style.display = 'block';

    // Confidence badge
    if (confidence) {
        const level = data.confidence || 'medium';
        const labels = { high: '✅ High confidence', medium: '🟡 Medium confidence', low: '🔴 Low confidence' };
        confidence.textContent = labels[level] || labels.medium;
        confidence.className = `results-confidence confidence-${level}`;
    }

    // Suggestion
    if (data.suggestedName && suggestion) {
        suggestion.style.display = 'flex';
        if (suggestedName) suggestedName.textContent = data.suggestedName;
        if (suggestedCat) suggestedCat.textContent = data.suggestedCategory || '';
    }

    // Ingredients list
    if (resultsList) {
        resultsList.innerHTML = data.ingredients.map((ing, i) => `
            <div class="result-ingredient" style="animation-delay: ${i * 0.06}s">
                <span class="ingredient-check">
                    <input type="checkbox" id="ing_${i}" checked class="ingredient-checkbox">
                </span>
                <label for="ing_${i}" class="ingredient-text">${ing}</label>
                <button type="button" class="ingredient-remove" data-idx="${i}" title="Remove">&times;</button>
            </div>
        `).join('');

        // Remove buttons
        resultsList.querySelectorAll('.ingredient-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.result-ingredient').remove();
            });
        });
    }

    // Chef's tip
    if (data.tips && tipSection && tipText) {
        tipSection.style.display = 'flex';
        tipText.textContent = data.tips;
    }
}

// ===== Apply Results to Recipe Form =====
function applyResults() {
    if (!lastScanResult) return;

    // Get checked ingredients
    const checkedIngredients = [];
    const checkboxes = document.querySelectorAll('#resultsList .ingredient-checkbox:checked');
    checkboxes.forEach(cb => {
        const text = cb.closest('.result-ingredient').querySelector('.ingredient-text')?.textContent;
        if (text) checkedIngredients.push(text.trim());
    });

    if (checkedIngredients.length === 0) {
        showNotification('⚠️ No ingredients selected. Check at least one.', 'error');
        return;
    }

    // Determine the target textarea
    let ingredientsField, nameField, categoryField;

    if (scannerTarget === 'sell') {
        ingredientsField = document.getElementById('sellRecipeIngredients');
        nameField = document.getElementById('sellRecipeName');
        categoryField = document.getElementById('sellRecipeCategory');
    } else {
        ingredientsField = document.getElementById('addRecipeIngredients');
        nameField = document.getElementById('addRecipeName');
        categoryField = document.getElementById('addRecipeCategory');
    }

    // Apply ingredients
    if (ingredientsField) {
        const existing = ingredientsField.value.trim();
        const newIngredients = checkedIngredients.join('\n');

        if (existing) {
            ingredientsField.value = existing + '\n' + newIngredients;
        } else {
            ingredientsField.value = newIngredients;
        }

        // Trigger animation on the field
        ingredientsField.classList.add('scanner-filled');
        setTimeout(() => ingredientsField.classList.remove('scanner-filled'), 1500);
    }

    // Auto-fill suggested name if field is empty
    if (nameField && !nameField.value.trim() && lastScanResult.suggestedName) {
        nameField.value = lastScanResult.suggestedName;
        nameField.classList.add('scanner-filled');
        setTimeout(() => nameField.classList.remove('scanner-filled'), 1500);
    }

    // Auto-fill category if suggested
    if (categoryField && lastScanResult.suggestedCategory) {
        const options = categoryField.querySelectorAll('option');
        for (const opt of options) {
            if (opt.value.toLowerCase().includes(lastScanResult.suggestedCategory.toLowerCase()) ||
                lastScanResult.suggestedCategory.toLowerCase().includes(opt.value.toLowerCase())) {
                categoryField.value = opt.value;
                break;
            }
        }
    }

    showNotification(`✅ ${checkedIngredients.length} ingredients added to your recipe!`, 'success');
    closeScanner();
}
