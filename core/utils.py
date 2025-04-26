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