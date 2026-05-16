// Authentication functions for admin dashboard

// API_BASE_URL is set in config.js based on MODE (DEV or PROD)
const API_BASE_URL = window.NetworkConfig?.API_BASE_URL || 'http://localhost:3000/api';

// Log the API URL being used (for debugging)
console.log('🔗 Admin Dashboard API URL:', API_BASE_URL);
console.log('🔗 NetworkConfig available:', !!window.NetworkConfig);
if (window.NetworkConfig) {
    console.log('🔗 NetworkConfig.MODE:', window.NetworkConfig.MODE);
}

// Navigation helper - uses simple relative path replacement
function navigate(path) {
    const pathMap = {
        '/login': 'login.html',
        '/signup': 'signup.html',
        '/dashboard': 'dashboard.html',
        '/venue-requests': 'venue-requests.html',
        '/default-images': 'default-images.html',
        '/announcements': 'announcements.html',
        '/help-us': 'help-us.html',
        '/analytics': 'analytics.html',
        '/users': 'users.html',
        '/user-activation': 'user-activation.html',
        '/push-notifications': 'push-notifications.html',
        '/availability': 'availability.html',
        '/join-requests': 'join-requests.html',
        '/community-social-spotlight': 'community-social-spotlight.html',
    };
    
    // Get the target page filename
    const page = pathMap[path] || pathMap['/login'];
    
    // Get current pathname
    const currentPath = window.location.pathname;
    
    console.log('🧭 Navigation:', { 
        path, 
        currentPath,
        targetPage: page 
    });
    
    // Check if we're already in pages/ directory
    const pagesIndex = currentPath.indexOf('/pages/');
    
    if (pagesIndex !== -1) {
        // We're in pages/ directory - replace just the filename
        // Get everything up to and including /pages/, then add the new filename
        const basePath = currentPath.substring(0, pagesIndex + '/pages/'.length);
        const newPath = basePath + page;
        const newUrl = window.location.origin + newPath;
        console.log('🧭 Navigating to (in pages/):', newUrl);
        window.location.href = newUrl;
    } else if (currentPath.endsWith('.html')) {
        // We have an .html file but not in /pages/ - replace filename in same directory
        const lastSlash = currentPath.lastIndexOf('/');
        const directory = currentPath.substring(0, lastSlash + 1);
        const newPath = directory + page;
        const newUrl = window.location.origin + newPath;
        console.log('🧭 Navigating to (replace filename):', newUrl);
        window.location.href = newUrl;
    } else {
        // We're at root or a directory - navigate to pages/
        const basePath = currentPath.endsWith('/') ? currentPath : currentPath + '/';
        const newPath = basePath + 'pages/' + page;
        const newUrl = window.location.origin + newPath;
        console.log('🧭 Navigating to (from root):', newUrl);
        window.location.href = newUrl;
    }
}

// Make navigate available globally
window.navigate = navigate;

// Login function
async function login(email, password) {
    // [LOG] Before request - context for PROD debugging
    const loginUrl = `${API_BASE_URL}/admin/auth/login`;
    console.log('🔐 [LOG] Login REQUEST start:', {
        mode: window.NetworkConfig?.MODE,
        API_BASE_URL,
        loginUrl,
        pageOrigin: window.location.origin || '(empty)',
        protocol: window.location.protocol,
        isFile: window.location.protocol === 'file:',
    });

    try {
        const response = await fetch(loginUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        // [LOG] Response received - status and CORS headers
        const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
        const corsCredentials = response.headers.get('Access-Control-Allow-Credentials');
        const allHeaders = {};
        response.headers.forEach((v, k) => { allHeaders[k] = v; });
        console.log('📡 [LOG] Login RESPONSE received:', {
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            type: response.type,
            ok: response.ok,
            'Access-Control-Allow-Origin': corsOrigin,
            'Access-Control-Allow-Credentials': corsCredentials,
            allHeaders,
        });

        // Check if response is ok before trying to parse JSON
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ [LOG] Response not OK, body:', errorText);
            try {
                const errorData = JSON.parse(errorText);
                return { success: false, error: errorData.message || errorData.error || 'Login failed' };
            } catch {
                return { success: false, error: `Server error: ${response.status} ${response.statusText}` };
            }
        }

        const data = await response.json();
        console.log('✅ [LOG] Login response data:', data);

        if (data.success) {
            // Store token
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminUser', JSON.stringify(data.user || { email, name: email }));
            
            return { success: true };
        } else {
            return { success: false, error: data.message || data.error || 'Login failed' };
        }
    } catch (error) {
        // [LOG] Request failed (network/CORS) - full error for PROD debugging
        console.error('❌ [LOG] Login FAILED (catch):', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            API_BASE_URL,
            mode: window.NetworkConfig?.MODE,
            pageOrigin: window.location.origin || '(empty)',
            protocol: window.location.protocol,
        });
        const isCorsOrNetwork = (error.message || '').toLowerCase().includes('fetch') || (error.name || '') === 'TypeError';
        const hint = window.NetworkConfig?.MODE === 'PROD' && isCorsOrNetwork
            ? ' Backend is reachable; this is usually CORS. Redeploy the backend with CORS allowing origin "null" (see backend server.js).'
            : ' Ensure the backend is running and CORS allows this origin.';
        return { success: false, error: `Network error: ${error.message}.${hint}` };
    }
}

// Signup function
async function signup(email, password, name) {
    try {
        const url = `${API_BASE_URL}/admin/auth/signup`;
        console.log('🔐 Attempting signup to:', url);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password, name }),
        });

        console.log('📡 Response status:', response.status);
        
        // Check if response is ok before trying to parse JSON
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Response error:', errorText);
            try {
                const errorData = JSON.parse(errorText);
                return { success: false, error: errorData.message || errorData.error || 'Signup failed' };
            } catch {
                return { success: false, error: `Server error: ${response.status} ${response.statusText}` };
            }
        }

        const data = await response.json();
        console.log('✅ Signup response:', data);

        if (data.success) {
            // Store token
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminUser', JSON.stringify(data.user || { email, name }));
            
            return { success: true };
        } else {
            return { success: false, error: data.message || data.error || 'Signup failed' };
        }
    } catch (error) {
        console.error('❌ Signup error:', error);
        console.error('   Error type:', error.name);
        console.error('   Error message:', error.message);
        console.error('   API_BASE_URL:', API_BASE_URL);
        const isCorsOrNetwork = (error.message || '').toLowerCase().includes('fetch') || (error.name || '') === 'TypeError';
        const hint = window.NetworkConfig?.MODE === 'PROD' && isCorsOrNetwork
            ? ' Backend is reachable; this is usually CORS. Redeploy the backend with CORS allowing origin "null" (see backend server.js).'
            : ' Ensure the backend is running and CORS allows this origin.';
        return { success: false, error: `Network error: ${error.message}.${hint}` };
    }
}

// Logout function
function logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/login');
}

// Make logout available globally
window.logout = logout;

// Get current admin user
function getCurrentAdmin() {
    const userStr = localStorage.getItem('adminUser');
    return userStr ? JSON.parse(userStr) : null;
}

// Check if user is authenticated
function isAuthenticated() {
    return !!localStorage.getItem('adminToken');
}

// Get auth token
function getAuthToken() {
    return localStorage.getItem('adminToken');
}

