from rest_framework import viewsets, permissions
from .models import Kompany
from .serializers import KompanySerializer
from account.permissions import IsProfileOwnerOrAdmin

class KompanyViewSet(viewsets.ModelViewSet):
    queryset = Kompany.objects.all()
    serializer_class = KompanySerializer
    permission_classes = [permissions.IsAuthenticated, IsProfileOwnerOrAdmin] 