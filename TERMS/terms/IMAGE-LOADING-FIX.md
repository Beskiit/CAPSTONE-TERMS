# Image Loading Fix for Production

## The Problem
Images work on localhost but fail to load on your live VPS. This is a common issue when moving from development to production.

## Root Cause
The issue is in how image URLs are constructed and served:

1. **Backend stores images** in `/uploads/accomplishments/` directory
2. **Backend serves static files** at `/uploads` route
3. **Frontend constructs URLs** that may not match the actual file paths
4. **Path differences** between development and production environments

## What I Fixed

### 1. Backend Image URL Storage
- Fixed the filename storage in `submissionController.js`
- Now stores the correct filename (not originalname) for consistency

### 2. Frontend Image URL Construction
- Created `utils/imageUtils.js` with robust URL construction
- Handles both relative and absolute paths correctly
- Works in both development and production environments

### 3. Enhanced Error Handling
- Added debug logging for image loading failures
- Better error messages to identify URL construction issues

## Files Updated

1. **`CAPSTONE_API_DATABASE/controllers/submissionController.js`**
   - Fixed filename storage for uploaded images

2. **`src/utils/imageUtils.js`** (NEW)
   - Centralized image URL handling
   - Production-safe URL construction

3. **`src/pages/Teacher/AccomplishmentReport.jsx`**
   - Updated to use new image utilities
   - Enhanced error handling and debugging

## Deployment Steps

### 1. Upload Updated Files to VPS

Upload these files to your VPS:
- `CAPSTONE_API_DATABASE/controllers/submissionController.js`
- `src/utils/imageUtils.js`
- `src/pages/Teacher/AccomplishmentReport.jsx`

### 2. Verify Backend Static File Serving

Check that your backend is serving static files correctly:

```bash
# Test if images are accessible directly
curl -I https://terms-api.kiri8tives.com/uploads/accomplishments/[filename]

# Should return 200 OK, not 404
```

### 3. Check File Permissions

Ensure the uploads directory has correct permissions:

```bash
# On your VPS
sudo chmod -R 755 /path/to/your/backend/uploads/
sudo chown -R www-data:www-data /path/to/your/backend/uploads/
```

### 4. Verify Environment Variables

Make sure your frontend has the correct API base URL:

```bash
# In your frontend build
echo $VITE_API_BASE
# Should be: https://terms-api.kiri8tives.com
```

### 5. Test Image Loading

1. **Open browser developer tools** (F12)
2. **Go to Network tab**
3. **Load a page with images**
4. **Check for failed image requests** (red entries)
5. **Click on failed requests** to see the exact URL being requested

## Common Issues and Solutions

### Issue 1: 404 Not Found for Images
**Cause:** Backend not serving static files correctly
**Solution:**
```bash
# Check if backend is running
pm2 status

# Check if uploads directory exists
ls -la /path/to/backend/uploads/accomplishments/

# Restart backend
pm2 restart capstone-api
```

### Issue 2: CORS Errors for Images
**Cause:** Frontend and backend on different domains
**Solution:** Update CORS configuration in backend `index.js`

### Issue 3: Images Load in Backend but Not Frontend
**Cause:** URL construction mismatch
**Solution:** Check the browser console for the exact URLs being requested

### Issue 4: Mixed Content Errors (HTTP/HTTPS)
**Cause:** Frontend on HTTPS, backend on HTTP
**Solution:** Ensure both frontend and backend use HTTPS

## Debugging Commands

```bash
# Check if backend is serving static files
curl -I https://terms-api.kiri8tives.com/uploads/accomplishments/test.jpg

# Check file permissions
ls -la /path/to/backend/uploads/accomplishments/

# Check backend logs
pm2 logs capstone-api

# Test specific image URL
curl -v https://terms-api.kiri8tives.com/uploads/accomplishments/[actual-filename]
```

## Testing Checklist

- [ ] Backend is running and accessible
- [ ] Static file serving is working (`/uploads` route)
- [ ] Uploads directory exists and has correct permissions
- [ ] Frontend API_BASE is set correctly
- [ ] Images are accessible via direct URL
- [ ] No CORS errors in browser console
- [ ] No mixed content errors (HTTP/HTTPS mismatch)

## Quick Test

1. **Upload a new image** through your application
2. **Check the browser console** for any errors
3. **Try accessing the image directly** via URL
4. **Verify the image appears** in the application

If images still don't load, check the browser console for the exact error messages and URLs being requested.
