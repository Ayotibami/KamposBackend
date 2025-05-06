from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from .models import Account, AuthProvider, AccountStatus, AdminProfile, KompanyProfile, StudentProfile, SchoolProfile, KreatorProfile
from .choices import ProfileType


class RegisterSerializer(serializers.Serializer):
    """Serializer for user registration"""
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)
    profile_type = serializers.ChoiceField(choices=ProfileType.choices, default=ProfileType.STUDENT)
    
    def validate_email(self, value):
        if Account.objects.filter(email=value).exists():
            raise serializers.ValidationError("Account with this email already exists.")
        return value


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
    email = serializers.EmailField(required=True)
    reset_code = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)


class AdminProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminProfile
        exclude = ('account',)


class KompanyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = KompanyProfile
        exclude = ('account',)


class StudentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentProfile
        exclude = ('account',)


class SchoolProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolProfile
        exclude = ('account',)


class KreatorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = KreatorProfile
        exclude = ('account',)


class AccountSerializer(serializers.ModelSerializer):
    """Serializer for account profile"""
    admin_profile = AdminProfileSerializer(read_only=True)
    kompany_profile = KompanyProfileSerializer(read_only=True)
    student_profile = StudentProfileSerializer(read_only=True)
    school_profile = SchoolProfileSerializer(read_only=True)
    kreator_profile = KreatorProfileSerializer(read_only=True)
    
    class Meta:
        model = Account
        fields = ('account_id', 'email', 'first_name', 'last_name', 'profile_type', 
                  'auth_provider', 'is_otp_verified', 'account_status', 'created_at', 
                  'updated_at', 'last_login', 'admin_profile', 'kompany_profile', 
                  'student_profile', 'school_profile', 'kreator_profile')
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


class UpdateAdminProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminProfile
        exclude = ('account', 'created_at', 'updated_at')


class UpdateKompanyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = KompanyProfile
        exclude = ('account', 'created_at', 'updated_at', 'verified')


class UpdateStudentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentProfile
        exclude = ('account', 'created_at', 'updated_at')


class UpdateSchoolProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolProfile
        exclude = ('account', 'created_at', 'updated_at', 'verified')


class UpdateKreatorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = KreatorProfile
        exclude = ('account', 'created_at', 'updated_at', 'verified')