from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import KompanyViewSet

router = DefaultRouter()
router.register(r'kompany', KompanyViewSet)

urlpatterns = [
    path('', include(router.urls)),
] 