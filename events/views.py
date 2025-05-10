from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from .models import Event, EventRegistration
from .serializers import EventSerializer, EventRegistrationSerializer
from .permissions import IsEventHostOrReadOnly, IsRegistrationOwnerOrEventHost

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated, IsEventHostOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'description', 'location']

    def perform_create(self, serializer):
        # Automatically add creator as first host
        host_avi_tags = serializer.validated_data.get('host_avi_tags', [])
        host_avi_tags.insert(0, self.request.user.profile.avitag)
        serializer.save(host_avi_tags=host_avi_tags[:3])  # Ensure max 3 hosts

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming events"""
        events = self.queryset.filter(event_date__gt=timezone.now())
        serializer = self.get_serializer(events, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_events(self, request):
        """Get events where user is host or registered"""
        user_avitag = request.user.profile.avitag
        events = self.queryset.filter(
            Q(host_avi_tags__contains=[user_avitag]) |
            Q(registrations__student_avi_tag=user_avitag)
        )
        serializer = self.get_serializer(events, many=True)
        return Response(serializer.data)

class EventRegistrationViewSet(viewsets.ModelViewSet):
    queryset = EventRegistration.objects.all()
    serializer_class = EventRegistrationSerializer
    permission_classes = [permissions.IsAuthenticated, IsRegistrationOwnerOrEventHost]

    def perform_create(self, serializer):
        # Check if event is in the future
        event = serializer.validated_data['event']
        if event.event_date <= timezone.now():
            raise serializers.ValidationError(
                "Cannot register for past events"
            )
        
        serializer.save(student_avi_tag=self.request.user.profile.avitag)

    @action(detail=False, methods=['get'])
    def by_event(self, request, event_id=None):
        """Get all registrations for an event"""
        registrations = self.queryset.filter(event_id=event_id)
        serializer = self.get_serializer(registrations, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_student(self, request, avi_tag=None):
        """Get all events a student has registered for"""
        registrations = self.queryset.filter(student_avi_tag=avi_tag)
        serializer = self.get_serializer(registrations, many=True)
        return Response(serializer.data) 