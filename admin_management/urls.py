from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminProfileViewSet

router = DefaultRouter()
router.register(r'profiles', AdminProfileViewSet)

urlpatterns = [
    path('', include(router.urls)),
] 