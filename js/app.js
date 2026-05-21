// Main application entry point
// Handles routing and initial setup

// Navigation helper - uses absolute paths to avoid double pages/ issue
function navigate(path) {
    const pathMap = {
        '/login': 'login.html',
        '/signup': 'signup.html',
        '/dashboard': 'dashboard.html',
        '/venue-requests': 'venue-requests.html',
        '/default-images': 'default-images.html',
        '/announcements': 'announcements.html',
        '/help-us': 'help-us.html',
        '/activity-demands': 'activity-demands.html',
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
    
    console.log('🧭 Navigation (app.js):', { 
        path, 
        currentPath,
        targetPage: page 
    });
    
    // Check if we're already in pages/ directory
    const pagesIndex = currentPath.indexOf('/pages/');
    
    if (pagesIndex !== -1) {
        // We're in pages/ directory - replace just the filename
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

