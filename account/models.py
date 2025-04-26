"""
Account models for the Kampos project
"""
import uuid
from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.utils import timezone

from core.utils import encrypt_token, generate_otp


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


class Account(models.Model):
    """Account model for user authentication"""
    account_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255, null=True, blank=True)
    auth_provider = models.CharField(
        max_length=20,
        choices=AuthProvider.choices,
        default=AuthProvider.EMAIL
    )
    is_otp_verified = models.BooleanField(default=False)
    account_status = models.CharField(
        max_length=20,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login = models.DateTimeField(null=True, blank=True)
    oauth_id = models.CharField(max_length=255, null=True, blank=True, unique=True)
    otp_secret = models.CharField(max_length=255, null=True, blank=True)
    otp_created_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'accounts'
        verbose_name = 'Account'
        verbose_name_plural = 'Accounts'
    
    def __str__(self):
        return self.email
    
    def save(self, *args, **kwargs):
        # Hash the password if it's a new plain text password
        if self.password_hash and not self.password_hash.startswith(('pbkdf2_sha256$', 'bcrypt$', 'argon2')):
            self.password_hash = make_password(self.password_hash)
        super().save(*args, **kwargs)
    
    def check_password(self, raw_password):
        """Check if the provided password matches the stored hash"""
        if not self.password_hash:
            return False
        return check_password(raw_password, self.password_hash)
    
    def set_password(self, raw_password):
        """Set a new password"""
        self.password_hash = make_password(raw_password)
        self.save(update_fields=['password_hash'])
    
    def generate_and_save_otp(self):
        """Generate an OTP and save its secret"""
        otp = generate_otp()
        self.otp_secret = otp
        self.otp_created_at = timezone.now()
        self.save(update_fields=['otp_secret', 'otp_created_at'])
        return otp
    
    def verify_otp(self, otp):
        """Verify the OTP and update verification status"""
        if not self.otp_secret or not self.otp_created_at:
            return False
        
        # Check if OTP has expired
        expiry_time = self.otp_created_at + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
        if timezone.now() > expiry_time:
            return False
        
        # Verify OTP
        if otp == self.otp_secret:
            self.is_otp_verified = True
            self.otp_secret = None
            self.otp_created_at = None
            self.save(update_fields=['is_otp_verified', 'otp_secret', 'otp_created_at'])
            return True
        return False
    
    def update_last_login(self):
        """Update the last login timestamp"""
        self.last_login = timezone.now()
        self.save(update_fields=['last_login'])
    
    def delete_account(self):
        """Soft delete the account"""
        self.account_status = AccountStatus.DELETED
        self.save(update_fields=['account_status'])


class OAuthSession(models.Model):
    """OAuth session model for managing OAuth refresh tokens"""
    session_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name='oauth_sessions'
    )
    auth_provider = models.CharField(
        max_length=20,
        choices=AuthProvider.choices,
        default=AuthProvider.GOOGLE
    )
    encrypted_refresh_token = models.TextField()
    token_expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'oauth_sessions'
        verbose_name = 'OAuth Session'
        verbose_name_plural = 'OAuth Sessions'
    
    def __str__(self):
        return f"{self.account.email} - {self.auth_provider}"
    
    def save(self, *args, **kwargs):
        # Encrypt the refresh token if it's not already encrypted
        if self.encrypted_refresh_token and not self.encrypted_refresh_token.startswith('enc_'):
            self.encrypted_refresh_token = encrypt_token(self.encrypted_refresh_token)
        super().save(*args, **kwargs)
    
    @property
    def is_expired(self):
        """Check if the token has expired"""
        return timezone.now() >= self.token_expires_at