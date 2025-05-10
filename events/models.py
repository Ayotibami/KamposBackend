import uuid
from django.db import models
from django.utils import timezone
from django.core.validators import MaxLengthValidator
from django.contrib.postgres.fields import ArrayField

class Event(models.Model):
    event_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    host_avi_tags = ArrayField(
        models.CharField(max_length=255),
        size=3,  # Maximum 3 hosts
        verbose_name="Host AviTags"
    )
    location = models.CharField(max_length=255)  # CampusTag
    description = models.TextField()
    event_date = models.DateTimeField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-event_date']

    def __str__(self):
        return f"{self.title} at {self.location} on {self.event_date}"

    def is_upcoming(self):
        return self.event_date > timezone.now()

class EventRegistration(models.Model):
    id = models.AutoField(primary_key=True)
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='registrations')
    student_avi_tag = models.CharField(max_length=255)
    registered_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('event', 'student_avi_tag')
        ordering = ['-registered_at']

    def __str__(self):
        return f"{self.student_avi_tag} registered for {self.event.title}" 