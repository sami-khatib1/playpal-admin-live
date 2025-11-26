// UI functions for venue requests page

let allRequests = [];

// Load and display venue requests
async function loadVenueRequests() {
    console.log('🚀 [Venue Requests UI] loadVenueRequests called');
    console.log('   fetchVenueRequests available:', typeof fetchVenueRequests);
    console.log('   getAuthToken available:', typeof getAuthToken);
    
    const loadingDiv = document.getElementById('loading');
    const container = document.getElementById('requests-container');
    const tableBody = document.getElementById('requests-table-body');
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');
    
    // Show loading
    loadingDiv.style.display = 'block';
    container.style.display = 'none';
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    console.log('🚀 [Venue Requests UI] Calling fetchVenueRequests...');
    const result = await fetchVenueRequests();
    console.log('🚀 [Venue Requests UI] fetchVenueRequests result:', result);
    
    if (result.success) {
        allRequests = result.data;
        renderRequestsTable(allRequests);
        loadingDiv.style.display = 'none';
        container.style.display = 'block';
    } else {
        loadingDiv.style.display = 'none';
        errorDiv.textContent = result.error || 'Failed to load venue requests';
        errorDiv.style.display = 'block';
    }
}

// Render requests in table
function renderRequestsTable(requests) {
    const tableBody = document.getElementById('requests-table-body');
    tableBody.innerHTML = '';
    
    if (requests.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #666;">No venue requests found</td></tr>';
        return;
    }
    
    requests.forEach(request => {
        const row = document.createElement('tr');
        
        const statusClass = request.status === 'approved' ? 'badge-approved' : 
                           request.status === 'rejected' ? 'badge-rejected' : 
                           'badge-pending';
        
        const locationText = request.location ? 
            `${request.location.address || ''}, ${request.location.city || ''}`.trim() : 
            'N/A';
        
        const sportsText = request.sports && request.sports.length > 0 ?
            request.sports.map(s => s.sport || s).join(', ') : 
            'None';
        
        const submittedDate = request.createdAt ? 
            new Date(request.createdAt).toLocaleDateString() : 
            'N/A';
        
        const requestType = request.requestType || 'create';
        const typeBadgeClass = requestType === 'update' ? 'badge-update' : 'badge-create';
        const typeText = requestType === 'update' ? 'Update' : 'Create';
        
        row.innerHTML = `
            <td><span class="badge ${typeBadgeClass}">${typeText}</span></td>
            <td>${request.name || 'N/A'}</td>
            <td>${locationText}</td>
            <td>${sportsText}</td>
            <td>${submittedDate}</td>
            <td><span class="badge ${statusClass}">${request.status || 'pending'}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick="viewRequestDetails('${request.id}')">View</button>
                    ${request.status === 'pending' ? `
                        <button class="btn btn-success btn-sm" onclick="approveRequest('${request.id}')">Approve</button>
                        <button class="btn btn-danger btn-sm" onclick="openRejectModal('${request.id}')">Reject</button>
                    ` : ''}
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// View request details
async function viewRequestDetails(requestId) {
    const modal = document.getElementById('details-modal');
    const content = document.getElementById('details-content');
    
    content.innerHTML = '<div class="loading">Loading details...</div>';
    modal.style.display = 'flex';
    
    const result = await getVenueRequest(requestId);
    
    if (result.success) {
        const request = result.data;
        await renderRequestDetails(request);
    } else {
        content.innerHTML = `<div class="error">${result.error || 'Failed to load request details'}</div>`;
    }
}

// Helper function to get signed URL for an objectPath
async function getSignedImageUrl(objectPath) {
    try {
        const apiBaseUrl = window.NetworkConfig?.API_BASE_URL || 'http://localhost:3000/api';
        const response = await fetch(`${apiBaseUrl}/images/user-signed?objectPath=${encodeURIComponent(objectPath)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.url || data.signedUrl || null;
        }
    } catch (error) {
        console.error('Failed to get signed URL:', error);
    }
    return null;
}

// Render request details in modal
async function renderRequestDetails(request) {
    const content = document.getElementById('details-content');
    
    console.log('🖼️ [Venue Requests UI] Rendering request details:', {
        id: request.id,
        name: request.name,
        imagesCount: request.images?.length || 0,
        images: request.images
    });
    
    // Process images - convert objectPaths to signed URLs if needed
    let processedImages = [];
    if (request.images && request.images.length > 0) {
        processedImages = await Promise.all(
            request.images.map(async (img) => {
                let imageUrl = typeof img === 'string' ? img : (img.url || img);
                
                // If it's not a full URL, it's likely an objectPath - fetch signed URL
                if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('//')) {
                    if (imageUrl.startsWith('images/')) {
                        const signedUrl = await getSignedImageUrl(imageUrl);
                        if (signedUrl) {
                            console.log(`✅ Got signed URL for ${imageUrl}:`, signedUrl);
                            return signedUrl;
                        }
                    }
                    // Fallback: construct URL (won't work for GCS, but might work for local)
                    const baseUrl = window.NetworkConfig?.API_BASE_URL?.replace('/api', '') || 'http://localhost:3000';
                    imageUrl = `${baseUrl}/${imageUrl.startsWith('images/') ? imageUrl : `images/venues/${imageUrl}`}`;
                }
                
                return imageUrl;
            })
        );
    } else {
        processedImages = [];
    }
    
    console.log('🖼️ [Venue Requests UI] Processed images:', processedImages);
    
    const location = request.location || {};
    const contactInfo = request.contactInfo || {};
    const schedule = request.schedule || {};
    
    const statusClass = request.status === 'approved' ? 'badge-approved' : 
                       request.status === 'rejected' ? 'badge-rejected' : 
                       'badge-pending';
    
    content.innerHTML = `
        <div class="request-detail-row">
            <div class="request-detail-label">Name:</div>
            <div class="request-detail-value">${request.name || 'N/A'}</div>
        </div>
        
        <div class="request-detail-row">
            <div class="request-detail-label">Description:</div>
            <div class="request-detail-value">${request.description || 'No description provided'}</div>
        </div>
        
        <div class="request-detail-row">
            <div class="request-detail-label">Type:</div>
            <div class="request-detail-value">
                <span class="badge ${request.requestType === 'update' ? 'badge-update' : 'badge-create'}">
                    ${request.requestType === 'update' ? 'Update Request' : 'Create Request'}
                </span>
                ${request.requestType === 'update' && request.venueId ? `<br><small style="color: #666;">Venue ID: ${request.venueId}</small>` : ''}
            </div>
        </div>
        
        <div class="request-detail-row">
            <div class="request-detail-label">Status:</div>
            <div class="request-detail-value"><span class="badge ${statusClass}">${request.status || 'pending'}</span></div>
        </div>
        
        <div class="request-detail-row">
            <div class="request-detail-label">Location:</div>
            <div class="request-detail-value">
                ${location.address || ''}<br>
                ${location.city || ''}, ${location.country || ''}<br>
                Coordinates: ${location.lat || 'N/A'}, ${location.lng || 'N/A'}
            </div>
        </div>
        
        <div class="request-detail-row">
            <div class="request-detail-label">Sports:</div>
            <div class="request-detail-value">
                ${request.sports && request.sports.length > 0 ? 
                    request.sports.map(s => `<span class="badge badge-pending">${s.sport || s}</span>`).join(' ') : 
                    'None'}
            </div>
        </div>
        
        <div class="request-detail-row">
            <div class="request-detail-label">Contact Info:</div>
            <div class="request-detail-value">
                ${contactInfo.phone ? `Phone: ${contactInfo.phone}<br>` : ''}
                ${contactInfo.email ? `Email: ${contactInfo.email}<br>` : ''}
                ${contactInfo.website ? `Website: ${contactInfo.website}<br>` : ''}
                ${contactInfo.whatsapp ? `WhatsApp: ${contactInfo.whatsapp}` : ''}
                ${!contactInfo.phone && !contactInfo.email && !contactInfo.website && !contactInfo.whatsapp ? 'No contact info provided' : ''}
            </div>
        </div>
        
        <div class="request-detail-row">
            <div class="request-detail-label">Amenities:</div>
            <div class="request-detail-value">
                ${request.amenities && request.amenities.length > 0 ? 
                    request.amenities.join(', ') : 
                    'None'}
            </div>
        </div>
        
        <div class="request-detail-row">
            <div class="request-detail-label">Tags:</div>
            <div class="request-detail-value">
                ${request.tags && request.tags.length > 0 ? 
                    request.tags.map(t => `<span class="badge badge-pending">${t}</span>`).join(' ') : 
                    'None'}
            </div>
        </div>
        
        ${processedImages && processedImages.length > 0 ? `
            <div class="request-detail-row">
                <div class="request-detail-label">Images:</div>
                <div class="request-detail-value">
                    <div class="request-images">
                        ${processedImages.map((imageUrl, idx) => {
                            // Escape the URL for use in HTML attributes
                            const escapedUrl = String(imageUrl)
                                .replace(/\\/g, '\\\\')
                                .replace(/'/g, "&#39;")
                                .replace(/"/g, "&quot;")
                                .replace(/\n/g, '')
                                .replace(/\r/g, '');
                            
                            return `<img 
                                src="${escapedUrl}" 
                                alt="Venue image ${idx + 1}" 
                                class="request-image" 
                                onclick="if(typeof openImageLightbox === 'function') { openImageLightbox('${escapedUrl}', ${idx}, ${processedImages.length}); } else { console.error('openImageLightbox not defined'); window.open('${escapedUrl}', '_blank'); }"
                                onerror="console.error('Failed to load image:', '${escapedUrl}'); this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'150\\' height=\\'150\\'%3E%3Crect fill=\\'%23ccc\\' width=\\'150\\' height=\\'150\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\' fill=\\'%23999\\' font-family=\\'sans-serif\\' font-size=\\'14\\'%3EImage not found%3C/text%3E%3C/svg%3E';"
                                onload="console.log('✅ Image loaded:', '${escapedUrl}')"
                                loading="lazy"
                                title="Click to view full size"
                                style="cursor: pointer;"
                            >`;
                        }).join('')}
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--color-text-secondary);">
                        ${processedImages.length} image(s) - Click to view full size
                    </div>
                </div>
            </div>
        ` : '<div class="request-detail-row"><div class="request-detail-label">Images:</div><div class="request-detail-value">No images provided</div></div>'}
        
        ${request.rejectionReason ? `
            <div class="request-detail-row">
                <div class="request-detail-label">Rejection Reason:</div>
                <div class="request-detail-value" style="color: #dc3545;">${request.rejectionReason}</div>
            </div>
        ` : ''}
        
        <div class="request-detail-row">
            <div class="request-detail-label">Submitted:</div>
            <div class="request-detail-value">${request.createdAt ? new Date(request.createdAt).toLocaleString() : 'N/A'}</div>
        </div>
        
        ${request.status === 'pending' ? `
            <div class="modal-footer" style="border-top: 1px solid #e0e0e0; margin-top: 1rem; padding-top: 1rem;">
                <button class="btn btn-success" onclick="approveRequest('${request.id}'); closeDetailsModal();">Approve</button>
                <button class="btn btn-danger" onclick="closeDetailsModal(); openRejectModal('${request.id}');">Reject</button>
            </div>
        ` : ''}
    `;
}

// Close details modal
function closeDetailsModal() {
    document.getElementById('details-modal').style.display = 'none';
}

// Open reject modal
function openRejectModal(requestId) {
    currentRejectId = requestId;
    document.getElementById('reject-modal').style.display = 'flex';
    document.getElementById('rejection-reason').value = '';
}

// Close reject modal
function closeRejectModal() {
    document.getElementById('reject-modal').style.display = 'none';
    currentRejectId = null;
}

// Confirm reject
async function confirmReject() {
    if (!currentRejectId) return;
    
    const reason = document.getElementById('rejection-reason').value.trim();
    if (!reason) {
        alert('Please provide a rejection reason');
        return;
    }
    
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');
    
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const result = await rejectVenueRequest(currentRejectId, reason);
    
    if (result.success) {
        successDiv.textContent = result.message || 'Venue request rejected successfully';
        successDiv.style.display = 'block';
        closeRejectModal();
        loadVenueRequests(); // Refresh list
    } else {
        errorDiv.textContent = result.error || 'Failed to reject venue request';
        errorDiv.style.display = 'block';
    }
}

// Approve request
async function approveRequest(requestId) {
    if (!confirm('Are you sure you want to approve this venue request?')) {
        return;
    }
    
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');
    
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const result = await approveVenueRequest(requestId);
    
    if (result.success) {
        successDiv.textContent = result.message || 'Venue request approved successfully';
        successDiv.style.display = 'block';
        loadVenueRequests(); // Refresh list
    } else {
        errorDiv.textContent = result.error || 'Failed to approve venue request';
        errorDiv.style.display = 'block';
    }
}

// Image Lightbox functionality
let currentImageIndex = 0;
let currentImageList = [];

function openImageLightbox(imageUrl, index, totalImages) {
    // Get all images from the current request details
    const requestImages = [];
    const imageElements = document.querySelectorAll('.request-image');
    imageElements.forEach(img => {
        if (img.src && !img.src.includes('data:')) {
            requestImages.push(img.src);
        }
    });
    
    if (requestImages.length === 0) {
        // Fallback: use the clicked image only
        requestImages.push(imageUrl);
        currentImageIndex = 0;
    } else {
        // Find the index of the clicked image
        currentImageIndex = requestImages.findIndex(url => url === imageUrl || url.includes(imageUrl.split('/').pop()));
        if (currentImageIndex === -1) currentImageIndex = 0;
    }
    
    currentImageList = requestImages;
    updateLightboxImage();
    
    const lightbox = document.getElementById('image-lightbox');
    lightbox.style.display = 'flex';
    
    // Show/hide navigation buttons
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');
    const counter = document.getElementById('lightbox-counter');
    
    if (currentImageList.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
        counter.textContent = `${currentImageIndex + 1} / ${currentImageList.length}`;
        counter.style.display = 'block';
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        counter.style.display = 'none';
    }
    
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';
}

function closeImageLightbox() {
    document.getElementById('image-lightbox').style.display = 'none';
    document.body.style.overflow = '';
    currentImageList = [];
    currentImageIndex = 0;
}

function navigateLightbox(direction) {
    if (currentImageList.length === 0) return;
    
    currentImageIndex += direction;
    
    if (currentImageIndex < 0) {
        currentImageIndex = currentImageList.length - 1;
    } else if (currentImageIndex >= currentImageList.length) {
        currentImageIndex = 0;
    }
    
    updateLightboxImage();
    
    // Update counter
    const counter = document.getElementById('lightbox-counter');
    counter.textContent = `${currentImageIndex + 1} / ${currentImageList.length}`;
}

function updateLightboxImage() {
    if (currentImageList.length === 0) return;
    
    const lightboxImage = document.getElementById('lightbox-image');
    lightboxImage.src = currentImageList[currentImageIndex];
}

// Keyboard navigation for lightbox
document.addEventListener('keydown', function(e) {
    const lightbox = document.getElementById('image-lightbox');
    if (lightbox.style.display === 'flex' || lightbox.style.display === '') {
        if (e.key === 'Escape') {
            closeImageLightbox();
        } else if (e.key === 'ArrowLeft') {
            navigateLightbox(-1);
        } else if (e.key === 'ArrowRight') {
            navigateLightbox(1);
        }
    }
});

