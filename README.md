# BIC Canada Refund Portal

A professional client and admin portal for BIC Canada refund tracking.

## Features
- Client login, signup, and forgotten password flows
- Client dashboard with case summary, financial metrics, progress tracker, and payout ledger
- Admin login and secure client ledger editing
- API endpoints for client dashboard and admin refund updates
- Dynamic remaining balance calculation in the admin editor
- Audit log tracking for admin refund changes

## Tech stack
- Node.js + Express
- Static frontend with vanilla JS and responsive CSS
- MongoDB Atlas for client and audit persistence

## Cross-device login
- Client credentials and admin updates are stored in MongoDB Atlas.
- Clients can log in from any device with the same email and password.
- Admin access is centralized through the same live database.

## Setup
1. Create a `.env` file in the project root using `.env.example`.
2. Set `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
3. Open a terminal in `c:\Users\godsp\Desktop\bic`
4. Run `npm install`
5. Run `npm start`
6. Open `http://localhost:4000`

## Vercel deployment
1. Push the repo to GitHub and connect it to Vercel.
2. In Vercel project settings, add the environment variables:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
3. Keep the project root as the deployment root.
4. Vercel will use `vercel.json` to route all requests to `server.js`.

## Admin credentials
- Email: `biccanada@gmail.com`
- Password: `Power081`

## Important pages
- `/` - Public portal homepage
- `/client-login.html` - Client login
- `/client-signup.html` - Client signup
- `/client-dashboard.html` - Client dashboard
- `/admin-login.html` - Admin login
- `/admin-dashboard.html` - Admin client list
- `/admin-client-edit.html?client_id=BIC-2026-8941` - Edit a client ledger
