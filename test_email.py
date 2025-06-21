#!/usr/bin/env python
"""
Test script to debug email sending
"""
import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kampos.settings')
django.setup()

from core.email_utils import send_email_template, EMAIL_ACCOUNTS

def test_email_config():
    """Test email configuration"""
    print("=== Email Configuration Test ===")
    print(f"EMAIL_HOST: {os.getenv('EMAIL_HOST', 'mail.privateemail.com')}")
    print(f"EMAIL_PORT: {os.getenv('EMAIL_PORT', 465)}")
    print(f"EMAIL_USE_SSL: {os.getenv('EMAIL_USE_SSL', 'True')}")
    
    print("\n=== Email Accounts ===")
    for account_name, account_info in EMAIL_ACCOUNTS.items():
        print(f"{account_name}:")
        print(f"  User: {account_info['user']}")
        print(f"  Password: {'*' * len(account_info['password']) if account_info['password'] else 'NOT SET'}")

def test_email_sending():
    """Test email sending"""
    print("\n=== Testing Email Sending ===")
    
    try:
        # Test with no-reply account
        result = send_email_template(
            to_email="alfrederic371@gmail.com",
            subject="Test Email from Kampos",
            template_name="waitlist_confirmation",
            context={
                "first_name": "Test",
                "full_name": "Test User",
                "university": "Test University",
                "major": "Computer Science",
                "current_year": 2025
            },
            sender="no-reply"
        )
        print(f"✅ Email sent successfully: {result}")
    except Exception as e:
        print(f"❌ Email sending failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_email_config()
    test_email_sending() 