import firebase_admin
from firebase_admin import auth, credentials
from django.conf import settings
from django.core.exceptions import ValidationError

def initialize_firebase():
    """Initialize Firebase Admin SDK if not already initialized"""
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate({
                "type": "service_account",
                "project_id": settings.FIREBASE_PROJECT_ID,
                "private_key_id": settings.FIREBASE_PRIVATE_KEY_ID,
                "private_key": settings.FIREBASE_PRIVATE_KEY.replace('\\n', '\n'),
                "client_email": settings.FIREBASE_CLIENT_EMAIL,
                "client_id": "",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-{settings.FIREBASE_PROJECT_ID}.iam.gserviceaccount.com"
            })
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