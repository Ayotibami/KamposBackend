"""
Custom permissions for the account app
"""
from rest_framework import permissions


class IsAuthenticatedOrCreateOnly(permissions.BasePermission):
    """
    Custom permission to allow authenticated users full access
    but allow anonymous users to create accounts
    """
    
    def has_permission(self, request, view):
        # Allow GET, PUT, DELETE for authenticated users
        if request.user and request.user.is_authenticated:
            return True
        
        # Allow POST for everyone (registration)
        if request.method == 'POST':
            return True
        
        return False


class IsAccountOwner(permissions.BasePermission):
    """
    Custom permission to only allow owners of an account to view or edit it
    """
    
    def has_object_permission(self, request, view, obj):
        # Check if the user is the owner of the account
        return obj.account_id == request.user.account_id