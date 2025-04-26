"""
Core utilities for the Kampos project
"""
import os
import uuid
from datetime import datetime

import pyotp
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler
import requests
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from jose import jwt as jose_jwt


def generate_unique_id():
    """Generate a unique UUID"""
    return str(uuid.uuid4())


def generate_otp():
    """Generate a 6-digit OTP"""
    totp = pyotp.TOTP(pyotp.random_base32())
    return totp.now()


def verify_otp(otp, secret, valid_window=1):
    """Verify an OTP"""
    totp = pyotp.TOTP(secret)
    return totp.verify(otp, valid_window=valid_window)


def encrypt_token(token):
    """Simple encryption for tokens (in production, use more secure methods)"""
    # This is a placeholder - in production, use proper encryption
    return token


def decrypt_token(encrypted_token):
    """Simple decryption for tokens (in production, use more secure methods)"""
    # This is a placeholder - in production, use proper decryption
    return encrypted_token


def send_email_template(to_email, subject, template_name, context, from_email=None):
    """Send an email using a template"""
    from_email = from_email or settings.DEFAULT_FROM_EMAIL
    html_content = render_to_string(f'emails/{template_name}.html', context)
    text_content = render_to_string(f'emails/{template_name}.txt', context)
    
    msg = EmailMultiAlternatives(subject, text_content, from_email, [to_email])
    msg.attach_alternative(html_content, "text/html")
    return msg.send()


def generate_password_reset_token(user_id):
    """Generate a token for password reset"""
    import jwt
    
    token = jwt.encode({
        'user_id': str(user_id),
        'exp': datetime.now() + settings.PASSWORD_RESET_TIMEOUT,
        'type': 'password_reset'
    }, settings.SECRET_KEY, algorithm='HS256')
    
    return token


def verify_password_reset_token(token):
    """Verify a password reset token"""
    import jwt
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        if payload.get('type') != 'password_reset':
            return None
        return payload.get('user_id')
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


class CustomAPIException(APIException):
    """Custom API exception class"""
    def __init__(self, detail=None, code=None):
        self.status_code = code or status.HTTP_400_BAD_REQUEST
        super().__init__(detail)


def custom_exception_handler(exc, context):
    """Custom exception handler for better error responses"""
    response = exception_handler(exc, context)
    
    # If response is None, there was an unhandled exception
    if response is None:
        if isinstance(exc, Exception):
            return Response(
                {"error": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        return None
    
    # Format the response
    if isinstance(response.data, dict):
        error_data = {}
        
        if 'detail' in response.data:
            error_data['message'] = response.data['detail']
        
        for field, errors in response.data.items():
            if field != 'detail':
                if isinstance(errors, list):
                    error_data[field] = errors[0]
                else:
                    error_data[field] = errors
        
        response.data = error_data
    
    return response


def create_directory_if_not_exists(directory_path):
    """Create a directory if it doesn't exist"""
    if not os.path.exists(directory_path):
        os.makedirs(directory_path)


def handle_oauth_google(token):
    """Handle Google OAuth authentication"""
    try:
        idinfo = id_token.verify_oauth2_token(
            token, google_requests.Request(), settings.OAUTH_CREDENTIALS['google']['client_id']
        )
        
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise ValueError('Invalid issuer')
            
        return {
            'id': idinfo['sub'],
            'email': idinfo['email'],
            'email_verified': idinfo['email_verified'],
            'name': idinfo.get('name'),
            'picture': idinfo.get('picture')
        }
    except Exception as e:
        raise CustomAPIException(f"Invalid Google token: {str(e)}")


def handle_oauth_facebook(token):
    """Handle Facebook OAuth authentication"""
    try:
        # Verify token with Facebook
        response = requests.get(
            'https://graph.facebook.com/me',
            params={
                'fields': 'id,email,name,picture',
                'access_token': token
            }
        )
        data = response.json()
        
        if 'error' in data:
            raise ValueError(data['error']['message'])
            
        return {
            'id': data['id'],
            'email': data.get('email'),
            'name': data.get('name'),
            'picture': data.get('picture', {}).get('data', {}).get('url')
        }
    except Exception as e:
        raise CustomAPIException(f"Invalid Facebook token: {str(e)}")


def handle_oauth_apple(token):
    """Handle Apple OAuth authentication"""
    try:
        # Verify Apple ID token
        headers = jose_jwt.get_unverified_headers(token)
        public_key = get_apple_public_key(headers['kid'])
        
        payload = jose_jwt.decode(
            token,
            public_key,
            algorithms=['RS256'],
            audience=settings.OAUTH_CREDENTIALS['apple']['service_id']
        )
        
        return {
            'id': payload['sub'],
            'email': payload.get('email'),
            'email_verified': payload.get('email_verified', True)
        }
    except Exception as e:
        raise CustomAPIException(f"Invalid Apple token: {str(e)}")


def get_apple_public_key(kid):
    """Get Apple's public key for token verification"""
    try:
        response = requests.get('https://appleid.apple.com/auth/keys')
        keys = response.json()['keys']
        key = next((k for k in keys if k['kid'] == kid), None)
        if not key:
            raise ValueError('Key not found')
        return key
    except Exception as e:
        raise CustomAPIException(f"Error getting Apple public key: {str(e)}")