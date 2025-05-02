from django.db import models

class AuthProvider(models.TextChoices):
    """Authentication provider choices"""
    EMAIL = 'email', 'Email'
    GOOGLE = 'google', 'Google'
    FACEBOOK = 'facebook', 'Facebook'
    APPLE = 'apple', 'Apple'

class AccountStatus(models.TextChoices):
    """Account status choices"""
    ACTIVE = 'active', 'Active'
    DELETED = 'deleted', 'Deleted'
    SUSPENDED = 'suspended', 'Suspended' 