from rest_framework import serializers
from .models import Kreator

class KreatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Kreator
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'is_verified', 'engagement_score'] 