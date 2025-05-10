from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GistViewSet, CommentViewSet, MediaViewSet, ReactionViewSet, ReportViewSet, ViewViewSet

router = DefaultRouter()
router.register(r'gists', GistViewSet, basename='gist')
router.register(r'comments', CommentViewSet, basename='comment')
router.register(r'media', MediaViewSet, basename='media')
router.register(r'reactions', ReactionViewSet, basename='reaction')
router.register(r'reports', ReportViewSet, basename='report')
router.register(r'views', ViewViewSet, basename='view')

urlpatterns = [
    path('', include(router.urls)),
    path('gists/user/<str:avi_tag>/', GistViewSet.as_view({'get': 'user_gists'}), name='user-gists'),
    path('gists/trending/', GistViewSet.as_view({'get': 'trending'}), name='trending-gists'),
    path('comments/gist/<uuid:gist_id>/', CommentViewSet.as_view({'get': 'by_gist'}), name='gist-comments'),
    path('media/entity/<str:entity_type>/<uuid:entity_id>/', MediaViewSet.as_view({'get': 'by_entity'}), name='entity-media'),
    path('reports/user/<str:avi_tag>/', 
         ReportViewSet.as_view({'get': 'by_user'}), name='user-reports'),
    path('views/gist/<uuid:gist_id>/', 
         ViewViewSet.as_view({'get': 'by_gist'}), name='gist-views'),
]