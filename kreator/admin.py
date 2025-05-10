from django.contrib import admin
from .models import Kreator

@admin.register(Kreator)
class KreatorAdmin(admin.ModelAdmin):
    list_display = ['display_name', 'avitag', 'is_verified', 'monetization_enabled', 'joined_at']
    search_fields = ['display_name', 'avitag']
    list_filter = ['is_verified', 'monetization_enabled', 'joined_at'] 