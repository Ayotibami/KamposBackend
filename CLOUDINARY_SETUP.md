# Cloudinary Setup for Kampos Backend

## Overview
Kampos uses Cloudinary to store user profile images and media uploads.

## Current Status
- ✅ Profile creation works without Cloudinary (images are skipped)
- ⚠️ Image uploads are disabled (using mock credentials)
- 📸 Profiles can be created without images

## Setting Up Cloudinary (Optional for Development)

### 1. Create a Cloudinary Account
1. Go to https://cloudinary.com/
2. Sign up for a free account
3. Verify your email address

### 2. Get Your Credentials
1. Log in to Cloudinary dashboard
2. Go to **Dashboard** (home page)
3. You'll see your credentials:
   - **Cloud Name**: e.g., `dxyz123abc`
   - **API Key**: e.g., `123456789012345`
   - **API Secret**: e.g., `abcdefghijklmnopqrstuvwxyz`

### 3. Update Backend .env File
Edit `/home/eric/kampos/KamposBackend/.env`:

```env
# Cloudinary
CLOUDINARY_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

Replace:
- `your_cloud_name_here` with your Cloud Name
- `your_api_key_here` with your API Key
- `your_api_secret_here` with your API Secret

### 4. Restart Backend
```bash
# In the backend directory
npm run dev
```

## Testing
Once configured, profile images will be uploaded to Cloudinary and accessible via CDN URLs.

## Free Tier Limits
Cloudinary free tier includes:
- ✅ 25 GB storage
- ✅ 25 GB monthly bandwidth
- ✅ Image transformations
- ✅ Video support (up to 10 minutes)

This is more than enough for development and testing!

## Alternative: Skip Image Uploads
For development, you can continue without Cloudinary. The backend will:
- ✅ Create profiles successfully
- ✅ Skip image uploads (no errors)
- ✅ Set `image_url` to `null`

Users will have no profile picture, which is fine for testing the authentication and profile flow!

## Default Profile Picture (Optional)
You can set a default profile picture URL in `.env`:

```env
DEFAULT_PROFILE_PIC_URL=https://example.com/default-avatar.png
```

This will be used when no image is uploaded.
