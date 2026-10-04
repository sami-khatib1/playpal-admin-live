// Network configuration for admin dashboard
// Matches the frontend network configuration

const NetworkConfig = {
  // Mode Configuration:
  // "LOCAL" - localhost (for local development)
  // "NGROK" - ngrok tunnel (for testing with mobile devices or remote access)
  // "PROD" - Google Cloud Run (for production)
  MODE: "PROD", // LOCAL for local backend testing. "NGROK" / "PROD" for remote.

  // Local development server
  LOCAL_BASE_URL: "http://localhost:3000/api",

  // Ngrok tunnel URL (update this when your ngrok URL changes)
  NGROK_BASE_URL: "https://nydia-nondistorted-contrariously.ngrok-free.dev/api",

  // Production server (Google Cloud Run)
  PROD_BASE_URL: "https://playpal-api-902990494205.me-west1.run.app/api",

  // LOCAL, NGROK, and the Staging DB switch call this machine.
  // The local backend in development uses the staging database (playpal_staging).
  // PROD + DB "Prod" still calls Cloud Run.
  get API_BASE_URL() {
    const mode = this.MODE;
    const stagingSelected =
      typeof window !== "undefined" &&
      window.DbTarget &&
      typeof window.DbTarget.isStaging === "function" &&
      window.DbTarget.isStaging();
    if (mode === "LOCAL" || mode === "NGROK" || stagingSelected) {
      return this.LOCAL_BASE_URL;
    }
    if (mode === "PROD") return this.PROD_BASE_URL;
    return this.LOCAL_BASE_URL;
  },

  // Log current configuration (useful for debugging)
  logConfig() {
    console.log("🌐 Admin Dashboard Network Config:");
    console.log(`   Mode: ${this.MODE}`);
    console.log(`   API URL: ${this.API_BASE_URL}`);
  },
};

// Log configuration on load (check browser console)
NetworkConfig.logConfig();

// [LOG] Page context - this is what the browser sends as Origin in PROD debugging
console.log("📄 [LOG] Page context (Origin sent by browser):", {
  origin: window.location.origin || "(empty)",
  href: window.location.href,
  protocol: window.location.protocol,
  isFileProtocol: window.location.protocol === "file:",
});

// Make it available globally
window.NetworkConfig = NetworkConfig;
