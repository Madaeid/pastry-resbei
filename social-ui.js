// Social UI Components for Chef Book

/**
 * Formats a date string to a relative time (e.g. "2h ago", "Just now")
 */
export function formatTimeAgo(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 0) return 'Just now'; // Future date?
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

    return date.toLocaleDateString();
}

/**
 * Renders the HTML for the comments list (Supports Threaded)
 */
export function renderCommentsList(commentsList, postAuthorId, currentUserId) {
    if (!Array.isArray(commentsList) || commentsList.length === 0) {
        return '<div style="text-align: center; padding: 15px; color: #888; font-size: 0.85rem;">No comments yet.</div>';
    }

    // Organize comments by parentId
    const topLevel = commentsList.filter(c => !c.parentId);
    const replies = commentsList.filter(c => c.parentId);

    const renderComment = (c, isReply = false) => {
        const isCommentMine = currentUserId && c.userId === currentUserId;
        const isPostMine = currentUserId && postAuthorId === currentUserId;
        const isLiked = c.isLikedByMe;

        let actionsHtml = '';
        actionsHtml += `
            <div style="margin-top: 4px; font-size: 0.75rem; display: flex; align-items: center; gap: 10px;">
                <a href="#" class="like-comment-btn" data-id="${c.id}" style="color: ${isLiked ? 'var(--accent-pink)' : '#aaa'}; text-decoration: none; font-weight: ${isLiked ? '700' : '400'};">
                    ${isLiked ? '❤️ Liked' : '🤍 Like'} 
                    ${c.likes > 0 ? `<span class="comment-likes-count">(${c.likes})</span>` : ''}
                </a>
                <a href="#" class="reply-comment-btn" data-id="${c.id}" style="color: #aaa; text-decoration: none;">Reply</a>
        `;

        if (isCommentMine || isPostMine) {
            actionsHtml += `
                ${isCommentMine ? `<a href="#" class="edit-comment-btn" data-id="${c.id}" style="color: #aaa; text-decoration: none;">Edit</a>` : ''}
                <a href="#" class="del-comment-btn" data-id="${c.id}" style="color: #ff6b6b; text-decoration: none;">Delete</a>
            `;
        }
        actionsHtml += '</div>';

        // Find child replies
        const childReplies = replies.filter(r => r.parentId === c.id);
        const childrenHtml = childReplies.length > 0
            ? `<div class="replies-container" style="margin-left: 20px; border-left: 1px solid rgba(255,255,255,0.05); padding-left: 10px;">
                ${childReplies.map(r => renderComment(r, true)).join('')}
               </div>`
            : '';

        const authorPic = c.authorPic || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.authorName)}&background=random&color=fff`;

        return `
        <div class="post-comment-wrapper" id="comment-wrapper-${c.id}">
            <div class="post-comment" id="comment-${c.id}" style="display: flex; gap: 10px; margin-top: 10px; font-size: 0.85rem;">
                <img src="${authorPic}" alt="${c.authorName}" class="post-author-link" data-username="${c.authorUsername}" style="width: ${isReply ? '20px' : '24px'}; height: ${isReply ? '20px' : '24px'}; border-radius: 50%; object-fit: cover; cursor: pointer;">
                <div style="background: rgba(255,255,255,0.05); padding: 5px 10px; border-radius: 12px; flex: 1;">
                    <strong class="post-author-link" data-username="${c.authorUsername}" style="color: var(--accent-pink); cursor: pointer; transition: opacity 0.2s;">${c.authorName}</strong>
                    <span class="comment-text" id="comment-text-${c.id}" style="display: block; margin-top: 2px;">${c.text}</span>
                    ${actionsHtml}
                </div>
            </div>
            <!-- Reply Form (Hidden by default) -->
            <form class="reply-form" data-parent-id="${c.id}" style="display: none; margin-left: 34px; margin-top: 8px;">
                <input type="text" class="reply-input" placeholder="Write a reply..." required style="width: 100%; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 4px 12px; color: white; font-size: 0.8rem; outline: none;">
            </form>
            ${childrenHtml}
        </div>
        `;
    };

    return topLevel.map(c => renderComment(c)).join('');
}

/**
 * Creates a social post card element
 */
export function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';

    // Author handling
    let authorName = post.author?.name || post.authorName || 'Chef';
    let authorPic = post.author?.pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random&color=fff`;
    let isPremium = post.author?.isPremium || post.isPremium || false;

    const timeAgo = formatTimeAgo(post.dateAdded || post.createdAt);

    // State for interactions
    let likes = post.likes || 0;
    let commentsList = Array.isArray(post.comments) ? post.comments : [];
    let commentsCount = commentsList.length;
    let shares = post.shares || 0;

    // Auth info for actions
    let currentUserId = null;
    const token = sessionStorage.getItem('authToken');
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            currentUserId = payload.userId;
        } catch (e) { }
    }

    // Image logic for post
    let photoHtml = '';
    if (post.photo && !post.sharedFrom) {
        photoHtml = `
            <div class="post-media" style="margin-top: 15px; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1);">
                <img src="${post.photo}" alt="Post Photo" style="max-width: 100%; border-radius: 20px; margin: auto; display: block; max-height: 500px; object-fit: cover;">
            </div>
        `;
    }

    // Video logic
    let videoHtml = '';
    if (post.video && !post.sharedFrom) {
        videoHtml = `
            <div class="post-media" style="margin-top: 15px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1);">
                <video src="${post.video}" controls style="width: 100%; display: block; max-height: 500px; background: #000;"></video>
            </div>
        `;
    }

    // Shared Post logic
    let sharedHtml = '';
    const s = post.sharedFrom;
    if (s) {
        const sAuthorName = s.author?.name || 'Chef';
        const sAuthorPic = s.author?.pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(sAuthorName)}&background=random&color=fff`;
        const sPhotoHtml = s.photo ? `
            <div class="shared-media" style="margin-top: 10px; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                <img src="${s.photo}" alt="Shared Photo" style="width: 100%; display: block; max-height: 400px; object-fit: cover;">
            </div>
        ` : '';
        const sVideoHtml = s.video ? `
            <div class="shared-media" style="margin-top: 10px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                <video src="${s.video}" controls style="width: 100%; display: block; max-height: 400px; background: #000;"></video>
            </div>
        ` : '';

        sharedHtml = `
            <div class="shared-post-wrapper" style="margin-top: 15px; padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid ${s.isStore ? 'var(--accent-pink)' : 'rgba(255,255,255,0.1)'}; border-radius: 12px; transition: background 0.2s ease;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <img src="${sAuthorPic}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=${sAuthorName}&background=random'">
                        <span style="font-weight: 700; font-size: 0.8rem; color: var(--accent-pink);">${sAuthorName}'s ${s.isStore ? 'Store Item' : 'Post'}</span>
                    </div>
                    ${s.isStore ? `<span style="font-size: 0.7rem; background: var(--accent-pink); color: white; padding: 2px 8px; border-radius: 10px; font-weight: bold;">🛒 STORE</span>` : ''}
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; cursor: pointer;" onclick="event.stopPropagation(); ${s.isStore ? `if(typeof viewStoreRecipe === 'function'){viewStoreRecipe(${s.id})}else{alert('Open the Store tab to view this recipe!')}` : `window.viewRecipe(${JSON.stringify(s).replace(/"/g, '&quot;')}, true)`}">
                    ${s.name ? `<h4 style="margin: 0 0 5px 0; color: white;">${s.name}</h4>` : ''}
                    <p style="margin: 0; white-space: pre-wrap; ${s.isStore ? 'color: var(--accent-pink); font-style: italic;' : ''}">${s.instructions}</p>
                    ${sPhotoHtml}
                    ${sVideoHtml}
                    ${s.isStore ? `<button style="width: 100%; margin-top: 10px; padding: 8px; border-radius: 10px; background: rgba(255,107,138,0.1); border: 1px solid var(--accent-pink); color: white; font-weight: 600; cursor: pointer;">View in Store</button>` : ''}
                </div>
            </div>
        `;
    }

    const commentsHtml = renderCommentsList(commentsList, post.author?.userId, currentUserId);

    card.innerHTML = `
        <div class="post-header">
            <div class="post-author-info" style="cursor: pointer;" onclick="window.location.href='chef-profile.html?username=${post.author?.username || post.authorUsername}'">
                <div class="author-avatar-med">
                    <img src="${authorPic}" alt="${authorName}">
                </div>
                <div class="author-details">
                    <div class="author-name-row">
                        <span class="author-display-name">${authorName}</span>
                        ${isPremium ? '<span class="premium-star" title="Premium Chef">💎</span>' : ''}
                        ${post.sharedFrom ? `<span style="font-size: 0.85rem; color: var(--text-secondary); margin-left: 6px; font-weight: normal;">shared <strong>${post.sharedFrom.author?.name || 'Chef'}</strong>'s post</span>` : ''}
                    </div>
                    <span class="post-time">${timeAgo}</span>
                </div>
            </div>
            <div class="post-menu-container">
                <div class="post-menu-btn">⋮</div>
                ${(currentUserId && post.author?.userId === currentUserId) ? `
                <div class="post-dropdown-menu" style="display: none; position: absolute; right: 0; top: 30px; background: #2a2a3e; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; z-index: 100; min-width: 120px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                    <div class="post-menu-item edit-post-btn" style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.9rem;">✏️ Edit Post</div>
                    <div class="post-menu-item del-post-btn" style="padding: 10px 15px; cursor: pointer; color: #ff6b6b; font-size: 0.9rem;">🗑️ Delete Post</div>
                </div>
                ` : ''}
            </div>
        </div>
            ${(post.category && post.category !== 'Social' && post.category !== 'Other' && post.name && !post.name.startsWith('Reshare of')) ? `
                <div class="post-recipe-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <h3 class="post-recipe-title" style="margin: 0; font-family: 'Playfair Display', serif; color: var(--text-primary); font-size: 1.3rem;">${post.name}</h3>
                    <button class="btn-view-recipe-full" style="background: var(--primary-gradient); color: white; border: none; padding: 5px 12px; border-radius: 15px; font-size: 0.75rem; font-weight: 600; cursor: pointer; white-space: nowrap;">View Recipe</button>
                </div>
            ` : ''}
            <p class="post-text" style="white-space: pre-wrap; margin-bottom: 10px;">${post.instructions}</p>
            ${photoHtml}
            ${videoHtml}
            ${sharedHtml}
        </div>
        <div class="post-footer">
            <div class="post-stats">
                <span class="post-stat likes-count-clickable">❤️ <span class="likes-count">${likes}</span></span>
                <span class="post-stat">💬 <span class="comments-count">${commentsCount}</span></span>
                <span class="post-stat">🔁 <span class="shares-count">${shares}</span></span>
            </div>
            <div class="post-actions">
                <button class="post-btn-action btn-like">Like</button>
                <button class="post-btn-action btn-comment">Comment</button>
                <div class="post-share-container" style="position: relative; flex: 1;">
                    <button class="post-btn-action btn-share" style="width: 100%;">Share</button>
                    <div class="share-dropdown-menu" style="display: none; position: absolute; bottom: 100%; left: 0; background: #2a2a3e; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; z-index: 100; min-width: 180px; box-shadow: 0 -4px 20px rgba(0,0,0,0.3); margin-bottom: 5px;">
                        <div class="share-menu-item reshare-internal-btn" style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.9rem; display: flex; align-items: center; gap: 10px;">
                            <span>🔁</span> Reshare to Feed
                        </div>
                        <div class="share-menu-item share-external-btn" style="padding: 10px 15px; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 10px;">
                            <span>🔗</span> Copy Link / Share
                        </div>
                    </div>
                </div>
            </div>
            <div class="post-comments-section" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); ${commentsCount === 0 ? 'display: none;' : ''}">
                <div class="comments-list">${commentsHtml}</div>
                <form class="post-comment-form" style="display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px dotted rgba(255,255,255,0.05);">
                    <input type="text" class="comment-input" placeholder="Write a comment..." required style="flex: 1; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 6px 15px; color: white; font-size: 0.85rem; outline: none;">
                    <button type="submit" style="background: none; border: none; color: var(--accent-pink); font-weight: 600; cursor: pointer; padding: 0 5px;">Post</button>
                </form>
            </div>
        </div>
    `;

    // Click to view full recipe
    const viewRecipeBtn = card.querySelector('.btn-view-recipe-full');
    if (viewRecipeBtn) {
        viewRecipeBtn.onclick = (e) => {
            e.stopPropagation();
            if (typeof window.viewRecipe === 'function') {
                window.viewRecipe(post, true);
            } else {
                console.error('viewRecipe function not found');
                alert('Detailed recipe view is not available on this page.');
            }
        };
    }

    // Click on recipe title also views recipe
    const recipeTitle = card.querySelector('.post-recipe-title');
    if (recipeTitle) {
        recipeTitle.style.cursor = 'pointer';
        recipeTitle.onclick = (e) => {
            e.stopPropagation();
            if (typeof window.viewRecipe === 'function') {
                window.viewRecipe(post, true);
            }
        };
    }

    // Event listeners
    const API_URL = '/api';

    // Handle Likes Modal
    const likesCountContainer = card.querySelector('.likes-count-clickable');
    if (likesCountContainer) {
        likesCountContainer.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (likes <= 0) return;

            const likesModal = document.getElementById('likesModal');
            const likesListBody = document.getElementById('likesListBody');
            if (!likesModal || !likesListBody) return;

            likesListBody.innerHTML = '<div style="text-align: center; padding: 20px;">Loading likes...</div>';
            likesModal.style.display = 'flex';

            try {
                const response = await fetch(`${API_URL}/recipes/${post.id}/likes`);
                const users = await response.json();

                if (users.length === 0) {
                    likesListBody.innerHTML = '<div style="text-align: center; color: #888;">No likes yet</div>';
                } else {
                    likesListBody.innerHTML = users.map(user => {
                        const userPic = user.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=random&color=fff`;
                        return `
                        <div class="user-list-item">
                            <img src="${userPic}" class="user-list-avatar" alt="${user.displayName}">
                            <div class="user-list-info">
                                <span class="user-list-name">${user.displayName}</span>
                                <span class="user-list-username">@${user.username}</span>
                            </div>
                        </div>
                    `;
                    }).join('');
                }
            } catch (err) {
                console.error(err);
                likesListBody.innerHTML = '<div style="color: #ff6b6b; text-align: center;">Error loading list</div>';
            }
        });
    }

    // Dropdown toggle
    const menuBtn = card.querySelector('.post-menu-btn');
    const dropdown = card.querySelector('.post-dropdown-menu');
    if (menuBtn && dropdown) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close all other dropdowns first
            document.querySelectorAll('.post-dropdown-menu').forEach(d => {
                if (d !== dropdown) d.style.display = 'none';
            });
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });

        document.addEventListener('click', () => {
            dropdown.style.display = 'none';
        });

        // Edit Post listener
        const editBtn = card.querySelector('.edit-post-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropdown.style.display = 'none';
                if (typeof window.editPost === 'function') {
                    window.editPost(post.id);
                } else {
                    console.error('window.editPost is not defined');
                }
            });
        }

        // Delete Post listener
        const delBtn = card.querySelector('.del-post-btn');
        if (delBtn) {
            delBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropdown.style.display = 'none';
                if (typeof window.deletePost === 'function') {
                    window.deletePost(post.id);
                } else {
                    // Fallback to deleteRecipe if deletePost isn't defined
                    if (typeof window.deleteRecipe === 'function') {
                        window.deleteRecipe(post.id);
                    } else {
                        console.error('Delete functions not defined');
                    }
                }
            });
        }
    }

    // Like logic
    const likeBtn = card.querySelector('.btn-like');
    if (likeBtn) {
        likeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof window.toggleLike === 'function') {
                window.toggleLike(post.id, card.querySelector('.likes-count'), likeBtn);
            } else {
                console.warn('toggleLike not defined globally');
            }
        });
    }

    // Comment toggle
    const commentBtn = card.querySelector('.btn-comment');
    const commentsSection = card.querySelector('.post-comments-section');
    if (commentBtn && commentsSection) {
        commentBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = commentsSection.style.display === 'none' || commentsSection.style.display === '';
            commentsSection.style.display = isHidden ? 'block' : 'none';

            // If opening, focusing on input if exists
            if (isHidden) {
                const commentInput = card.querySelector('.comment-input');
                if (commentInput) commentInput.focus();
            }
        });
    }

    // Share Post Dropdown logic
    const shareBtn = card.querySelector('.btn-share');
    const shareDropdown = card.querySelector('.share-dropdown-menu');
    const reshareBtn = card.querySelector('.reshare-internal-btn');
    const externalShareBtn = card.querySelector('.share-external-btn');

    if (shareBtn && shareDropdown) {
        shareBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Close other dropdowns
            document.querySelectorAll('.share-dropdown-menu, .post-dropdown-menu').forEach(d => {
                if (d !== shareDropdown) d.style.display = 'none';
            });
            shareDropdown.style.display = shareDropdown.style.display === 'none' ? 'block' : 'none';
        });

        // Close on outside click
        document.addEventListener('click', () => {
            if (shareDropdown) shareDropdown.style.display = 'none';
        });

        // Internal Reshare
        if (reshareBtn) {
            reshareBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                shareDropdown.style.display = 'none';
                if (typeof window.sharePost === 'function') {
                    window.sharePost(post.id);
                } else if (typeof window.internalReshare === 'function') {
                    window.internalReshare(post.id);
                }
            });
        }

        // External Share
        if (externalShareBtn) {
            externalShareBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                shareDropdown.style.display = 'none';

                const shareData = {
                    title: `Check out this post from ${authorName}`,
                    text: post.instructions,
                    url: `${window.location.origin}/chef-profile.html?username=${post.author?.username || post.authorUsername}&post=${post.id}`
                };

                if (navigator.share) {
                    navigator.share(shareData).catch(err => console.error('Error sharing:', err));
                } else {
                    // Fallback to clipboard
                    navigator.clipboard.writeText(shareData.url).then(() => {
                        if (typeof window.showNotification === 'function') {
                            window.showNotification('📋 Link copied to clipboard!', 'success');
                        } else {
                            alert('Link copied to clipboard!');
                        }
                    });
                }
            });
        }
    }

    // Submit Comment listener
    const commentForm = card.querySelector('.post-comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = commentForm.querySelector('.comment-input');
            const text = input ? input.value.trim() : '';
            if (!text) return;

            if (typeof window.submitComment === 'function') {
                window.submitComment(post.id, text, card);
                input.value = ''; // Clear input
            } else {
                console.error('window.submitComment is not defined');
            }
        });
    }

    // Comment actions delegation (Edit/Delete)
    const commentsListEl = card.querySelector('.comments-list');
    const commentsCountSpan = card.querySelector('.comments-count');
    if (commentsListEl) {
        commentsListEl.addEventListener('submit', (e) => {
            const replyForm = e.target.closest('.reply-form');
            if (replyForm) {
                e.preventDefault();
                const parentId = replyForm.dataset.parentId;
                const input = replyForm.querySelector('.reply-input');
                const text = input ? input.value.trim() : '';
                if (text && typeof window.submitComment === 'function') {
                    window.submitComment(post.id, text, card, parentId);
                    input.value = '';
                    replyForm.style.display = 'none';
                }
            }
        });

        commentsListEl.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-comment-btn');
            const delBtn = e.target.closest('.del-comment-btn');
            const likeBtn = e.target.closest('.like-comment-btn');
            const replyBtn = e.target.closest('.reply-comment-btn');
            const authorLink = e.target.closest('.post-author-link');

            if (authorLink) {
                const username = authorLink.dataset.username;
                if (username) {
                    window.location.href = `chef-profile.html?username=${username}`;
                }
            }

            if (replyBtn) {
                e.preventDefault();
                const commentId = replyBtn.dataset.id;
                const wrapper = e.target.closest('.post-comment-wrapper');
                const form = wrapper ? wrapper.querySelector('.reply-form') : null;
                if (form) {
                    form.style.display = form.style.display === 'none' ? 'block' : 'none';
                    if (form.style.display === 'block') {
                        const input = form.querySelector('.reply-input');
                        if (input) input.focus();
                    }
                }
            }

            if (likeBtn) {
                e.preventDefault();
                const commentId = likeBtn.dataset.id;
                if (commentId && typeof window.toggleCommentLike === 'function') {
                    window.toggleCommentLike(commentId, likeBtn);
                }
            }

            if (editBtn) {
                e.preventDefault();
                const commentId = editBtn.dataset.id;
                const commentEl = editBtn.closest('.post-comment');
                const textEl = commentEl ? commentEl.querySelector('.comment-text') : null;
                if (commentId && textEl && typeof window.editComment === 'function') {
                    window.editComment(commentId, post.id, textEl);
                }
            }

            if (delBtn) {
                e.preventDefault();
                const commentId = delBtn.dataset.id;
                const commentEl = delBtn.closest('.post-comment');
                if (commentId && commentEl && typeof window.deleteComment === 'function') {
                    window.deleteComment(commentId, post.id, commentEl, commentsCountSpan);
                }
            }
        });
    }

    return card;
}
