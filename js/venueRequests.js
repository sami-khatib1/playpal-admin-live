// Venue requests management functions

// API_BASE_URL is set in config.js based on MODE (DEV or PROD)
// Use getter to avoid duplicate declaration (auth.js also declares it)
function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || 'http://localhost:3000/api';
}

// Fetch all venue requests (admin endpoint)
async function fetchVenueRequests() {
    try {
        const token = getAuthToken();
        const API_BASE_URL = getApiBaseUrl();
        const url = `${API_BASE_URL}/admin/venue-requests`;
        
   
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });



        const data = await response.json();

        if (response.ok && data.success) {
            const requests = data.data || data.requests || [];
            return { success: true, data: requests };
        } else {
            console.error('❌ Error response:', data);
            return { success: false, error: data.message || data.error || 'Failed to fetch venue requests' };
        }
    } catch (error) {
        console.error('❌ Fetch venue requests error:', error);
        console.error('   Error type:', error.name);
        console.error('   Error message:', error.message);
        const API_BASE_URL = getApiBaseUrl();
        return { success: false, error: `Network error: ${error.message}. Please check if the backend is running on ${API_BASE_URL}` };
    }
}

// Approve venue request
async function approveVenueRequest(requestId) {
    try {
        const token = getAuthToken();
        const API_BASE_URL = getApiBaseUrl();
        const response = await fetch(`${API_BASE_URL}/admin/venue-requests/${requestId}/approve`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (response.ok && data.success) {
            return { success: true, message: 'Venue request approved successfully' };
        } else {
            return { success: false, error: data.message || data.error || 'Failed to approve venue request' };
        }
    } catch (error) {
        console.error('Approve venue request error:', error);
        return { success: false, error: 'Network error. Please try again.' };
    }
}

// Reject venue request
async function rejectVenueRequest(requestId, reason) {
    try {
        const token = getAuthToken();
        const API_BASE_URL = getApiBaseUrl();
        const response = await fetch(`${API_BASE_URL}/admin/venue-requests/${requestId}/reject`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                rejectionReason: reason 
            }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            return { success: true, message: 'Venue request rejected successfully' };
        } else {
            return { success: false, error: data.message || data.error || 'Failed to reject venue request' };
        }
    } catch (error) {
        console.error('Reject venue request error:', error);
        return { success: false, error: 'Network error. Please try again.' };
    }
}

// Get single venue request
async function getVenueRequest(requestId) {
    try {
        const token = getAuthToken();
        const API_BASE_URL = getApiBaseUrl();
        const response = await fetch(`${API_BASE_URL}/admin/venue-requests/${requestId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (response.ok && data.success) {
            return { success: true, data: data.data };
        } else {
            return { success: false, error: data.message || data.error || 'Failed to fetch venue request' };
        }
    } catch (error) {
        console.error('Get venue request error:', error);
        return { success: false, error: 'Network error. Please try again.' };
    }
}

