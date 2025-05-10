import uuid
from django.db import models
from django.utils import timezone

class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('NEW_GIST', 'New Gist'),
        ('GIST_LIKE', 'Gist Like'),
        ('GIST_COMMENT', 'Gist Comment'),
        ('MAJOR_GIST', 'Major Gist'),
        ('INSTITUTION_GIST', 'Institution Gist'),
    )

    notification_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    avi_tag = models.CharField(max_length=255)  # FK to Profile
    type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    message = models.TextField()
    reference_id = models.UUIDField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.avi_tag}: {self.message[:50]}" 