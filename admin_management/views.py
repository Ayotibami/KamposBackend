from rest_framework import viewsets, permissions
from .models import AdminProfile
from .serializers import AdminProfileSerializer
from account.permissions import IsAdminUser

class AdminProfileViewSet(viewsets.ModelViewSet):
    queryset = AdminProfile.objects.all()
    serializer_class = AdminProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser] 