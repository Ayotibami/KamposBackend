from django.test import TestCase
from django.conf import settings
from account.utils import initialize_firebase, verify_firebase_token
import firebase_admin
from firebase_admin import auth
import base64
import json

class FirebaseAuthTest(TestCase):
    def setUp(self):
        # Clean up any existing Firebase app
        if firebase_admin._apps:
            for app in firebase_admin._apps.values():
                firebase_admin.delete_app(app)
    
    def test_firebase_initialization(self):
        """Test that Firebase can be initialized with base64 credentials"""
        try:
            # Add padding if needed
            cred_base64 = settings.FIREBASE_CREDENTIALS_BASE64
            padding = len(cred_base64) % 4
            if padding:
                cred_base64 += '=' * (4 - padding)
                
            # Try to decode and initialize
            cred_json = base64.b64decode(cred_base64).decode('utf-8')
            cred_dict = json.loads(cred_json)
            
            # Initialize Firebase
            if not firebase_admin._apps:
                cred = firebase_admin.credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
            
            # If we get here, initialization succeeded
            self.assertTrue(firebase_admin._apps)
        except Exception as e:
            self.fail(f"Firebase initialization failed: {str(e)}")
    
    def test_credentials_format(self):
        """Test that the base64 credentials can be decoded properly"""
        try:
            cred_base64 = settings.FIREBASE_CREDENTIALS_BASE64
            self.assertIsNotNone(cred_base64, "Firebase credentials not found in settings")
            
            # Add padding if needed
            padding = len(cred_base64) % 4
            if padding:
                cred_base64 += '=' * (4 - padding) 
            
            # Try to decode the base64 string
            cred_json = base64.b64decode(cred_base64).decode('utf-8')
            cred_dict = json.loads(cred_json)
            
            # Check required fields
            required_fields = [
                'type', 'project_id', 'private_key_id', 'private_key',
                'client_email', 'client_id', 'auth_uri', 'token_uri'
            ]
            for field in required_fields:
                self.assertIn(field, cred_dict, f"Missing required field: {field}")
                
        except Exception as e:
            self.fail(f"Failed to decode credentials: {str(e)}")