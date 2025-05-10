from django.contrib import admin
from .models import Kompany

@admin.register(Kompany)
class KompanyAdmin(admin.ModelAdmin):
    list_display = ['display_name', 'avitag', 'is_verified', 'created_at']
    search_fields = ['display_name', 'avitag', 'email']
    list_filter = ['is_verified', 'created_at'] 