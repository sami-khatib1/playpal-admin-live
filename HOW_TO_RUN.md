# How to Run the Admin Dashboard

## Quick Start - Method 1: Direct File Opening (Simplest)

1. Navigate to the admin dashboard folder:
   ```
   my-projects/admin_dashboard
   ```

2. Open `pages/login.html` directly in your web browser:
   - Double-click `pages/login.html`
   - Or right-click → Open with → Your browser

**Note:** Some features may not work due to CORS restrictions. If you encounter issues, use Method 2 or 3.

---

## Method 2: Using Python HTTP Server (Recommended)

1. Open a terminal/command prompt

2. Navigate to the admin dashboard folder:
   ```bash
   cd my-projects/admin_dashboard
   ```

3. Start the server:
   ```bash
   # Python 3
   python -m http.server 3000
   
   # Or Python 2
   python -m SimpleHTTPServer 3000
   ```

4. Open your browser and go to:
   ```
   http://localhost:3000/pages/login.html
   ```

5. To stop the server, press `Ctrl+C` in the terminal

---

## Method 3: Using Node.js http-server

1. Install http-server globally (one-time):
   ```bash
   npm install -g http-server
   ```

2. Navigate to the admin dashboard folder:
   ```bash
   cd my-projects/admin_dashboard
   ```

3. Start the server:
   ```bash
   http-server -p 3000
   ```

4. Open your browser and go to:
   ```
   http://localhost:3000/pages/login.html
   ```

---

## Method 4: Using VS Code Live Server Extension

1. Install the "Live Server" extension in VS Code

2. Right-click on `pages/login.html`

3. Select "Open with Live Server"

4. The browser will open automatically

---

## After Opening

1. **First Time?** Click "Sign up" to create an admin account
2. **Already have an account?** Enter your email and password to login
3. Once logged in, you'll see the dashboard with options to manage venue requests

---

## Troubleshooting

### CORS Errors
If you see CORS errors, make sure:
- You're using a local server (Method 2, 3, or 4)
- The backend server is running on `http://localhost:8081`
- The API_BASE_URL in `js/auth.js` and `js/venueRequests.js` matches your backend URL

### Backend Not Connected
Make sure your backend server is running:
```bash
cd my-projects/backend
npm start
```

The backend should be running on `http://localhost:8081` (or the port configured in your backend)

---

## Default URLs

- **Login Page:** `http://localhost:3000/pages/login.html`
- **Dashboard:** `http://localhost:3000/pages/dashboard.html` (after login)
- **Venue Requests:** `http://localhost:3000/pages/venue-requests.html` (after login)

