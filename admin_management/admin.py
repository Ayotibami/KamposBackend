from django.contrib import admin
from .models import AdminProfile

@admin.register(AdminProfile)
class AdminProfileAdmin(admin.ModelAdmin):
    list_display = ['avitag', 'full_name', 'role', 'is_verified']
    search_fields = ['avitag', 'full_name']
    list_filter = ['role', 'is_verified', 'created_at'] 