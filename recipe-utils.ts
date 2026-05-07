
/**
 * Common utility functions for recipes
 */

/** Supported recipe categories */
type RecipeCategory = 'cakes' | 'cookies' | 'pastries' | 'pies' | 'breads' | 'desserts' | 'chocolates' | 'other';

/** Supported difficulty levels */
type DifficultyLevel = 'easy' | 'medium' | 'hard';

/** Shape of recipe data passed to card builders */
interface RecipeCardData {
    id: number;
    name: string;
    category?: RecipeCategory | string;
    photo?: string;
    video?: string;
    difficulty?: DifficultyLevel | string;
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    instructions?: string;
    author?: { name?: string; username?: string; pic?: string };
    authorName?: string;
    [key: string]: unknown;
}

// Global window functions are accessed dynamically via (window as any)

const categoryEmojiMap: Record<string, string> = {
    'cakes': '🎂',
    'cookies': '🍪',
    'pastries': '🥐',
    'pies': '🥧',
    'breads': '🍞',
    'desserts': '🍰',
    'chocolates': '🍫',
    'other': '✨'
};

export function getCategoryEmoji(category?: string): string {
    return categoryEmojiMap[category?.toLowerCase() ?? ''] ?? '🧁';
}

const difficultyTextMap: Record<string, string> = {
    'easy': '🟢 Easy',
    'medium': '🟡 Medium',
    'hard': '🔴 Hard'
};

export function getDifficultyText(difficulty?: string): string {
    return difficultyTextMap[difficulty?.toLowerCase() ?? ''] ?? '🟡 Medium';
}

export function formatRecipeTime(prepTime?: number, cookTime?: number): number {
    return (prepTime || 0) + (cookTime || 0);
}

/**
 * Creates a premium public recipe card
 */
export function createPublicRecipeCard(recipe: RecipeCardData): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'recipe-card public-recipe-card';

    const categoryEmoji = getCategoryEmoji(recipe.category);
    const difficultyText = getDifficultyText(recipe.difficulty);
    const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

    // Image logic
    let photoDisplay = '';
    if (recipe.photo) {
        photoDisplay = `<img src="${recipe.photo}" alt="${recipe.name}" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
        photoDisplay = `<div class="no-photo" style="display:flex; align-items:center; justify-content:center; height:100%; font-size:4rem; background:linear-gradient(135deg, #2a2a3e 0%, #1a1a2e 100%);">${categoryEmoji}</div>`;
    }

    const authorName = recipe.author?.name || recipe.authorName || 'Chef';
    
    card.innerHTML = `
        <div class="recipe-card-image" style="width: 100%; height: 100%; position: absolute; top:0; left:0; z-index:0;">
            ${photoDisplay}
            ${recipe.video ? `<div class="recipe-video-badge" style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 20px; font-size: 0.7rem; z-index: 5; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.2);">📽️ Video</div>` : ''}
        </div>

        <div class="public-card-overlay" style="position: absolute; bottom: 0; left: 0; right: 0; height: 100%; background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%); padding: 15px; display: flex; flex-direction: column; justify-content: flex-end; z-index: 1;">
            <h3 class="recipe-title" style="color: white; font-size: 1.2rem; margin-bottom: 2px; font-weight: 700;">${recipe.name}</h3>
            <p class="author-name" style="font-size: 0.8rem; color: #ccc; margin: 0 0 8px 0;">By: ${authorName}</p>
            <div class="recipe-meta" style="display: flex; gap: 8px; font-size: 0.75rem; color: rgba(255, 255, 255, 0.8); margin-bottom: 5px;">
                <span style="background: rgba(0,0,0,0.4); padding: 3px 8px; border-radius: 10px;">⏱️ ${totalTime}m</span>
                <span style="background: rgba(0,0,0,0.4); padding: 3px 8px; border-radius: 10px;">👥 ${recipe.servings || 0}</span>
                <span style="background: rgba(0,0,0,0.4); padding: 3px 8px; border-radius: 10px;">${difficultyText}</span>
            </div>

            <div class="overlay-actions" style="display: flex; gap: 8px; margin-top: 10px; opacity: 0; transition: opacity 0.3s ease;">
                <button class="btn-overlay-action view-btn" style="background: var(--accent-pink); color: white; border: none; padding: 6px 12px; border-radius: 15px; font-size: 0.75rem; cursor: pointer; font-weight: 600;">View Detail</button>
                <button class="btn-overlay-action menu-btn" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 15px; font-size: 0.75rem; cursor: pointer; font-weight: 600;" title="Add to Daily Menu">📅 Add to Menu</button>
            </div>
        </div>
    `;

    // Show actions on hover
    card.onmouseenter = () => { (card.querySelector('.overlay-actions') as HTMLElement).style.opacity = '1'; };
    card.onmouseleave = () => { (card.querySelector('.overlay-actions') as HTMLElement).style.opacity = '0'; };

    // View Detail logic
    const viewBtn = card.querySelector('.view-btn') as HTMLButtonElement;
    const handleView = (e: Event) => {
        e.stopPropagation();
        if (typeof (window as any).viewRecipe === 'function') {
            (window as any).viewRecipe(recipe, true);
        }
    };
    viewBtn.onclick = handleView;
    card.onclick = handleView;

    // Add to Menu logic
    const menuBtn = card.querySelector('.menu-btn') as HTMLButtonElement;
    menuBtn.onclick = (e: Event) => {
        e.stopPropagation();
        if (typeof (window as any).openDayPickerModal === 'function') {
            (window as any).openDayPickerModal(recipe);
        } else {
            alert('Please open the main app to add recipes to your menu.');
        }
    };

    return card;
}
