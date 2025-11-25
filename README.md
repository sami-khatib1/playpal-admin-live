# Admin Dashboard

Web dashboard for PlayPal app administrators.

## Features

- Admin authentication (sign in/sign up)
- Venue requests management
  - View all venue requests
  - Approve/reject requests
  - View request details

## Tech Stack

- Vanilla JavaScript
- CSS
- HTML
- Connects to backend API at `my-projects/backend`

## Setup

1. Open `pages/login.html` in a web browser
2. Or serve using a local web server:
   ```bash
   # Using Python
   python -m http.server 3000
   
   # Using Node.js http-server
   npx http-server -p 3000
   ```
3. Access at `http://localhost:3000/pages/login.html`

## Backend API Endpoints Required

The dashboard expects these admin endpoints in the backend:

### Authentication
- `POST /api/admin/auth/login` - Admin login
- `POST /api/admin/auth/signup` - Admin signup

### Venue Requests
- `GET /api/admin/venue-requests` - Get all venue requests
- `GET /api/admin/venue-requests/:id` - Get single venue request
- `PUT /api/admin/venue-requests/:id/approve` - Approve request
- `PUT /api/admin/venue-requests/:id/reject` - Reject request (with reason in body)

## Configuration

Update `API_BASE_URL` in:
- `js/auth.js`
- `js/venueRequests.js`

Default: `http://localhost:8081/api`

