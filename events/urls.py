from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EventViewSet, EventRegistrationViewSet

router = DefaultRouter()
router.register(r'events', EventViewSet)
router.register(r'registrations', EventRegistrationViewSet)

urlpatterns = [
    path('', include(router.urls)),
    # Custom endpoints
    path('events/upcoming/', 
         EventViewSet.as_view({'get': 'upcoming'}), name='upcoming-events'),
    path('events/my-events/', 
         EventViewSet.as_view({'get': 'my_events'}), name='my-events'),
    path('event-registrations/event/<uuid:event_id>/', 
         EventRegistrationViewSet.as_view({'get': 'by_event'}), name='event-registrations'),
    path('event-registrations/student/<str:avi_tag>/', 
         EventRegistrationViewSet.as_view({'get': 'by_student'}), name='student-registrations'),
] 