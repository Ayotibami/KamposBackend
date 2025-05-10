import uuid
from django.db import models
from django.utils import timezone
from django.core.validators import MaxLengthValidator
from django.contrib.postgres.fields import ArrayField
from account.models import Account
from django.conf import settings
import json

class Event(models.Model):
    event_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    _host_avi_tags = models.TextField(db_column='host_avi_tags', default='[]')
    location = models.ForeignKey('campus.Campus', on_delete=models.CASCADE)
    description = models.TextField()
    event_date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def host_avi_tags(self):
        """Get host_avi_tags as a list"""
        try:
            return json.loads(self._host_avi_tags)
        except:
            return []

    @host_avi_tags.setter
    def host_avi_tags(self, value):
        """Set host_avi_tags as JSON string"""
        if not value:
            self._host_avi_tags = '[]'
        else:
            self._host_avi_tags = json.dumps(list(value))

    def save(self, *args, **kwargs):
        # Ensure host_avi_tags is always a JSON string
        if not self._host_avi_tags:
            self._host_avi_tags = '[]'
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-event_date']

    def __str__(self):
        return f"{self.title} at {self.location} on {self.event_date}"

    def is_upcoming(self):
        return self.event_date > timezone.now()

class EventRegistration(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    student_avi_tag = models.CharField(max_length=255)
    registered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['event', 'student_avi_tag']

    def __str__(self):
        return f"{self.student_avi_tag} registered for {self.event.title}" 