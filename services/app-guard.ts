import { initLanguage } from '../js/language';

export function initializeApp() {
    // 1. Theme Logic
    // Read from localStorage or fallback to system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);

    // 2. Auth Logic
    const pathname = window.location.pathname;
    const isAuthPage = pathname.endsWith('auth.html') || pathname.endsWith('register.html');
    const isPublicPage = pathname.endsWith('/') || pathname.endsWith('index.html');

    // We only strictly require auth on dashboard/profile/specific tool pages.
    // However, the original inline scripts checked this heavily on specific pages.
    // If the page is NOT an auth page and NOT a public page, we enforce login.
    const requiresAuth = !isAuthPage && !isPublicPage;

    const currentUser = sessionStorage.getItem('currentUser');

    if (requiresAuth && !currentUser) {
        // Store return URL before redirecting to auth (helpful for payment.html, etc)
        if (pathname && !pathname.endsWith('auth.html') && !pathname.endsWith('register.html')) {
            sessionStorage.setItem('returnUrl', window.location.href);
        }
        const authRedirectPath = pathname.includes('/pages/') ? './auth.html' : './pages/auth.html';
        window.location.replace(authRedirectPath);
        return;
    }

    // Admin Route Protection
    if (pathname.includes('admin') && sessionStorage.getItem('isAdmin') !== 'true') {
        const indexRedirectPath = pathname.includes('/pages/') ? '../index.html' : './index.html';
        window.location.replace(indexRedirectPath);
        return;
    }

    // 3. Language Logic
    // Only initialize language if we have the DOM ready or script is deferred
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLanguage);
    } else {
        initLanguage();
    }
}

// Auto-run on import to ensure guard runs immediately (like the inline scripts did)
initializeApp();
