# Kampos API Documentation

## Overview
REST API for Kampos authentication and account management system.

Base URL: `http://localhost:8000/api`  
Swagger UI: `http://localhost:8000/swagger/?format=openapi`

## Table of Contents
- [Authentication](#authentication)
  - [Register](#register)
  - [Login](#login)
  - [Firebase Auth](#firebase-authentication)
  - [Verify OTP](#verify-otp)
  - [Logout](#logout)
- [Account Management](#account-management)
  - [Get Profile](#get-profile)
  - [Update Account](#update-account)
  - [Change Password](#change-password)
  - [Delete Account](#delete-account)
- [Password Reset](#password-reset)
  - [Forgot Password](#forgot-password)
  - [Reset Password](#reset-password)
- [Development](#development)
- [Testing](#testing)

## Authentication

### Register
Create a new account.

```http
POST /auth/register/
```

**Request Body:**
```json
{
    "email": "user@example.com",
    "password": "securepassword123"
}
```

**Response:** `201 Created`
```json
{
    "message": "Account created successfully. Check your email for verification code.",
    "email": "user@example.com"
}
```

### Login
Authenticate and get access tokens.

```http
POST /auth/login/
```

**Request Body:**
```json
{
    "email": "user@example.com",
    "password": "securepassword123"
}
```

**Response:** `200 OK`
```json
{
    "message": "Login successful",
    "token": {
        "refresh": "refresh_token_here",
        "access": "access_token_here"
    },
    "account": {
        "account_id": "uuid",
        "email": "user@example.com"
    }
}
```

### Firebase Authentication
Authenticate using Firebase ID token.

```http
POST /auth/firebase/
```

**Request Body:**
```json
{
    "id_token": "firebase_id_token_here"
}
```

**Response:** `200 OK`
```json
{
    "token": {
        "access": "access_token_here",
        "refresh": "refresh_token_here"
    },
    "account": {
        "account_id": "uuid",
        "email": "user@example.com"
    }
}
```

### Verify OTP
Verify email with OTP code.

```http
POST /auth/verify-otp/
```

**Request Body:**
```json
{
    "email": "user@example.com",
    "otp": "123456"
}
```

**Response:** `200 OK`
```json
{
    "message": "OTP verified successfully",
    "token": {
        "refresh": "refresh_token_here",
        "access": "access_token_here"
    }
}
```

### Logout
Invalidate refresh token.

```http
POST /auth/logout/
```

**Request Body:**
```json
{
    "refresh": "refresh_token_here"
}
```

**Response:** `204 No Content`

## Account Management

### Get Profile
Get authenticated user's profile.

```http
GET /account/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Response:** `200 OK`
```json
{
    "account_id": "uuid",
    "email": "user@example.com",
    "auth_provider": "email",
    "created_at": "2024-04-26T02:06:00Z"
}
```

### Update Account
Update account details.

```http
PATCH /account/update/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Request Body:**
```json
{
    "field_to_update": "new_value"
}
```

**Response:** `200 OK`
```json
{
    "account_id": "uuid",
    "email": "user@example.com",
    "field_to_update": "new_value"
}
```

### Change Password
Update account password.

```http
PATCH /account/change-password/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Request Body:**
```json
{
    "current_password": "current_password",
    "new_password": "new_password"
}
```

**Response:** `200 OK`
```json
{
    "message": "Password changed successfully"
}
```

### Delete Account
Delete user account.

```http
DELETE /account/delete/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Response:** `204 No Content`

## Password Reset

### Forgot Password
Request password reset email.

```http
POST /auth/forgot-password/
```

**Request Body:**
```json
{
    "email": "user@example.com"
}
```

**Response:** `200 OK`
```json
{
    "message": "If your email is registered, you will receive a password reset link"
}
```

### Reset Password
Reset password with token.

```http
POST /auth/reset-password/
```

**Request Body:**
```json
{
    "token": "reset_token_here",
    "password": "new_password"
}
```

**Query Parameters:**
```
email=user@example.com
```

**Response:** `200 OK`
```json
{
    "message": "Password reset successful"
}
```

## Error Handling

The API uses standard HTTP status codes:

- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

**Error Response Format:**
```json
{
    "message": "Error description",
    "errors": {
        "field": ["Error details"]
    }
}
```

## Rate Limiting

- Authenticated users: 100 requests/minute
- Unauthenticated users: 20 requests/minute

## Development

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Run migrations:
```bash
python manage.py migrate
```

4. Start server:
```bash
python manage.py runserver
```

## Testing

Run test suite:
```bash
# Run all tests
python manage.py test

# Run with coverage
coverage run manage.py test
coverage report
```

## License
BSD License

## Contact
Developer: [Your Name](mailto:your.email@example.com)