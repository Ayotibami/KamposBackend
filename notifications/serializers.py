from rest_framework import serializers
from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['notification_id', 'avi_tag', 'type', 'message', 
                 'reference_id', 'is_read', 'created_at']
        read_only_fields = ['notification_id', 'created_at'] 