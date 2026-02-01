// Network configuration for admin dashboard
// Matches the frontend network configuration

const NetworkConfig = {
    // Mode Configuration: 
    // "LOCAL" - localhost (for local development)
    // "NGROK" - ngrok tunnel (for testing with mobile devices or remote access)
    // "PROD" - Google Cloud Run (for production)
    MODE: "PROD", // "LOCAL" = localhost, "NGROK" = tunnel, "PROD" = remote server (Google Cloud Run)
    
    // Local development server
    LOCAL_BASE_URL: 'http://localhost:3000/api',
    
    // Ngrok tunnel URL (update this when your ngrok URL changes)
    NGROK_BASE_URL: 'https://jaqueline-unshirked-unhortatively.ngrok-free.dev/api',
    
    // Production server (Google Cloud Run)
    PROD_BASE_URL: 'https://playpal-api-902990494205.me-west1.run.app/api',
    
    // Get the current API base URL based on mode
    get API_BASE_URL() {
        switch (this.MODE) {
            case "LOCAL":
                return this.LOCAL_BASE_URL;
            case "NGROK":
                return this.NGROK_BASE_URL;
            case "PROD":
                return this.PROD_BASE_URL;
            default:
                return this.LOCAL_BASE_URL; // Default to local
        }
    },
    
    // Log current configuration (useful for debugging)
    logConfig() {
        console.log('🌐 Admin Dashboard Network Config:');
        console.log(`   Mode: ${this.MODE}`);
        console.log(`   API URL: ${this.API_BASE_URL}`);
    }
};

// Log configuration on load (check browser console)
NetworkConfig.logConfig();

// [LOG] Page context - this is what the browser sends as Origin in PROD debugging
console.log('📄 [LOG] Page context (Origin sent by browser):', {
    origin: window.location.origin || '(empty)',
    href: window.location.href,
    protocol: window.location.protocol,
    isFileProtocol: window.location.protocol === 'file:',
});

// Make it available globally
window.NetworkConfig = NetworkConfig;

