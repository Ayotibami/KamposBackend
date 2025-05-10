import firebase_admin
from firebase_admin import auth, credentials
from django.conf import settings
from django.core.exceptions import ValidationError
import json
import base64

def initialize_firebase():
    """Initialize Firebase Admin SDK if not already initialized"""
    try:
        if not firebase_admin._apps:
            # Add padding if needed
            cred_base64 = settings.FIREBASE_CREDENTIALS_BASE64
            padding = len(cred_base64) % 4
            if padding:
                cred_base64 += '=' * (4 - padding)

            # Decode and initialize
            cred_json = base64.b64decode(cred_base64).decode('utf-8')
            cred_dict = json.loads(cred_json)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
    except Exception as e:
        raise ValidationError(f"Failed to initialize Firebase: {str(e)}")

def verify_firebase_token(id_token):
    """Verify the Firebase ID token"""
    try:
        initialize_firebase()
        return auth.verify_id_token(id_token)
    except Exception as e:
        raise ValidationError(f"Invalid Firebase token: {str(e)}")  

def get_firebase_user_info(uid):
    """Get user info from Firebase"""
    try:
        initialize_firebase()
        return auth.get_user(uid)
    except Exception as e:
        raise ValidationError(f"Error fetching Firebase user: {str(e)}") 