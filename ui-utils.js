export function showNotification(message, optionsOrType) {
    let type = 'success';
    let duration = 3000;
    let action;
    let icon = '';

    if (typeof optionsOrType === 'string') {
        type = optionsOrType;
    } else if (optionsOrType) {
        type = optionsOrType.type || 'success';
        if (optionsOrType.duration !== undefined) duration = optionsOrType.duration;
        action = optionsOrType.action;
        icon = optionsOrType.icon || '';
    }

    if (!icon) {
        icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : (type === 'info' ? 'ℹ️' : '⚠️'));
    }

    // Create container if it doesn't exist
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type} interactive-alert`;
    
    let html = `
        <div class="notification-content">
            <span class="notification-icon">${icon}</span>
            <span class="notification-message">${message}</span>
        </div>
    `;

    // Action button
    if (action) {
        html += `<button class="notification-action-btn">${action.label}</button>`;
    }

    // Close button
    html += `<button class="notification-close-btn">&times;</button>`;

    notification.innerHTML = html;

    // Add to container
    container.appendChild(notification);

    // Event listeners
    if (action) {
        const actionBtn = notification.querySelector('.notification-action-btn');
        actionBtn.addEventListener('click', () => {
            action.onClick();
            closeNotification(notification);
        });
    }

    const closeBtn = notification.querySelector('.notification-close-btn');
    closeBtn.addEventListener('click', () => {
        closeNotification(notification);
    });

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Auto-remove
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentElement) {
                closeNotification(notification);
            }
        }, duration);
    }
}

function closeNotification(notification) {
    notification.classList.remove('show');
    notification.classList.add('hide');
    setTimeout(() => notification.remove(), 300);
}
