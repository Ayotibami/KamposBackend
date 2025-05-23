from django.utils.translation import gettext_lazy as _
from rest_framework import authentication, exceptions
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.utils.functional import SimpleLazyObject
from django.contrib.auth.middleware import get_user
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
import jwt

class CustomJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication class that verifies account status
    """
    
    def __init__(self):
        super().__init__()
        self.user_id_claim = 'user_id'

    def get_user_id(self, validated_token):
        return validated_token.get(self.user_id_claim)

    def get_user(self, validated_token):
        from .models import Account  # Import here to avoid circular import
        user_id = self.get_user_id(validated_token)
        try:
            return Account.objects.get(account_id=user_id)  # Use account_id instead of id
        except Account.DoesNotExist:
            return None

    def authenticate(self, request):
        try:
            header = self.get_header(request)
            if header is None:
                return None

            raw_token = self.get_raw_token(header)
            if raw_token is None:
                return None

            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
            
            if user is None:
                return None
                
            return user, validated_token
        except (InvalidToken, TokenError) as e:
            raise AuthenticationFailed(str(e))


class AuthenticationMiddleware(MiddlewareMixin):
    """
    Middleware to attach the authenticated user to the request
    """
    
    def __init__(self, get_response):
        super().__init__(get_response)
        self.authentication_class = CustomJWTAuthentication()
    
    def process_request(self, request):
        request.user = SimpleLazyObject(lambda: self.__class__.get_jwt_user(request))

    @staticmethod
    def get_jwt_user(request):
        user = get_user(request)
        if user.is_authenticated:
            return user

        try:
            if 'HTTP_AUTHORIZATION' in request.META:
                auth_header = request.META['HTTP_AUTHORIZATION'].split()
                if len(auth_header) == 2 and auth_header[0].lower() == 'bearer':
                    token = auth_header[1]
                    decoded_token = jwt.decode(
                        token,
                        settings.SECRET_KEY,
                        algorithms=['HS256']
                    )
                    user_id = decoded_token.get('user_id')
                    if user_id:
                        from .models import Account  # Import here to avoid circular import
                        return Account.objects.get(account_id=user_id)  # Use account_id instead of id
        except (jwt.InvalidTokenError, Exception):
            pass

        return user