from django.utils.translation import gettext_lazy as _
from rest_framework import authentication, exceptions
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from .choices import AccountStatus


class CustomJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication class that verifies account status
    """
    
    def get_user(self, validated_token):
        """
        Attempt to find and return a user using the given validated token.
        """
        try:
            user_id = validated_token[self.user_id_claim]
        except KeyError:
            raise InvalidToken(_('Token contained no recognizable user identification'))

        try:
            from .models import Account  # Import here to avoid circular import
            user = Account.objects.get(**{self.user_id_field: user_id})
        except Account.DoesNotExist:
            raise AuthenticationFailed(_('User not found'), code='user_not_found')

        # Check if the account is active
        if user.account_status != AccountStatus.ACTIVE:
            raise AuthenticationFailed(_('User account is not active'), code='user_inactive')

        return user


class AuthenticationMiddleware:
    """
    Middleware to attach the authenticated user to the request
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.authentication_class = CustomJWTAuthentication()
    
    def __call__(self, request):
        # Attempt to authenticate
        if 'Authorization' in request.headers:
            try:
                user_auth_tuple = self.authentication_class.authenticate(request)
                if user_auth_tuple is not None:
                    request.user, request.auth = user_auth_tuple
            except (exceptions.AuthenticationFailed, InvalidToken, TokenError):
                # If authentication fails, continue as unauthenticated
                pass
        
        response = self.get_response(request)
        return response