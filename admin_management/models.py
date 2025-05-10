from django.db import models
from account.models import Account

class AdminRole(models.TextChoices):
    SUPER_ADMIN = 'SUPER_ADMIN', 'Super Admin'
    MODERATOR = 'MODERATOR', 'Moderator'
    CONTENT_REVIEWER = 'CONTENT_REVIEWER', 'Content Reviewer'
    SUPPORT = 'SUPPORT', 'Support'

class AdminProfile(models.Model):
    avitag = models.CharField(max_length=255, unique=True)
    full_name = models.CharField(max_length=255)
    account = models.OneToOneField(Account, on_delete=models.CASCADE, related_name='admin')
    is_verified = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    profile_type = models.CharField(max_length=20, default='ADMIN')
    profile_image = models.URLField(blank=True)
    role = models.CharField(max_length=20, choices=AdminRole.choices)
    permissions = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['role', 'full_name']

    def __str__(self):
        return f"{self.full_name} ({self.role})" 