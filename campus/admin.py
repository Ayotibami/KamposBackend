from django.contrib import admin
from .models import Campus

@admin.register(Campus)
class CampusAdmin(admin.ModelAdmin):
    list_display = ['campus_name', 'campus_tag']
    search_fields = ['campus_name', 'campus_tag'] 