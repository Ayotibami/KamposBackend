#!/usr/bin/env python
"""
Script to clear all waitlist data
"""
import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kampos.settings')
django.setup()

from account.models import Waitlist

def clear_waitlist():
    """Clear all waitlist entries"""
    count = Waitlist.objects.count()
    Waitlist.objects.all().delete()
    print(f"✅ Cleared {count} waitlist entries successfully!")

if __name__ == "__main__":
    clear_waitlist() 