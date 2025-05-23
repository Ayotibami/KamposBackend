"""
Account models for the Kampos project
"""
import uuid
from datetime import datetime, timedelta
import json

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.utils import timezone
from django.contrib.postgres.fields import ArrayField
from cloudinary.models import CloudinaryField

from core.utils import encrypt_token, generate_otp
from .choices import AuthProvider, AccountStatus, ProfileType


class Account(models.Model):
    """Account model for user authentication"""
    account_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255, null=True, blank=True)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    auth_provider = models.CharField(
        max_length=20,
        choices=AuthProvider.choices,
        default=AuthProvider.EMAIL
    )
    profile_type = models.CharField(
        max_length=20,
        choices=ProfileType.choices,
        default=ProfileType.STUDENT
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
    reset_token = models.CharField(max_length=255, null=True, blank=True)
    reset_token_created_at = models.DateTimeField(null=True, blank=True)
    firebase_uid = models.CharField(max_length=128, unique=True, null=True, blank=True)
    
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
    
    # Add these properties to make the model compatible with Django's auth system
    @property
    def id(self):
        return str(self.account_id)
    
    @property
    def username(self):
        return self.email
    
    def is_authenticated(self):
        return True
    
    def is_anonymous(self):
        return False

    @property
    def profile(self):
        """
        Get the appropriate profile based on profile_type
        """
        try:
            if self.profile_type == ProfileType.STUDENT:
                return self.student_profile
            elif self.profile_type == ProfileType.SCHOOL:
                return self.school_profile
            elif self.profile_type == ProfileType.KOMPANY:
                return self.kompany_profile
            elif self.profile_type == ProfileType.KREATOR:
                return self.kreator_profile
            elif self.profile_type == ProfileType.ADMIN:
                return self.admin_profile
            return None
        except (StudentProfile.DoesNotExist, SchoolProfile.DoesNotExist,
                KompanyProfile.DoesNotExist, KreatorProfile.DoesNotExist,
                AdminProfile.DoesNotExist):
            return None

    @property
    def is_admin(self):
        """Check if the account is an admin"""
        return self.profile_type == ProfileType.ADMIN


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


class AdminProfile(models.Model):
    """Profile for Kampos Administrators"""
    account = models.OneToOneField(Account, on_delete=models.CASCADE, primary_key=True, related_name='admin_profile')
    is_super_admin = models.BooleanField(default=False)
    department = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class KompanyProfile(models.Model):
    """Profile for affiliated companies and partners"""
    account = models.OneToOneField(Account, on_delete=models.CASCADE, primary_key=True, related_name='kompany_profile')
    company_name = models.CharField(max_length=255)
    industry = models.CharField(max_length=100, blank=True)
    website = models.URLField(blank=True)
    description = models.TextField(blank=True)
    logo_url = models.URLField(blank=True)
    verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class StudentProfile(models.Model):
    """Profile for students"""
    account = models.OneToOneField(Account, on_delete=models.CASCADE, primary_key=True, related_name='student_profile')
    school = models.CharField(max_length=255, blank=True)
    department = models.CharField(max_length=100, blank=True)
    graduation_year = models.IntegerField(null=True, blank=True)
    student_id = models.CharField(max_length=50, blank=True)
    bio = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class SchoolProfile(models.Model):
    """Profile for schools, institutions, and SUGs"""
    account = models.OneToOneField(Account, on_delete=models.CASCADE, primary_key=True, related_name='school_profile')
    institution_name = models.CharField(max_length=255)
    institution_type = models.CharField(max_length=100, blank=True)
    address = models.TextField(blank=True)
    website = models.URLField(blank=True)
    logo_url = models.URLField(blank=True)
    verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class KreatorProfile(models.Model):
    """Profile for creators and media"""
    account = models.OneToOneField(Account, on_delete=models.CASCADE, primary_key=True, related_name='kreator_profile')
    creator_name = models.CharField(max_length=255, blank=True)
    content_type = models.CharField(max_length=100, blank=True)
    bio = models.TextField(blank=True)
    portfolio_url = models.URLField(blank=True)
    verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Profile(models.Model):
    DEGREE_CHOICES = (
        ('BACHELORS', 'Bachelors'),
        ('MASTERS', 'Masters'),
        ('PHD', 'PhD'),
    )

    LEVEL_CHOICES = (
        (100, '100'),
        (200, '200'),
        (300, '300'),
        (400, '400'),
        (500, '500'),
    )

    PROFILE_TYPES = (
        ('STUDENT', 'Student'),
        ('KAMPOSER', 'Kamposer'),
        ('CREATOR', 'Creator'),
        ('ADMIN', 'Admin'),
        ('SCHOOL', 'School'),
    )

    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('DEACTIVATED', 'Deactivated'),
        ('BANNED', 'Banned'),
    )

    # Common fields for all profile types
    avitag = models.CharField(max_length=255, primary_key=True)
    account_id = models.UUIDField(unique=True)
    profile_type = models.CharField(max_length=20, choices=PROFILE_TYPES)
    is_verified = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    # Student-specific fields
    first_name = models.CharField(max_length=255, null=True, blank=True)
    last_name = models.CharField(max_length=255, null=True, blank=True)
    campus_tag = models.CharField(max_length=255, null=True, blank=True)
    
    # Modified hobbies field for SQLite compatibility
    hobbies = models.TextField(null=True, blank=True, default='')

    @property
    def hobbies_list(self):
        """Get hobbies as a list"""
        if not self.hobbies:
            return []
        try:
            return [x.strip() for x in self.hobbies.split(',') if x.strip()]
        except:
            return []

    @hobbies_list.setter
    def hobbies_list(self, value):
        """Set hobbies from list"""
        if not value:
            self.hobbies = ''
        else:
            self.hobbies = ','.join(str(x) for x in value if str(x).strip())

    def save(self, *args, **kwargs):
        # Ensure hobbies is always a string
        if isinstance(self.hobbies, (list, tuple)):
            self.hobbies_list = self.hobbies
        super().save(*args, **kwargs)

    degree = models.CharField(
        max_length=20,
        choices=DEGREE_CHOICES,
        null=True, blank=True
    )
    major_tag = models.CharField(max_length=255, null=True, blank=True)
    bio = models.TextField(null=True, blank=True)
    level = models.IntegerField(
        choices=LEVEL_CHOICES,
        null=True, blank=True
    )
    profile_picture = CloudinaryField('profile_picture', null=True, blank=True)

    # School-specific fields
    display_name = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    logo = CloudinaryField('logo', null=True, blank=True)
    website = models.URLField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.profile_type} - {self.avitag}"

    @property
    def is_admin(self):
        return self.profile_type == 'ADMIN'

    def deactivate(self):
        self.status = 'DEACTIVATED'
        self.save()

    def ban(self):
        self.status = 'BANNED'
        self.save()

    def verify(self):
        self.is_verified = True
        self.save()

    @staticmethod
    def generate_avitag(first_name, last_name):
        """Generate a unique avitag based on name"""
        base = f"{first_name.lower()}{last_name.lower()}"
        # Remove any non-alphanumeric characters
        base = ''.join(c for c in base if c.isalnum())
        # Take first 8 characters
        base = base[:8]
        # Add random 4 digits
        import random
        random_suffix = ''.join(str(random.randint(0, 9)) for _ in range(4))
        return f"{base}{random_suffix}"

    @classmethod
    def create_profile(cls, account):
        """Create a new profile with a unique avitag"""
        # Generate initial avitag
        avitag = cls.generate_avitag(account.first_name, account.last_name)
        
        # Keep trying until we get a unique avitag
        while cls.objects.filter(avitag=avitag).exists():
            avitag = cls.generate_avitag(account.first_name, account.last_name)
        
        return cls.objects.create(
            avitag=avitag,
            account_id=account.account_id,
            profile_type=account.profile_type
        )