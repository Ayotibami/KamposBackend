from rest_framework import viewsets, permissions
from .models import Kreator
from .serializers import KreatorSerializer
from account.permissions import IsProfileOwnerOrAdmin

class KreatorViewSet(viewsets.ModelViewSet):
    queryset = Kreator.objects.all()
    serializer_class = KreatorSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfileOwnerOrAdmin] 