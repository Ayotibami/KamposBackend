from rest_framework import permissions

class IsGistOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the owner of the gist
        return obj.avitag == request.user.profile.avitag

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.profile.is_admin if hasattr(request.user, 'profile') else False