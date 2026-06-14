// Default images management functions

function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || 'http://localhost:3000/api';
}

// Fetch all default images
async function fetchDefaultImages() {
    try {
        const token = getAuthToken();
        if (!token) {
            console.error('❌ No auth token found');
            return { success: false, error: 'Not authenticated. Please login again.' };
        }
        
        const API_BASE_URL = getApiBaseUrl();
        const url = `${API_BASE_URL}/admin/default-images`;
        
        console.log('📸 [Default Images] Fetching from:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        console.log('📸 [Default Images] Response status:', response.status);
        
        // Handle 404 specifically
        if (response.status === 404) {
            console.error('❌ Route not found. Make sure the backend server has been restarted after adding the new routes.');
            return { 
                success: false, 
                error: 'Route not found. Please restart the backend server to load the new default images routes.' 
            };
        }

        const data = await response.json();

        if (response.ok && data.success) {
            return { success: true, data: data.images || [] };
        } else {
            console.error('❌ Error response:', data);
            return { success: false, error: data.message || data.error || 'Failed to fetch default images' };
        }
    } catch (error) {
        console.error('❌ Fetch default images error:', error);
        return { success: false, error: `Network error: ${error.message}` };
    }
}

// Upload default image
async function uploadDefaultImage(imageId, file) {
    try {
        const token = getAuthToken();
        const API_BASE_URL = getApiBaseUrl();
        const url = `${API_BASE_URL}/admin/default-images/upload`;
        
        const formData = new FormData();
        formData.append('image', file);
        formData.append('imageId', imageId);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            body: formData,
        });

        const data = await response.json();

        if (response.ok && data.success) {
            return { success: true, data: data.image };
        } else {
            console.error('❌ Error response:', data);
            return { success: false, error: data.message || data.error || 'Failed to upload default image' };
        }
    } catch (error) {
        console.error('❌ Upload default image error:', error);
        return { success: false, error: `Network error: ${error.message}` };
    }
}

// Delete default image
async function deleteDefaultImage(imageId) {
    try {
        const token = getAuthToken();
        const API_BASE_URL = getApiBaseUrl();
        const url = `${API_BASE_URL}/admin/default-images/${imageId}`;
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (response.ok && data.success) {
            return { success: true };
        } else {
            console.error('❌ Error response:', data);
            return { success: false, error: data.message || data.error || 'Failed to delete default image' };
        }
    } catch (error) {
        console.error('❌ Delete default image error:', error);
        return { success: false, error: `Network error: ${error.message}` };
    }
}

// Load and display default images
async function loadDefaultImages() {
    const loadingMessage = document.getElementById('loading-message');
    const imagesGrid = document.getElementById('images-grid');
    const errorMessage = document.getElementById('error-message');
    
    try {
        const result = await fetchDefaultImages();
        
        if (!result.success) {
            loadingMessage.style.display = 'none';
            errorMessage.textContent = result.error;
            errorMessage.style.display = 'block';
            return;
        }
        
        const images = result.data;
        loadingMessage.style.display = 'none';
        imagesGrid.style.display = 'grid';
        errorMessage.style.display = 'none';
        
        imagesGrid.innerHTML = '';
        
        images.forEach(image => {
            const card = createImageCard(image);
            imagesGrid.appendChild(card);
        });
    } catch (error) {
        loadingMessage.style.display = 'none';
        errorMessage.textContent = `Error: ${error.message}`;
        errorMessage.style.display = 'block';
    }
}

// Create image card element
function createImageCard(image) {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.id = `card-${image.id}`;
    
    const statusClass = image.exists ? 'status-exists' : 'status-missing';
    const statusText = image.exists ? '✓ Uploaded' : '✗ Missing';
    
    card.innerHTML = `
        <h3>${getImageDisplayName(image)}</h3>
        <div class="description">${image.description || ''}</div>
        <div class="image-status ${statusClass}">${statusText}</div>
        ${image.url ? `<img src="${image.url}" alt="${image.description}" class="image-preview" onerror="this.style.display='none'">` : '<div class="image-preview" style="display: flex; align-items: center; justify-content: center; color: var(--color-text-secondary);">No preview available</div>'}
        <div class="upload-section">
            <div class="file-input-wrapper">
                <input type="file" id="file-${image.id}" accept="image/jpeg,image/jpg,image/png,image/webp" onchange="handleFileSelect('${image.id}', this)">
            </div>
            <button class="upload-btn" id="upload-btn-${image.id}" onclick="handleUpload('${image.id}')" disabled>Upload Image</button>
            ${image.exists ? `<button class="delete-btn" onclick="handleDelete('${image.id}')">Delete Image</button>` : ''}
            <div id="message-${image.id}"></div>
        </div>
    `;
    
    return card;
}

function sportLabel(slug) {
    return window.AdminSportLabels?.sportSlugToDisplayLabel(slug) || slug;
}

// Get display name for image
function getImageDisplayName(image) {
    if (image.id === 'users-default') {
        return 'User Profile Default';
    } else if (image.id === 'posts-default') {
        return 'Post Default';
    } else if (image.id.startsWith('venues-')) {
        const sportType = image.id.replace('venues-', '');
        if (sportType === 'default') {
            return 'Venue Default (Generic)';
        }
        return `Venue Default (${sportLabel(sportType)})`;
    } else if (image.id.startsWith('communities-')) {
        const sportType = image.id.replace('communities-', '');
        if (sportType === 'default') {
            return 'Community Default (Generic)';
        }
        return `Community Default (${sportLabel(sportType)})`;
    }
    return image.id;
}

// Handle file selection
function handleFileSelect(imageId, input) {
    const uploadBtn = document.getElementById(`upload-btn-${imageId}`);
    if (input.files && input.files.length > 0) {
        uploadBtn.disabled = false;
    } else {
        uploadBtn.disabled = true;
    }
}

// Handle upload
async function handleUpload(imageId) {
    const fileInput = document.getElementById(`file-${imageId}`);
    const uploadBtn = document.getElementById(`upload-btn-${imageId}`);
    const messageDiv = document.getElementById(`message-${imageId}`);
    const card = document.getElementById(`card-${imageId}`);
    
    if (!fileInput.files || fileInput.files.length === 0) {
        messageDiv.innerHTML = '<div class="error-message">Please select an image file</div>';
        return;
    }
    
    const file = fileInput.files[0];
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        messageDiv.innerHTML = '<div class="error-message">Invalid file type. Please select a JPEG, PNG, or WebP image.</div>';
        return;
    }
    
    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        messageDiv.innerHTML = '<div class="error-message">File too large. Maximum size is 10MB.</div>';
        return;
    }
    
    // Disable button and show loading
    uploadBtn.disabled = true;
    card.classList.add('loading');
    messageDiv.innerHTML = '<div style="color: var(--color-text-secondary);">Uploading and compressing image...</div>';
    
    try {
        const result = await uploadDefaultImage(imageId, file);
        
        if (result.success) {
            messageDiv.innerHTML = '<div class="success-message">Image uploaded successfully!</div>';
            // Reload images after a short delay
            setTimeout(() => {
                loadDefaultImages();
            }, 1500);
        } else {
            messageDiv.innerHTML = `<div class="error-message">${result.error}</div>`;
            uploadBtn.disabled = false;
            card.classList.remove('loading');
        }
    } catch (error) {
        messageDiv.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
        uploadBtn.disabled = false;
        card.classList.remove('loading');
    }
}

// Handle delete
async function handleDelete(imageId) {
    if (!confirm('Are you sure you want to delete this default image? This may cause issues if the app tries to use it.')) {
        return;
    }
    
    const card = document.getElementById(`card-${imageId}`);
    const messageDiv = document.getElementById(`message-${imageId}`);
    
    card.classList.add('loading');
    messageDiv.innerHTML = '<div style="color: var(--color-text-secondary);">Deleting image...</div>';
    
    try {
        const result = await deleteDefaultImage(imageId);
        
        if (result.success) {
            messageDiv.innerHTML = '<div class="success-message">Image deleted successfully!</div>';
            // Reload images after a short delay
            setTimeout(() => {
                loadDefaultImages();
            }, 1500);
        } else {
            messageDiv.innerHTML = `<div class="error-message">${result.error}</div>`;
            card.classList.remove('loading');
        }
    } catch (error) {
        messageDiv.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
        card.classList.remove('loading');
    }
}

// Make functions available globally
window.loadDefaultImages = loadDefaultImages;
window.handleFileSelect = handleFileSelect;
window.handleUpload = handleUpload;
window.handleDelete = handleDelete;

