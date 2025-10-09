# Backend Deployment Instructions

## Files to Update on Your VPS:

1. **Upload the updated `index.js`** from `TERMS/terms/CAPSTONE_API_DATABASE/index.js` to your VPS

2. **Set environment variable** (recommended):
   ```bash
   export FRONTEND_URL="https://kiri8tives.com/terms"
   export NODE_ENV="production"
   ```

3. **Or create a `.env` file** on your VPS:
   ```
   FRONTEND_URL=https://kiri8tives.com/terms
   NODE_ENV=production
   ```

4. **Restart your backend server** on the VPS

## What This Fixes:

- After Google OAuth login, users will be redirected to `https://kiri8tives.com/terms/DashboardTeacher` (or appropriate dashboard based on role)
- Instead of being stuck on the backend API page showing "API online"

## Test After Deployment:

1. Go to `https://kiri8tives.com/terms`
2. Click "Continue with Google"
3. Complete Google authentication
4. You should be redirected to the appropriate dashboard instead of the backend API page
