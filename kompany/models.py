from django.db import models
from account.models import Account

class Kompany(models.Model):
    display_name = models.CharField(max_length=255)
    avitag = models.CharField(max_length=255, unique=True)
    account = models.OneToOneField(Account, on_delete=models.CASCADE, related_name='kompany')
    is_verified = models.BooleanField(default=False)
    description = models.TextField(blank=True)
    profile_type = models.CharField(max_length=20, default='KOMPANY')
    email = models.EmailField()
    phone_number = models.CharField(max_length=20)
    logo = models.URLField()
    website = models.URLField()
    social_links = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Kompanies"
        ordering = ['-created_at']

    def __str__(self):
        return self.display_name 