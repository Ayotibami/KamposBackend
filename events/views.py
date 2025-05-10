from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from .models import Event, EventRegistration
from .serializers import EventSerializer, EventRegistrationSerializer
from .permissions import IsEventHostOrReadOnly, IsRegistrationOwnerOrEventHost
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Event.objects.none()
        return super().get_queryset()

    def perform_create(self, serializer):
        serializer.save()

    @swagger_auto_schema(
        operation_description="Get upcoming events",
        responses={
            200: EventSerializer(many=True),
            401: "Unauthorized"
        },
        security=[{'Bearer': []}]
    )
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        if getattr(self, 'swagger_fake_view', False):
            return Response([])
        events = self.queryset.filter(event_date__gt=timezone.now())
        serializer = self.get_serializer(events, many=True)
        return Response(serializer.data)

    @swagger_auto_schema(
        operation_description="Get events where user is host or registered",
        responses={
            200: EventSerializer(many=True),
            401: "Unauthorized"
        }
    )
    @action(detail=False, methods=['get'])
    def my_events(self, request):
        """Get events where user is host or registered"""
        if getattr(self, 'swagger_fake_view', False):
            return Response([])
            
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
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return EventRegistration.objects.none()
        return EventRegistration.objects.filter(
            student_avi_tag=self.request.user.profile.avitag
        )

    @swagger_auto_schema(
        operation_description="List event registrations",
        responses={
            200: EventRegistrationSerializer(many=True),
            401: "Unauthorized"
        },
        security=[{'Bearer': []}]
    )
    def list(self, request, *args, **kwargs):
        if getattr(self, 'swagger_fake_view', False):
            return Response([])
        return super().list(request, *args, **kwargs)

    @swagger_auto_schema(
        operation_description="Create a new event registration",
        request_body=EventRegistrationSerializer,
        responses={
            201: EventRegistrationSerializer,
            400: "Bad Request",
            401: "Unauthorized"
        }
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @swagger_auto_schema(
        operation_description="Retrieve a specific event registration",
        responses={
            200: EventRegistrationSerializer,
            404: "Not Found",
            401: "Unauthorized"
        }
    )
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @swagger_auto_schema(
        operation_description="Update an event registration",
        request_body=EventRegistrationSerializer,
        responses={
            200: EventRegistrationSerializer,
            400: "Bad Request",
            401: "Unauthorized",
            404: "Not Found"
        }
    )
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @swagger_auto_schema(
        operation_description="Partially update an event registration",
        request_body=EventRegistrationSerializer,
        responses={
            200: EventRegistrationSerializer,
            400: "Bad Request",
            401: "Unauthorized",
            404: "Not Found"
        }
    )
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @swagger_auto_schema(
        operation_description="Delete an event registration",
        responses={
            204: "No Content",
            401: "Unauthorized",
            404: "Not Found"
        }
    )
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        # Check if event is in the future
        event = serializer.validated_data['event']
        if event.event_date <= timezone.now():
            raise serializers.ValidationError(
                "Cannot register for past events"
            )
        
        serializer.save(student_avi_tag=self.request.user.profile.avitag)

    @swagger_auto_schema(
        operation_description="Get all registrations for an event",
        manual_parameters=[
            openapi.Parameter(
                'event_id',
                openapi.IN_QUERY,
                description="Event ID to filter registrations",
                type=openapi.TYPE_INTEGER,
                required=True
            )
        ],
        responses={
            200: EventRegistrationSerializer(many=True),
            401: "Unauthorized",
            400: "Bad Request"
        }
    )
    @action(detail=False, methods=['get'])
    def by_event(self, request):
        """Get all registrations for an event"""
        event_id = request.query_params.get('event_id')
        if not event_id:
            return Response(
                {"error": "event_id parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        registrations = self.queryset.filter(event_id=event_id)
        serializer = self.get_serializer(registrations, many=True)
        return Response(serializer.data)

    @swagger_auto_schema(
        operation_description="Get all events a student has registered for",
        manual_parameters=[
            openapi.Parameter(
                'avi_tag',
                openapi.IN_QUERY,
                description="Student's AVI tag to filter registrations",
                type=openapi.TYPE_STRING,
                required=True
            )
        ],
        responses={
            200: EventRegistrationSerializer(many=True),
            401: "Unauthorized",
            400: "Bad Request"
        }
    )
    @action(detail=False, methods=['get'])
    def by_student(self, request):
        """Get all events a student has registered for"""
        avi_tag = request.query_params.get('avi_tag')
        if not avi_tag:
            return Response(
                {"error": "avi_tag parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        registrations = self.queryset.filter(student_avi_tag=avi_tag)
        serializer = self.get_serializer(registrations, many=True)
        return Response(serializer.data) 