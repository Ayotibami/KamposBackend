from rest_framework import permissions

class IsEventHostOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions only for event hosts
        return request.user.profile.avitag in obj.host_avi_tags

class IsRegistrationOwnerOrEventHost(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        user_avitag = request.user.profile.avitag
        # Allow if user is the registration owner or event host
        return (user_avitag == obj.student_avi_tag or 
                user_avitag in obj.event.host_avi_tags) 