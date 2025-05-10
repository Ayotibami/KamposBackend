from rest_framework import serializers
from .models import Event, EventRegistration
import json

class EventRegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventRegistration
        fields = ['id', 'event', 'student_avi_tag', 'registered_at']
        read_only_fields = ['registered_at']

class EventSerializer(serializers.ModelSerializer):
    registration_count = serializers.SerializerMethodField()
    is_registered = serializers.SerializerMethodField()
    is_host = serializers.SerializerMethodField()
    host_avi_tags = serializers.ListField(child=serializers.CharField())

    class Meta:
        model = Event
        fields = ['event_id', 'title', 'host_avi_tags', 'location', 
                 'description', 'event_date', 'created_at', 'updated_at',
                 'registration_count', 'is_registered', 'is_host']
        read_only_fields = ['event_id', 'created_at', 'updated_at']

    def get_registration_count(self, obj):
        return obj.registrations.count()

    def get_is_registered(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.registrations.filter(
                student_avi_tag=request.user.profile.avitag
            ).exists()
        return False

    def get_is_host(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return request.user.profile.avitag in obj.host_avi_tags
        return False

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['host_avi_tags'] = instance.host_avi_tags
        return data

    def to_internal_value(self, data):
        if 'host_avi_tags' in data:
            data['_host_avi_tags'] = json.dumps(data.pop('host_avi_tags'))
        return super().to_internal_value(data) 