# Email Configuration for Kampos Backend

## Overview
The Kampos backend uses **Brevo (formerly Sendinblue)** SMTP service to send OTP codes and other transactional emails.

## Current Status
- ✅ OTP codes are generated and logged to console for development
- ⚠️ Email sending is not configured (using mock credentials)
- 📧 OTP codes are visible in backend terminal logs

## Setting Up Brevo SMTP (Optional)

### 1. Create a Brevo Account
1. Go to https://www.brevo.com/
2. Sign up for a free account
3. Verify your email address

### 2. Get SMTP Credentials
1. Log in to Brevo dashboard
2. Go to **Settings** → **SMTP & API**
3. Click on **SMTP** tab
4. You'll see:
   - **SMTP Server**: `smtp-relay.brevo.com`
   - **Port**: `587`
   - **Login**: Your Brevo email
   - **SMTP Key**: Click "Generate a new SMTP key"

### 3. Update Backend .env File
Edit `/home/eric/kampos/KamposBackend/.env`:

```env
# Email (Brevo SMTP)
BREVO_EMAIL=your-brevo-email@example.com
BREVO_PASSWORD=your-smtp-key-here
```

Replace:
- `your-brevo-email@example.com` with your Brevo account email
- `your-smtp-key-here` with the SMTP key you generated

### 4. Restart Backend
```bash
# In the backend directory
npm run dev
```

## Testing
Once configured, OTP emails will be sent to users' email addresses instead of just being logged to the console.

## Free Tier Limits
Brevo free tier includes:
- ✅ 300 emails per day
- ✅ Unlimited contacts
- ✅ SMTP relay
- ✅ Transactional emails

This is more than enough for development and testing!

## Alternative: Keep Using Console Logs
For development, you can continue using the console logs to see OTP codes. This is perfectly fine and doesn't require any email service setup.

The OTP codes will appear in your backend terminal like this:

```
📧 ========== SENDING OTP ==========
📧 Email: user@example.com
🔢 OTP Code: 123456
====================================
```
