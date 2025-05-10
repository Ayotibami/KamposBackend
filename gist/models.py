import uuid
from django.db import models
from django.utils import timezone
from cloudinary.models import CloudinaryField

# Create your models here.

class Gist(models.Model):
    gist_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    gist_text = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    edited_at = models.DateTimeField(null=True, blank=True)
    avitag = models.CharField(max_length=255)  # Foreign key to Profile
    is_reported = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Gist by {self.avitag} at {self.created_at}"

    def edit(self, new_text):
        self.gist_text = new_text
        self.edited_at = timezone.now()
        self.save()

class Comment(models.Model):
    comment_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    gist = models.ForeignKey(Gist, on_delete=models.CASCADE, related_name='comments')
    avitag = models.CharField(max_length=255)
    text = models.TextField()
    commented_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['commented_at']

    def __str__(self):
        return f"Comment by {self.avitag} on {self.gist.gist_id}"

class Media(models.Model):
    ENTITY_TYPES = (
        ('gist', 'Gist'),
        ('event', 'Event'),
    )
    MEDIA_TYPES = (
        ('image', 'Image'),
        ('video', 'Video'),
    )

    media_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entity_type = models.CharField(max_length=10, choices=ENTITY_TYPES)
    entity_id = models.UUIDField()
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES)
    media_file = CloudinaryField('media')
    uploaded_at = models.DateTimeField(default=timezone.now)
    edited_at = models.DateTimeField(null=True, blank=True)
    thumbnail_url = models.URLField(null=True, blank=True)

    class Meta:
        ordering = ['-uploaded_at']

class Reaction(models.Model):
    ENTITY_TYPES = (
        ('GIST', 'Gist'),
        ('COMMENT', 'Comment'),
    )
    REACTION_TYPES = (
        ('LIKE', 'Like'),
        ('LOVE', 'Love'),
        ('FIRE', 'Fire'),
        ('SAD', 'Sad'),
        ('WOW', 'Wow'),
    )

    reaction_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    avitag = models.CharField(max_length=255)
    entity_type = models.CharField(max_length=10, choices=ENTITY_TYPES)
    entity_id = models.UUIDField()
    type = models.CharField(max_length=10, choices=REACTION_TYPES)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('avitag', 'entity_type', 'entity_id')
        ordering = ['-created_at']

class Report(models.Model):
    REPORT_STATUS = (
        ('PENDING', 'Pending'),
        ('REVIEWED', 'Reviewed'),
        ('ACTION_TAKEN', 'Action Taken'),
        ('DISMISSED', 'Dismissed'),
    )

    report_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reported_by = models.CharField(max_length=255)  # avi_tag of reporter
    gist = models.ForeignKey(Gist, on_delete=models.CASCADE, related_name='reports')
    reason = models.TextField()
    status = models.CharField(
        max_length=20, 
        choices=REPORT_STATUS, 
        default='PENDING'
    )
    action_taken = models.TextField(null=True, blank=True)
    reviewed_by = models.CharField(max_length=255, null=True, blank=True)  # avi_tag of reviewer
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Report on {self.gist.gist_id} by {self.reported_by}"

class View(models.Model):
    view_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    gist = models.ForeignKey(Gist, on_delete=models.CASCADE, related_name='views')
    avi_tag = models.CharField(max_length=255)
    viewed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-viewed_at']
        unique_together = ('gist', 'avi_tag')  # Prevent duplicate views from same user

    def __str__(self):
        return f"View by {self.avi_tag} on {self.gist.gist_id}"
