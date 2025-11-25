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
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #666;">No venue requests found</td></tr>';
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
        
        row.innerHTML = `
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
        renderRequestDetails(request);
    } else {
        content.innerHTML = `<div class="error">${result.error || 'Failed to load request details'}</div>`;
    }
}

// Render request details in modal
function renderRequestDetails(request) {
    const content = document.getElementById('details-content');
    
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
        
        ${request.images && request.images.length > 0 ? `
            <div class="request-detail-row">
                <div class="request-detail-label">Images:</div>
                <div class="request-detail-value">
                    <div class="request-images">
                        ${request.images.map((img, idx) => {
                            // Handle both URL strings and objectPaths
                            const imageUrl = typeof img === 'string' ? img : (img.url || img);
                            // If it's an objectPath (starts with 'images/'), construct full URL
                            const finalUrl = imageUrl && !imageUrl.startsWith('http') && imageUrl.startsWith('images/')
                                ? `${window.NetworkConfig?.API_BASE_URL?.replace('/api', '') || 'http://localhost:3000'}/${imageUrl}`
                                : imageUrl;
                            return `<img src="${finalUrl}" alt="Venue image ${idx + 1}" class="request-image" onerror="console.error('Failed to load image:', '${finalUrl}'); this.style.display='none';" loading="lazy">`;
                        }).join('')}
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--color-text-secondary);">
                        ${request.images.length} image(s)
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

