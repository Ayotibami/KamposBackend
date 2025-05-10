from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import KreatorViewSet

router = DefaultRouter()
router.register(r'', KreatorViewSet)

urlpatterns = [
    path('', include(router.urls)),
] 