from rest_framework import serializers
from .models import Kompany

class KompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Kompany
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'is_verified'] 