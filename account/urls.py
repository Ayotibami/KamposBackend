from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    RegisterView, LoginView, LogoutView, 
    VerifyOTPView, ForgotPasswordView, ResetPasswordView,
    AccountViewSet, FirebaseAuthView, ProfileUpdateView
)

router = DefaultRouter()
router.register(r'account', AccountViewSet, basename='account')

urlpatterns = [
    # Authentication endpoints
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('auth/forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('auth/reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('auth/firebase/', FirebaseAuthView.as_view(), name='firebase-auth'),
    
    # Account management endpoints are handled by the router
    path('', include(router.urls)),
    path('profile/update/', ProfileUpdateView.as_view(), name='profile_update'),
]