from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MajorViewSet

router = DefaultRouter()
router.register(r'', MajorViewSet)

urlpatterns = [
    path('', include(router.urls)),
] 