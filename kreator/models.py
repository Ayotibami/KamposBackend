from django.db import models
from account.models import Account
from campus.models import Campus

class Kreator(models.Model):
    display_name = models.CharField(max_length=255, unique=True)
    avitag = models.CharField(max_length=255, unique=True)
    campus = models.ForeignKey(Campus, on_delete=models.SET_NULL, null=True, blank=True)
    account = models.OneToOneField(Account, on_delete=models.CASCADE, related_name='kreator')
    is_verified = models.BooleanField(default=False)
    description = models.TextField(blank=True)
    profile_type = models.CharField(max_length=20, default='KREATOR')
    profile_image = models.URLField(blank=True)
    engagement_score = models.FloatField(null=True, blank=True)
    earnings_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    monetization_enabled = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    top_gist = models.ForeignKey('gist.Gist', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-engagement_score', '-joined_at']

    def __str__(self):
        return self.display_name 