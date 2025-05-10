from django.contrib import admin
from .models import Major

@admin.register(Major)
class MajorAdmin(admin.ModelAdmin):
    list_display = ['major_name', 'major_tag']
    search_fields = ['major_name', 'major_tag'] 