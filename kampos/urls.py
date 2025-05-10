"""
kampos URL Configuration
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework import permissions

# Schema view for Swagger documentation
schema_view = get_schema_view(
    openapi.Info(
        title="Kampos API",
        default_version='v1',
        description="API documentation for Kampos college social platform",
        terms_of_service="https://www.kampos.com/terms/",
        contact=openapi.Contact(email="support@kampos.com"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API endpoints
    path('api/', include('account.urls')),
    path('api/events/', include('events.urls')),
    path('api/kompany/', include('kompany.urls')),
    path('api/kreator/', include('kreator.urls')),
    path('api/admin/', include('admin_management.urls')),
    path('api/campus/', include('campus.urls')),
    path('api/major/', include('major.urls')),
    
    # Swagger documentation
    re_path(r'^swagger(?P<format>\.json|\.yaml)$', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) 