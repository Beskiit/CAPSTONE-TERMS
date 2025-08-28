# OAuth Setup Instructions

## Google Cloud Console Setup

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API (now called Google People API)

### 2. Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Choose "Web application"
4. Add these URLs to authorized redirect URIs:
   - `http://localhost:5000/auth/google/callback` (for development)
   - `https://yourdomain.com/auth/google/callback` (for production)
5. Save and copy the Client ID and Client Secret

### 3. Update .env File
Replace the placeholder values in your `.env` file:

```env
GOOGLE_CLIENT_ID=your_actual_google_client_id_here
GOOGLE_CLIENT_SECRET=your_actual_google_client_secret_here
SESSION_SECRET=generate_a_strong_random_string_here
```

### 4. Generate Session Secret
You can generate a secure session secret using Node.js:
```javascript
require('crypto').randomBytes(64).toString('hex')
```

## Database Setup

Make sure your MySQL database has the `users` table created:

```sql
CREATE TABLE users (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  google_id    VARCHAR(64) UNIQUE NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  name         VARCHAR(255) NOT NULL,
  role         ENUM('teacher','coordinator','principal','admin') NOT NULL DEFAULT 'teacher',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Role Assignment Logic

The system includes automatic role assignment based on email domains. You can customize this in `/config/passport.js`:

```javascript
// Example: Admin logic based on email domain or specific emails
if (email.endsWith('@admin.yourschool.edu')) {
  role = 'admin';
} else if (email.endsWith('@principal.yourschool.edu')) {
  role = 'principal';
} else if (email.endsWith('@coordinator.yourschool.edu')) {
  role = 'coordinator';
}
```

## Testing the Integration

1. Start your backend server: `npm start`
2. Start your frontend: `npm run dev`
3. Visit `http://localhost:5173`
4. Click "Continue with Google"
5. Complete OAuth flow
6. You should be redirected to the appropriate dashboard

## Available OAuth Endpoints

- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - OAuth callback
- `POST /auth/logout` - Logout user
- `GET /auth/status` - Check authentication status
- `GET /auth/me` - Get current user info

## Protected Route Middleware

Use these middleware functions to protect your routes:

- `requireAuth` - Require any authenticated user
- `requireRole(['teacher'])` - Require specific role(s)
- `requireTeacher` - Require teacher or higher
- `requireCoordinator` - Require coordinator or higher  
- `requirePrincipal` - Require principal or higher
- `requireAdmin` - Require admin only

## Frontend Integration

The frontend includes:
- `AuthContext` - React context for authentication state
- `ProtectedRoute` - Component to protect routes by role
- `useAuth()` - Hook to access auth state and functions
- Automatic role-based dashboard routing

## Troubleshooting

### Common Issues:
1. **CORS errors**: Make sure your frontend URL is in `ALLOWED_ORIGINS`
2. **Session not persisting**: Check that cookies are enabled and `credentials: 'include'` is set
3. **OAuth redirect errors**: Verify callback URLs in Google Cloud Console
4. **Database connection**: Ensure MySQL is running and credentials are correct

### Debug Mode:
Add this to see detailed OAuth flow:
```javascript
app.use(session({
  // ... existing config
  debug: true
}));
```
