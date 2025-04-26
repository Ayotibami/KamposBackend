from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from .models import Account, AuthProvider, AccountStatus


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    
    class Meta:
        model = Account
        fields = ['email', 'password', 'confirm_password']
    
    def validate(self, attrs):
        if attrs.get('password') != attrs.get('confirm_password'):
            raise serializers.ValidationError({"confirm_password": "Password fields didn't match."})
        
        try:
            validate_password(attrs.get('password'))
        except ValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        
        account = Account.objects.create(
            email=validated_data['email'],
            auth_provider=AuthProvider.EMAIL,
        )
        account.set_password(password)
        account.save()
        
        # Generate OTP for email verification
        account.generate_and_save_otp()
        
        return account


class LoginSerializer(serializers.Serializer):
    """Serializer for user login"""
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        try:
            account = Account.objects.get(email=email)
        except Account.DoesNotExist:
            raise serializers.ValidationError({"email": "Account with this email does not exist."})
        
        if account.account_status != AccountStatus.ACTIVE:
            raise serializers.ValidationError({"email": "This account is not active."})
            
        if not account.check_password(password):
            raise serializers.ValidationError({"password": "Incorrect password."})
        
        # Save validated account to use in view
        attrs['account'] = account
        return attrs


class OAuthLoginSerializer(serializers.Serializer):
    """Serializer for OAuth login"""
    auth_provider = serializers.ChoiceField(
        choices=AuthProvider.choices,
        required=True
    )
    oauth_token = serializers.CharField(required=True)
    oauth_id = serializers.CharField(required=True)
    email = serializers.EmailField(required=True)


class VerifyOTPSerializer(serializers.Serializer):
    """Serializer for OTP verification"""
    email = serializers.EmailField(required=True)
    otp = serializers.CharField(required=True, min_length=6, max_length=6)


class ForgotPasswordSerializer(serializers.Serializer):
    """Serializer for forgot password requests"""
    email = serializers.EmailField(required=True)


class ResetPasswordSerializer(serializers.Serializer):
    """Serializer for password reset"""
    token = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    
    def validate(self, attrs):
        if attrs.get('password') != attrs.get('confirm_password'):
            raise serializers.ValidationError({"confirm_password": "Password fields didn't match."})
        
        try:
            validate_password(attrs.get('password'))
        except ValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        
        return attrs


class AccountSerializer(serializers.ModelSerializer):
    """Serializer for account profile"""
    
    class Meta:
        model = Account
        fields = ['account_id', 'email', 'auth_provider', 'is_otp_verified', 
                  'account_status', 'created_at', 'last_login']
        read_only_fields = ['account_id', 'auth_provider', 'is_otp_verified', 
                            'account_status', 'created_at', 'last_login']


class UpdateAccountSerializer(serializers.ModelSerializer):
    """Serializer for updating account information"""
    
    class Meta:
        model = Account
        fields = ['email']
        

class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing password"""
    current_password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    new_password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    confirm_new_password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    
    def validate(self, attrs):
        if attrs.get('new_password') != attrs.get('confirm_new_password'):
            raise serializers.ValidationError({"confirm_new_password": "Password fields didn't match."})
        
        try:
            validate_password(attrs.get('new_password'))
        except ValidationError as e:
            raise serializers.ValidationError({"new_password": list(e.messages)})
        
        return attrs


class FirebaseAuthSerializer(serializers.Serializer):
    """Serializer for Firebase authentication"""
    id_token = serializers.CharField(required=True)

    def validate(self, attrs):
        id_token = attrs.get('id_token')
        try:
            from .utils import verify_firebase_token, get_firebase_user_info
            decoded_token = verify_firebase_token(id_token)
            firebase_uid = decoded_token['uid']
            return {'firebase_uid': firebase_uid, 'decoded_token': decoded_token}
        except Exception as e:
            raise serializers.ValidationError(str(e))