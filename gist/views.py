from django.shortcuts import render
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Q
from .models import Gist, Comment, Media, Reaction, Report, View
from .serializers import (GistSerializer, CommentSerializer, 
                        MediaSerializer, ReactionSerializer,
                        ReportSerializer, ViewSerializer)
from .permissions import IsGistOwnerOrReadOnly, IsAdminUser
from cloudinary import uploader
from notifications.services import NotificationService

# Create your views here.

class GistViewSet(viewsets.ModelViewSet):
    queryset = Gist.objects.all()
    serializer_class = GistSerializer
    permission_classes = [permissions.IsAuthenticated, IsGistOwnerOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['gist_text']

    def perform_create(self, serializer):
        # Create gist
        gist = serializer.save(avitag=self.request.user.profile.avitag)
        
        # Handle media uploads if present
        media_files = self.request.FILES.getlist('media')
        for media_file in media_files:
            content_type = media_file.content_type
            media_type = 'image' if 'image' in content_type else 'video'
            
            media = Media.objects.create(
                entity_type='gist',
                entity_id=gist.gist_id,
                media_type=media_type,
                media_file=media_file
            )
            
            # Generate thumbnail for videos
            if media_type == 'video':
                # Cloudinary automatically generates thumbnails for videos
                media.thumbnail_url = media.media_file.build_url(
                    transformation=[
                        {'width': 200, 'height': 200, 'crop': 'thumb'},
                        {'resource_type': 'video'}
                    ]
                )
                media.save()

        # Trigger notifications for same major/institution
        NotificationService.notify_same_major_gist(gist, self.request.user.profile)
        NotificationService.notify_same_institution_gist(gist, self.request.user.profile)

    def perform_update(self, serializer):
        # Update gist and handle edited_at
        serializer.save(edited_at=timezone.now())

    @action(detail=True, methods=['post'])
    def report(self, request, pk=None):
        """Report a gist"""
        gist = self.get_object()
        gist.is_reported = True
        gist.save()
        return Response({'status': 'gist reported'})

    @action(detail=False, methods=['get'])
    def user_gists(self, request, avi_tag=None):
        """Get all gists for a specific user"""
        gists = self.queryset.filter(avitag=avi_tag)
        page = self.paginate_queryset(gists)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=['get'])
    def trending(self, request):
        """Get trending gists based on recent reactions and comments"""
        # Get gists from the last 7 days
        recent_date = timezone.now() - timezone.timedelta(days=7)
        
        gists = Gist.objects.filter(
            Q(created_at__gte=recent_date) |
            Q(reactions__created_at__gte=recent_date) |
            Q(comments__commented_at__gte=recent_date)
        ).annotate(
            reaction_count=Count('reactions', distinct=True),
            comment_count=Count('comments', distinct=True),
            engagement_score=Count('reactions') + Count('comments') * 2  # Comments weighted more
        ).order_by('-engagement_score', '-created_at')[:10]
        
        serializer = self.get_serializer(gists, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def reported(self, request):
        """Get all reported gists (admin only)"""
        if not request.user.profile.is_admin:
            return Response(
                {'error': 'Not authorized'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        reported_gists = self.queryset.filter(is_reported=True)
        serializer = self.get_serializer(reported_gists, many=True)
        return Response(serializer.data)

class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        comment = serializer.save(avitag=self.request.user.profile.avitag)
        # Trigger notification for gist owner
        NotificationService.notify_gist_comment(comment.gist, self.request.user.profile.avitag)

    def get_permissions(self):
        """Allow only comment owners to update/delete"""
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsGistOwnerOrReadOnly()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def by_gist(self, request):
        """Get all comments for a specific gist"""
        gist_id = request.query_params.get('gist_id')
        comments = self.queryset.filter(gist_id=gist_id)
        page = self.paginate_queryset(comments)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_user(self, request, avi_tag=None):
        """Get all comments by a specific user"""
        comments = self.queryset.filter(avitag=avi_tag)
        page = self.paginate_queryset(comments)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

class MediaViewSet(viewsets.ModelViewSet):
    queryset = Media.objects.all()
    serializer_class = MediaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        media_file = self.request.FILES.get('media_file')
        content_type = media_file.content_type
        media_type = 'image' if 'image' in content_type else 'video'
        
        # Upload to Cloudinary with optimizations
        upload_options = {
            'resource_type': 'auto',
            'folder': f'kampos/{media_type}s',
        }
        
        if media_type == 'image':
            upload_options.update({
                'transformation': [
                    {'quality': 'auto:good'},
                    {'fetch_format': 'auto'}
                ]
            })
        elif media_type == 'video':
            upload_options.update({
                'resource_type': 'video',
                'eager': [
                    {'width': 200, 'height': 200, 'crop': 'thumb'}
                ]
            })

        serializer.save(
            media_type=media_type,
            uploaded_at=timezone.now()
        )

    def perform_update(self, serializer):
        serializer.save(edited_at=timezone.now())

    @action(detail=False, methods=['get'])
    def by_entity(self, request):
        """Get all media for a specific entity"""
        entity_type = request.query_params.get('entity_type')
        entity_id = request.query_params.get('entity_id')
        media = self.queryset.filter(
            entity_type=entity_type,
            entity_id=entity_id
        )
        serializer = self.get_serializer(media, many=True)
        return Response(serializer.data)

class ReactionViewSet(viewsets.ModelViewSet):
    queryset = Reaction.objects.all()
    serializer_class = ReactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        """Create or toggle a reaction"""
        data = request.data
        avitag = request.user.profile.avitag
        
        try:
            reaction = Reaction.objects.get(
                avitag=avitag,
                entity_type=data['entity_type'],
                entity_id=data['entity_id']
            )
            
            # If same reaction type, remove it (toggle off)
            if reaction.type == data['type']:
                reaction.delete()
                return Response(
                    {'status': 'reaction removed'},
                    status=status.HTTP_204_NO_CONTENT
                )
            
            # If different reaction type, update it
            reaction.type = data['type']
            reaction.save()
            
        except Reaction.DoesNotExist:
            # Create new reaction
            reaction = Reaction.objects.create(
                avitag=avitag,
                entity_type=data['entity_type'],
                entity_id=data['entity_id'],
                type=data['type']
            )
        
        serializer = self.get_serializer(reaction)
        response = Response(serializer.data)
        if response.status_code == status.HTTP_201_CREATED:
            # Trigger notification for gist owner
            reaction = self.get_queryset().get(pk=response.data['reaction_id'])
            if reaction.entity_type == 'GIST':
                gist = Gist.objects.get(gist_id=reaction.entity_id)
                NotificationService.notify_gist_reaction(
                    gist, 
                    self.request.user.profile.avitag,
                    reaction.type
                )
        return response

    @action(detail=False, methods=['get'])
    def by_entity(self, request):
        """Get all reactions for a specific entity"""
        entity_type = request.query_params.get('entity_type')
        entity_id = request.query_params.get('entity_id')
        reactions = self.queryset.filter(
            entity_type=entity_type,
            entity_id=entity_id
        )
        serializer = self.get_serializer(reactions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_user(self, request, avi_tag=None):
        """Get all reactions by a specific user"""
        reactions = self.queryset.filter(avitag=avi_tag)
        serializer = self.get_serializer(reactions, many=True)
        return Response(serializer.data)

class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.all()
    serializer_class = ReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        """
        Create/List: Any authenticated user
        Update/Delete: Admin only
        """
        if self.action in ['update', 'partial_update', 'destroy', 'list']:
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user.profile.avitag)

    @action(detail=True, methods=['put'])
    def review(self, request, pk=None):
        """Admin review of report"""
        if not request.user.profile.is_admin:
            return Response(
                {'error': 'Only admins can review reports'},
                status=status.HTTP_403_FORBIDDEN
            )

        report = self.get_object()
        status_update = request.data.get('status')
        action_taken = request.data.get('action_taken')

        if status_update not in ['REVIEWED', 'ACTION_TAKEN', 'DISMISSED']:
            return Response(
                {'error': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        report.status = status_update
        report.action_taken = action_taken
        report.reviewed_by = request.user.profile.avitag
        report.reviewed_at = timezone.now()
        report.save()

        return Response(self.get_serializer(report).data)

    @action(detail=False, methods=['get'])
    def by_user(self, request, avi_tag=None):
        """Get all reports submitted by a user"""
        reports = self.queryset.filter(reported_by=avi_tag)
        serializer = self.get_serializer(reports, many=True)
        return Response(serializer.data)

class ViewViewSet(viewsets.ModelViewSet):
    queryset = View.objects.all()
    serializer_class = ViewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        """Create or update view"""
        gist_id = request.data.get('gist')
        avi_tag = request.user.profile.avitag

        # Update or create view
        view, created = View.objects.get_or_create(
            gist_id=gist_id,
            avi_tag=avi_tag,
            defaults={'viewed_at': timezone.now()}
        )

        if not created:
            # Update viewed_at time for existing view
            view.viewed_at = timezone.now()
            view.save()

        serializer = self.get_serializer(view)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def by_gist(self, request, gist_id=None):
        """Get all views for a specific gist"""
        views = self.queryset.filter(gist_id=gist_id)
        serializer = self.get_serializer(views, many=True)
        return Response(serializer.data)
