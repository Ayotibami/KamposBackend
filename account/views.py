from django.conf import settings
from django.utils import timezone
from django.contrib.auth.tokens import default_token_generator
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
import requests
from django.contrib.auth.hashers import check_password, make_password
import pyotp
import logging
import uuid
import random

from core.utils import send_email_template, handle_oauth_google, handle_oauth_facebook, handle_oauth_apple, encrypt_token
from .models import Account, AccountStatus, AuthProvider, OAuthSession, AdminProfile, KompanyProfile, StudentProfile, SchoolProfile, KreatorProfile
from .permissions import IsAccountOwner
from .serializers import (
    RegisterSerializer, LoginSerializer, OAuthLoginSerializer,
    VerifyOTPSerializer, ForgotPasswordSerializer, ResetPasswordSerializer,
    AccountSerializer, UpdateAccountSerializer, ChangePasswordSerializer,
    FirebaseAuthSerializer, UpdateAdminProfileSerializer, UpdateKompanyProfileSerializer,
    UpdateStudentProfileSerializer, UpdateSchoolProfileSerializer, UpdateKreatorProfileSerializer
)
from .choices import ProfileType

# Get a logger for this module
logger = logging.getLogger(__name__)


def send_otp_email(email, otp):
    """
    Send OTP verification code to user's email
    """
    send_email_template(
        to_email=email,
        subject="Verify Your Kampos Account",
        template_name="verify_otp",
        context={
            "otp": otp,
            "expiry_minutes": settings.OTP_EXPIRY_MINUTES,
            "current_year": timezone.now().year
        }
    )


class RegisterView(APIView):
    """
    API view for user registration
    """
    permission_classes = [AllowAny]
    
    @swagger_auto_schema(
        request_body=RegisterSerializer,
        responses={201: 'Created', 400: 'Bad Request'}
    )
    def post(self, request):
        logger.info(f"Registration attempt for email: {request.data.get('email', 'unknown')}")
        
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(f"Registration validation failed: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            email = serializer.validated_data['email']
            password = serializer.validated_data['password']
            first_name = serializer.validated_data['first_name']
            last_name = serializer.validated_data['last_name']
            profile_type = serializer.validated_data.get('profile_type', ProfileType.STUDENT)
            
            # Create account
            account = Account.objects.create(
                email=email,
                password_hash=make_password(password),
                first_name=first_name,
                last_name=last_name,
                auth_provider=AuthProvider.EMAIL,
                profile_type=profile_type
            )
            
            # Create corresponding profile based on profile_type
            if profile_type == ProfileType.ADMIN:
                AdminProfile.objects.create(account=account)
            elif profile_type == ProfileType.KOMPANY:
                KompanyProfile.objects.create(account=account, company_name=f"{first_name} {last_name}'s Company")
            elif profile_type == ProfileType.STUDENT:
                StudentProfile.objects.create(account=account)
            elif profile_type == ProfileType.SCHOOL:
                SchoolProfile.objects.create(account=account, institution_name=f"{first_name} {last_name}'s Institution")
            elif profile_type == ProfileType.KREATOR:
                KreatorProfile.objects.create(account=account, creator_name=f"{first_name} {last_name}")
            
            # Generate OTP
            otp_secret = pyotp.random_base32()
            totp = pyotp.TOTP(otp_secret, interval=settings.OTP_EXPIRY_MINUTES * 60)
            otp = totp.now()
            
            # Log the OTP details for debugging
            logger.info(f"Generated OTP for {email}. OTP: {otp}, Secret: {otp_secret}, Interval: {settings.OTP_EXPIRY_MINUTES * 60}")
            
            # Save OTP to account
            account.otp_secret = otp_secret
            account.otp_created_at = timezone.now()
            account.save()
            
            # Send OTP email
            logger.info(f"Sending OTP email to {email} with OTP: {otp}")
            try:
                send_otp_email(email, otp)
                logger.info(f"OTP email sent successfully to {email}")
            except Exception as e:
                logger.error(f"Failed to send OTP email: {str(e)}")
                # Continue even if email fails - we'll log the OTP for development
            
            return Response({
                "message": "Account created successfully. Check your email for verification code.",
                "email": email,
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Registration failed: {str(e)}", exc_info=True)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LoginView(APIView):
    """
    API view for user login
    """
    permission_classes = [AllowAny]
    
    @swagger_auto_schema(
        request_body=LoginSerializer,
        responses={200: 'OK', 400: 'Bad Request', 401: 'Unauthorized'}
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        
        # Try to authenticate with Account model
        try:
            account = Account.objects.get(email=email)
            if not check_password(password, account.password_hash):
                return Response({"message": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        except Account.DoesNotExist:
            # Try Django's user model for superusers
            from django.contrib.auth import authenticate
            user = authenticate(username=email, password=password)
            if user is not None and user.is_superuser:
                # Create an Account for this superuser if it doesn't exist
                account, created = Account.objects.get_or_create(
                    email=email,
                    defaults={
                        'password_hash': make_password(password),
                        'auth_provider': AuthProvider.EMAIL,
                        'is_otp_verified': True
                    }
                )
            else:
                return Response({"message": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Update last login
        account.last_login = timezone.now()
        account.save()
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(account)
        
        return Response({
            "message": "Login successful",
            "token": {
                "refresh": str(refresh),
                "access": str(refresh.access_token)
            },
            "account": AccountSerializer(account).data
        })


class LogoutView(APIView):
    """
    API view for user logout
    """
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        responses={204: 'No Content'}
    )
    def post(self, request):
        # Blacklist the JWT token
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception:
            return Response(status=status.HTTP_204_NO_CONTENT)


class VerifyOTPView(APIView):
    """
    API view for OTP verification
    """
    permission_classes = [AllowAny]
    
    @swagger_auto_schema(
        request_body=VerifyOTPSerializer,
        responses={200: 'OK', 400: 'Bad Request'}
    )
    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        otp = serializer.validated_data['otp']
        
        try:
            account = Account.objects.get(email=email)
            
            # Log the OTP details for debugging
            logger.info(f"Verifying OTP for {email}. Provided OTP: {otp}, Stored secret: {account.otp_secret}, Created at: {account.otp_created_at}")
            
            # Check if OTP is expired
            if not account.otp_created_at or timezone.now() > account.otp_created_at + timezone.timedelta(minutes=settings.OTP_EXPIRY_MINUTES):
                logger.warning(f"OTP expired for {email}")
                return Response({"message": "OTP has expired. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Verify OTP
            totp = pyotp.TOTP(account.otp_secret, interval=settings.OTP_EXPIRY_MINUTES * 60)
            if totp.verify(otp, valid_window=1):  # Allow a window of 1 interval
                # Mark account as verified
                account.is_otp_verified = True
                account.save()
                
                # Generate JWT tokens
                refresh = RefreshToken()
                refresh['user_id'] = str(account.account_id)
                refresh['email'] = account.email
                
                logger.info(f"OTP verified successfully for {email}")
                return Response({
                    "message": "OTP verified successfully",
                    "token": {
                        "refresh": str(refresh),
                        "access": str(refresh.access_token)
                    },
                    "account": AccountSerializer(account).data
                })
            else:
                logger.warning(f"Invalid OTP for {email}")
                return Response({"message": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST)
                
        except Account.DoesNotExist:
            logger.warning(f"Account not found for email: {email}")
            return Response({"message": "Account not found"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"OTP verification failed: {str(e)}", exc_info=True)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ForgotPasswordView(APIView):
    """
    API view for forgot password requests
    """
    permission_classes = [AllowAny]
    
    @swagger_auto_schema(
        request_body=ForgotPasswordSerializer,
        responses={200: 'OK', 400: 'Bad Request'}
    )
    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        
        try:
            account = Account.objects.get(email=email)
            
            # Generate a 6-digit reset code
            reset_code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
            
            # Store the code with an expiry time
            account.reset_token = reset_code
            account.reset_token_created_at = timezone.now()
            account.save()
            
            # Send password reset email with code
            send_email_template(
                to_email=email,
                subject="Reset Your Kampos Password",
                template_name="reset_password_code",
                context={
                    "reset_code": reset_code,
                    "expiry_hours": 24,  # Code valid for 24 hours
                    "current_year": timezone.now().year
                }
            )
            
            logger.info(f"Password reset code sent to {email}: {reset_code}")
            
            # Don't reveal if the account exists or not for security
            return Response({
                "message": "If an account with this email exists, a password reset code has been sent."
            })
            
        except Account.DoesNotExist:
            # Don't reveal if the account exists or not for security
            logger.warning(f"Password reset requested for non-existent email: {email}")
            return Response({
                "message": "If an account with this email exists, a password reset code has been sent."
            })
        except Exception as e:
            logger.error(f"Password reset failed: {str(e)}", exc_info=True)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ResetPasswordView(APIView):
    """
    API view for resetting password using a verification code
    """
    permission_classes = [AllowAny]
    
    @swagger_auto_schema(
        request_body=ResetPasswordSerializer,
        responses={200: 'OK', 400: 'Bad Request'}
    )
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        reset_code = serializer.validated_data['reset_code']
        new_password = serializer.validated_data['new_password']
        
        try:
            account = Account.objects.get(email=email, reset_token=reset_code)
            
            # Check if code is expired (24 hours)
            if not account.reset_token_created_at or timezone.now() > account.reset_token_created_at + timezone.timedelta(hours=24):
                return Response({"message": "Password reset code has expired."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Update password
            account.password_hash = make_password(new_password)
            account.reset_token = None
            account.reset_token_created_at = None
            account.save()
            
            logger.info(f"Password reset successful for {email}")
            
            return Response({"message": "Password has been reset successfully."})
            
        except Account.DoesNotExist:
            logger.warning(f"Invalid password reset attempt for {email}")
            return Response({"message": "Invalid code or email."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Password reset failed: {str(e)}", exc_info=True)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AccountViewSet(viewsets.ModelViewSet):
    """
    ViewSet for account management
    """
    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'patch', 'delete']
    
    def get_queryset(self):
        # Check if this is a schema generation request
        if getattr(self, 'swagger_fake_view', False):
            # Return empty queryset for schema generation
            return Account.objects.none()
        
        # Normal request handling
        if self.request.user and hasattr(self.request.user, 'account_id'):
            return Account.objects.filter(account_id=self.request.user.account_id)
        return Account.objects.none()
    
    def get_object(self):
        return self.request.user
    
    @swagger_auto_schema(
        responses={200: AccountSerializer}
    )
    def retrieve(self, request, *args, **kwargs):
        """Get account profile"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @swagger_auto_schema(
        request_body=UpdateAccountSerializer,
        responses={200: AccountSerializer}
    )
    @action(detail=False, methods=['patch'], url_path='update')
    def update_account(self, request):
        """Update account details"""
        serializer = UpdateAccountSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(AccountSerializer(request.user).data)
    
    @swagger_auto_schema(
        request_body=ChangePasswordSerializer,
        responses={200: 'OK', 400: 'Bad Request'}
    )
    @action(detail=False, methods=['patch'], url_path='change-password')
    def change_password(self, request):
        """Change account password"""
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        account = request.user
        
        # Verify current password
        if not account.check_password(serializer.validated_data['current_password']):
            return Response({
                "current_password": ["Current password is incorrect"]
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Set new password
        account.set_password(serializer.validated_data['new_password'])
        
        return Response({
            "message": "Password changed successfully"
        })
    
    @swagger_auto_schema(
        responses={204: 'No Content'}
    )
    @action(detail=False, methods=['delete'], url_path='delete')
    def delete_account(self, request):
        """Soft delete account"""
        account = request.user
        account.delete_account()
        
        return Response(status=status.HTTP_204_NO_CONTENT)


class OAuthLoginView(APIView):
    """Handle OAuth login requests"""
    permission_classes = [AllowAny]
    
    @swagger_auto_schema(
        request_body=OAuthLoginSerializer,
        responses={200: AccountSerializer}
    )
    def post(self, request):
        serializer = OAuthLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        provider = serializer.validated_data['auth_provider']
        oauth_token = serializer.validated_data['oauth_token']
        
        # Get user info from OAuth provider
        if provider == AuthProvider.GOOGLE:
            user_info = handle_oauth_google(oauth_token)
        elif provider == AuthProvider.FACEBOOK:
            user_info = handle_oauth_facebook(oauth_token)
        elif provider == AuthProvider.APPLE:
            user_info = handle_oauth_apple(oauth_token)
        else:
            return Response({"error": "Invalid auth provider"}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        # Create or update account
        account, created = Account.objects.get_or_create(
            email=user_info['email'],
            defaults={
                'auth_provider': provider,
                'oauth_id': user_info['id'],
                'is_otp_verified': True,
                'account_status': AccountStatus.ACTIVE
            }
        )
        
        if not created:
            # Update existing account
            account.oauth_id = user_info['id']
            account.auth_provider = provider
            account.is_otp_verified = True
            account.save()
        
        # Generate JWT token
        refresh = RefreshToken.for_user(account)
        
        return Response({
            'token': {
                'access': str(refresh.access_token),
                'refresh': str(refresh)
            },
            'account': AccountSerializer(account).data
        })


class GoogleOAuthView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        # Get authorization code from frontend
        auth_code = request.data.get('code')
        
        if not auth_code:
            return Response({
                'error': 'Authorization code is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Exchange code for tokens
            token_endpoint = 'https://oauth2.googleapis.com/token'
            token_data = {
                'code': auth_code,
                'client_id': settings.OAUTH_CREDENTIALS['google']['client_id'],
                'client_secret': settings.OAUTH_CREDENTIALS['google']['client_secret'],
                'redirect_uri': settings.OAUTH_CREDENTIALS['google']['redirect_uri'],
                'grant_type': 'authorization_code'
            }
            
            token_response = requests.post(token_endpoint, data=token_data)
            token_response.raise_for_status()
            
            token_json = token_response.json()
            
            # Get user info using access token
            user_info = handle_oauth_google(token_json['id_token'])
            
            # Create or update account
            account, created = Account.objects.get_or_create(
                email=user_info['email'],
                defaults={
                    'auth_provider': AuthProvider.GOOGLE,
                    'oauth_id': user_info['id'],
                    'is_otp_verified': True,
                    'account_status': AccountStatus.ACTIVE
                }
            )
            
            # Store OAuth session if refresh token is provided
            if token_json.get('refresh_token'):
                OAuthSession.objects.update_or_create(
                    account=account,
                    auth_provider=AuthProvider.GOOGLE,
                    defaults={
                        'encrypted_refresh_token': encrypt_token(token_json['refresh_token']),
                        'token_expires_at': timezone.now() + timezone.timedelta(seconds=token_json['expires_in'])
                    }
                )
            
            # Generate JWT token
            refresh = RefreshToken.for_user(account)
            
            return Response({
                'token': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh)
                },
                'account': AccountSerializer(account).data
            })
            
        except requests.exceptions.RequestException as e:
            return Response({
                'error': f'OAuth error: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'error': f'Authentication failed: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)


class FirebaseAuthView(APIView):
    """
    API view for Firebase authentication
    """
    permission_classes = [AllowAny]
    
    @swagger_auto_schema(
        request_body=FirebaseAuthSerializer,
        responses={200: 'OK', 400: 'Bad Request', 401: 'Unauthorized'}
    )
    def post(self, request):
        serializer = FirebaseAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        firebase_uid = serializer.validated_data['firebase_uid']
        decoded_token = serializer.validated_data['decoded_token']
        
        try:
            account = Account.objects.get(firebase_uid=firebase_uid)
        except Account.DoesNotExist:
            # Get user info from Firebase
            from .utils import get_firebase_user_info
            firebase_user = get_firebase_user_info(firebase_uid)
            
            # Create new account
            account = Account.objects.create(
                email=firebase_user.email,
                firebase_uid=firebase_uid,
                auth_provider=AuthProvider.GOOGLE if 'google.com' in decoded_token.get('firebase', {}).get('sign_in_provider', '') else AuthProvider.EMAIL
            )
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(account)
        
        return Response({
            'token': {
                'access': str(refresh.access_token),
                'refresh': str(refresh)
            },
            'account': AccountSerializer(account).data
        })


class ProfileUpdateView(APIView):
    """
    API view for updating profile information
    """
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'profile_data': openapi.Schema(type=openapi.TYPE_OBJECT, description='Profile data')
            }
        ),
        responses={200: 'OK', 400: 'Bad Request', 401: 'Unauthorized'}
    )
    def patch(self, request):
        account = request.user
        profile_data = request.data.get('profile_data', {})
        
        try:
            # Get the appropriate serializer based on profile type
            if account.profile_type == ProfileType.ADMIN:
                profile = AdminProfile.objects.get(account=account)
                serializer = UpdateAdminProfileSerializer(profile, data=profile_data, partial=True)
            elif account.profile_type == ProfileType.KOMPANY:
                profile = KompanyProfile.objects.get(account=account)
                serializer = UpdateKompanyProfileSerializer(profile, data=profile_data, partial=True)
            elif account.profile_type == ProfileType.STUDENT:
                profile = StudentProfile.objects.get(account=account)
                serializer = UpdateStudentProfileSerializer(profile, data=profile_data, partial=True)
            elif account.profile_type == ProfileType.SCHOOL:
                profile = SchoolProfile.objects.get(account=account)
                serializer = UpdateSchoolProfileSerializer(profile, data=profile_data, partial=True)
            elif account.profile_type == ProfileType.KREATOR:
                profile = KreatorProfile.objects.get(account=account)
                serializer = UpdateKreatorProfileSerializer(profile, data=profile_data, partial=True)
            else:
                return Response({"message": "Invalid profile type"}, status=status.HTTP_400_BAD_REQUEST)
            
            if serializer.is_valid():
                serializer.save()
                # Return the updated account with profile
                return Response(AccountSerializer(account).data)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Profile update failed: {str(e)}", exc_info=True)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)