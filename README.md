# Kampos API Documentation

## Overview
REST API for Kampos authentication, account management, campus, and more.

Base URL: `http://localhost:8000/api`  
Swagger UI: `http://localhost:8000/swagger/`

## Table of Contents
- [Authentication](#authentication)
- [Profile Setup](#profile-setup)
- [Account Management](#account-management)
- [Profile Types](#profile-types)
- [Campus](#campus)
- [Other Apps](#other-apps)
- [Error Handling](#error-handling)
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
    "password": "securepassword123",
    "first_name": "John",
    "last_name": "Doe",
    "profile_type": "STUDENT"  // Optional, defaults to STUDENT
}
```

**Profile Types:**
- STUDENT
- SCHOOL
- KOMPANY
- KREATOR
- ADMIN

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
        "email": "user@example.com",
        "profile_type": "STUDENT"
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
    },
    "account": {
        "account_id": "uuid",
        "email": "user@example.com"
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
POST /auth/reset-password/?email=user@example.com
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

## Profile Setup

### Student Profile Setup
After registration, complete your student profile.

```http
PATCH /profile/update/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Request Body:**
```json
{
    "profile_data": {
        "first_name": "John",
        "last_name": "Doe",
        "campus_tag": "UNILAG",  // University tag
        "major_tag": "COMPUTER_SCIENCE",  // Major tag
        "level": 200,  // Academic level (100-700)
        "degree": "BACHELORS",  // BACHELORS, MASTERS, PHD
        "bio": "Computer Science student interested in AI",
        "hobbies": ["coding", "reading", "gaming"]
    }
}
```

**Available Campuses:**
- Federal University Lokoja
- Obafemi Awolowo University
- University of Abuja
- University of Lagos (UNILAG)
- Federal University of Ibadan (UI)
- Ahmadu Bello University (ABU)
- University of Nigeria, Nsukka (UNN)
- Federal University of Technology, Akure (FUTA)
- University of Benin (UNIBEN)

**Available Majors:**
- Computer Science
- Geology
- Mathematics
- Micro Biology
- Physics
- Statistics
- Botany
- Chemistry
- Zoology
- Computer Science Education

### Upload Profile Picture
Upload a profile picture.

```http
POST /profiles/{avitag}/upload_picture/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Request Body:**
```
Form Data:
- profile_picture: [file]
```

**Response:** `200 OK`
```json
{
    "avitag": "user123",
    "profile_picture": "https://cloudinary.com/..."
}
```

### Get Profile
Get current user's profile.

```http
GET /profiles/me/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Response:** `200 OK`
```json
{
    "avitag": "user123",
    "profile_type": "STUDENT",
    "first_name": "John",
    "last_name": "Doe",
    "campus_tag": "UNILAG",
    "major_tag": "COMPUTER_SCIENCE",
    "level": 200,
    "degree": "BACHELORS",
    "bio": "Computer Science student interested in AI",
    "hobbies": ["coding", "reading", "gaming"],
    "profile_picture": "https://cloudinary.com/...",
    "is_verified": false,
    "status": "ACTIVE"
}
```

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

## Profile Types

### Update Profile
Update profile data.

```http
PATCH /account/profile/update/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Request Body:**
```json
{
  "profile_data": {
    // Fields specific to the profile type
  }
}
```

**Profile-specific fields:**

For Student profiles:
```json
{
  "profile_data": {
    "school": "University Name",
    "department": "Computer Science",
    "graduation_year": 2025,
    "student_id": "CS12345",
    "bio": "Computer Science student interested in AI"
  }
}
```

For Kompany profiles:
```json
{
  "profile_data": {
    "company_name": "Tech Solutions Inc.",
    "industry": "Technology",
    "website": "https://techsolutions.example.com",
    "description": "Providing innovative tech solutions",
    "logo_url": "https://example.com/logo.png"
  }
}
```

Similar examples for other profile types...

## Campus

### List Campuses
Get a list of campuses.

```http
GET /campus/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

### Retrieve Campus
Get details of a specific campus.

```http
GET /campus/{id}/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

### Create Campus
Create a new campus.

```http
POST /campus/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Request Body:**
```json
{
    "name": "Main Campus",
    "location": "City, Country"
}
```

### Update Campus
Update details of a campus.

```http
PATCH /campus/{id}/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Request Body:**
```json
{
    "name": "Updated Campus Name"
}
```

### Delete Campus
Delete a campus.

```http
DELETE /campus/{id}/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

## Other Apps

### Major

#### List Majors
Get a list of majors.

```http
GET /major/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

#### Create Major
Create a new major.

```http
POST /major/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Request Body:**
```json
{
    "name": "Computer Science"
}
```

#### Update Major
Update details of a major.

```http
PATCH /major/{id}/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Request Body:**
```json
{
    "name": "Updated Major Name"
}
```

#### Delete Major
Delete a major.

```http
DELETE /major/{id}/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

### Kompany

#### List Kompanies
Get a list of companies.

```http
GET /kompany/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

#### Create Kompany
Create a new company.

```http
POST /kompany/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Request Body:**
```json
{
    "company_name": "Tech Solutions Inc.",
    "industry": "Technology",
    "website": "https://techsolutions.example.com"
}
```

#### Update Kompany
Update details of a company.

```http
PATCH /kompany/{id}/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Request Body:**
```json
{
    "company_name": "Updated Name"
}
```

#### Delete Kompany
Delete a company.

```http
DELETE /kompany/{id}/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

### Kreator

#### List Kreators
Get a list of content creators.

```http
GET /kreator/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

#### Create Kreator
Create a new content creator.

```http
POST /kreator/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Request Body:**
```json
{
    "name": "Kreator Name",
    "bio": "Short bio"
}
```

#### Update Kreator
Update details of a content creator.

```http
PATCH /kreator/{id}/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Request Body:**
```json
{
    "bio": "Updated bio"
}
```

#### Delete Kreator
Delete a content creator.

```http
DELETE /kreator/{id}/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

### Admin Management

#### List Admins
Get a list of administrators.

```http
GET /admin_management/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

#### Create Admin
Create a new administrator.

```http
POST /admin_management/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Request Body:**
```json
{
    "email": "admin@example.com",
    "role": "superuser"
}
```

#### Update Admin
Update details of an administrator.

```http
PATCH /admin_management/{id}/
```

**Headers:**
```
Authorization: Bearer access_token_here
```

**Request Body:**
```json
{
    "role": "staff"
}
```

#### Delete Admin
Delete an administrator.

```http
DELETE /admin_management/{id}/
```

**Headers:**
```
Authorization: Bearer access_token_here
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
python manage.py test
```

## How to Consume the API

- Use the provided endpoints with a tool like [Postman](https://www.postman.com/) or [httpie](https://httpie.io/).
- Authenticate using the `/auth/login/` endpoint to get your access token.
- Add the header: `Authorization: Bearer <access_token>` to all protected endpoints.
- For POST/PATCH requests, send JSON bodies as shown in the examples above.

## Swagger/OpenAPI

- Visit `http://localhost:8000/swagger/?format=openapi` for interactive API docs and testing.

## Contact
Developer: [Your Name](mailto:your.email@example.com)