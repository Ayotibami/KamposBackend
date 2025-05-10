from django.contrib import admin
from .models import Event, EventRegistration

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ['title', 'location', 'event_date', 'created_at']
    search_fields = ['title', 'description']
    list_filter = ['event_date', 'location']

@admin.register(EventRegistration)
class EventRegistrationAdmin(admin.ModelAdmin):
    list_display = ['event', 'student_avi_tag', 'registered_at']
    search_fields = ['event__title', 'student_avi_tag']
    list_filter = ['registered_at']