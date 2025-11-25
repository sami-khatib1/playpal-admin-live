# Admin Dashboard Setup Guide

## Backend Setup

### 1. Create Admin Table

Run the migration script to create the admins table:

```bash
cd my-projects/backend
node src/scripts/createAdminsTable.js
```

### 2. Generate Prisma Client

After adding the Admin model to schema.prisma:

```bash
cd my-projects/backend
npx prisma generate
```

### 3. Backend Endpoints

The following admin endpoints are now available:

**Authentication:**
- `POST /api/admin/auth/login` - Admin login
- `POST /api/admin/auth/signup` - Admin signup

**Venue Requests:**
- `GET /api/admin/venue-requests` - Get all venue requests (with pagination)
- `GET /api/admin/venue-requests/:id` - Get single venue request
- `PUT /api/admin/venue-requests/:id/approve` - Approve venue request
- `PUT /api/admin/venue-requests/:id/reject` - Reject venue request (requires rejectionReason in body)

## Frontend Setup

### 1. Serve the Dashboard

Open `pages/login.html` in a browser, or use a local server:

```bash
cd my-projects/admin_dashboard
python -m http.server 3000
```

Then access: `http://localhost:3000/pages/login.html`

### 2. Configuration

Update `API_BASE_URL` in:
- `js/auth.js` (line 3)
- `js/venueRequests.js` (line 3)

Default: `http://localhost:8081/api`

## Design

The dashboard uses PlayPal's color palette:
- Primary: `#B4F1B0` (secColor)
- Primary Dark: `#5EA27E` (secColorDark)
- Primary Light: `#8DD6B3` (thrdColor)

Professional admin dashboard styling with:
- Gradient headers
- Smooth animations
- Professional cards and tables
- Modern modals
- Consistent spacing and typography

