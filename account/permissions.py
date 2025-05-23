"""
Custom permissions for the account app
"""
from rest_framework import permissions
from account.models import Profile, ProfileType


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


class IsProfileOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        try:
            # Get the Profile model instance for the requesting user
            user_profile = Profile.objects.get(account_id=request.user.account_id)
            
            # Get the Profile model instance for the object being accessed
            if hasattr(obj, 'account'):
                obj_profile = Profile.objects.get(account_id=obj.account.account_id)
            else:
                # If obj is already a Profile instance
                obj_profile = obj
                
            # Check if the user is the owner or an admin
            return (obj_profile.avitag == user_profile.avitag or
                    request.user.profile_type == ProfileType.ADMIN)
        except Profile.DoesNotExist:
            return False


class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.profile.is_admin if hasattr(request.user, 'profile') else False