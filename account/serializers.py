from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from .models import Account, AuthProvider, AccountStatus, AdminProfile, KompanyProfile, StudentProfile, SchoolProfile, KreatorProfile, Profile, Waitlist
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


class AccountSerializer(serializers.ModelSerializer):
    """Serializer for account profile"""
    profile_type = serializers.CharField(source='get_profile_type_display', read_only=True)
    
    class Meta:
        model = Account
        fields = ('account_id', 'email', 'first_name', 'last_name', 'profile_type', 
                  'auth_provider', 'is_otp_verified', 'account_status', 'created_at', 
                  'updated_at', 'last_login')
        read_only_fields = ['account_id', 'auth_provider', 'is_otp_verified', 
                            'account_status', 'created_at', 'last_login']


class StudentProfileSerializer(serializers.ModelSerializer):
    account = AccountSerializer(read_only=True)
    avitag = serializers.SerializerMethodField()
    profile_picture = serializers.SerializerMethodField()
    hobbies = serializers.SerializerMethodField()
    campus_tag = serializers.SerializerMethodField()
    major_tag = serializers.SerializerMethodField()
    level = serializers.SerializerMethodField()
    degree = serializers.SerializerMethodField()
    is_verified = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = [
            'account',
            'avitag',
            'profile_picture',
            'school',
            'department',
            'graduation_year',
            'student_id',
            'bio',
            'hobbies',
            'campus_tag',
            'major_tag',
            'level',
            'degree',
            'is_verified',
            'status',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['account', 'avitag', 'created_at', 'updated_at']

    def get_profile(self, obj):
        """Get the base Profile model instance"""
        try:
            return Profile.objects.get(account_id=obj.account.account_id)
        except Profile.DoesNotExist:
            return None

    def get_avitag(self, obj):
        """Get the avitag from the Profile model"""
        profile = self.get_profile(obj)
        return profile.avitag if profile else None

    def get_profile_picture(self, obj):
        """Get the profile picture URL from the Profile model"""
        profile = self.get_profile(obj)
        if profile and profile.profile_picture:
            return profile.profile_picture.url
        return None

    def get_hobbies(self, obj):
        """Get hobbies from the Profile model"""
        profile = self.get_profile(obj)
        return profile.hobbies_list if profile and hasattr(profile, 'hobbies_list') else []

    def get_campus_tag(self, obj):
        """Get campus_tag from the Profile model"""
        profile = self.get_profile(obj)
        return profile.campus_tag if profile else None

    def get_major_tag(self, obj):
        """Get major_tag from the Profile model"""
        profile = self.get_profile(obj)
        return profile.major_tag if profile else None

    def get_level(self, obj):
        """Get level from the Profile model"""
        profile = self.get_profile(obj)
        return profile.level if profile else None

    def get_degree(self, obj):
        """Get degree from the Profile model"""
        profile = self.get_profile(obj)
        return profile.degree if profile else None

    def get_is_verified(self, obj):
        """Get is_verified from the Profile model"""
        profile = self.get_profile(obj)
        return profile.is_verified if profile else False

    def get_status(self, obj):
        """Get status from the Profile model"""
        profile = self.get_profile(obj)
        return profile.status if profile else None


class AdminProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['avitag', 'account_id', 'profile_type', 'is_verified', 
                 'status', 'created_at', 'updated_at']
        read_only_fields = ['avitag', 'account_id', 'is_verified', 
                          'status', 'created_at', 'updated_at']
        ref_name = "AccountAdminProfile"


class KompanyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = KompanyProfile
        exclude = ('account',)


class BaseProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['avitag', 'account_id', 'profile_type', 'is_verified', 
                 'status', 'created_at', 'updated_at']
        read_only_fields = ['avitag', 'account_id', 'is_verified', 
                          'status', 'created_at', 'updated_at']


class SchoolProfileSerializer(BaseProfileSerializer):
    class Meta(BaseProfileSerializer.Meta):
        fields = BaseProfileSerializer.Meta.fields + [
            'display_name', 'description', 'campus_tag',
            'logo', 'website'
        ]


class KreatorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = KreatorProfile
        exclude = ('account',)


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
    first_name = serializers.CharField(source='account.first_name', required=False)
    last_name = serializers.CharField(source='account.last_name', required=False)
    campus_tag = serializers.CharField(required=False)
    major_tag = serializers.CharField(required=False)
    level = serializers.IntegerField(required=False)
    degree = serializers.ChoiceField(choices=Profile.DEGREE_CHOICES, required=False)
    bio = serializers.CharField(required=False)
    hobbies = serializers.ListField(child=serializers.CharField(), required=False)

    class Meta:
        model = StudentProfile
        fields = [
            'first_name',
            'last_name',
            'campus_tag',
            'major_tag',
            'level',
            'degree',
            'school',
            'department',
            'graduation_year',
            'student_id',
            'bio',
            'hobbies'
        ]

    def validate_level(self, value):
        if value not in dict(Profile.LEVEL_CHOICES).keys():
            raise serializers.ValidationError("Invalid level")
        return value

    def update(self, instance, validated_data):
        # Update account fields
        account_data = validated_data.pop('account', {})
        if account_data:
            account = instance.account
            for attr, value in account_data.items():
                setattr(account, attr, value)
            account.save()

        # Update profile fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        return instance


class UpdateSchoolProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolProfile
        exclude = ('account', 'created_at', 'updated_at', 'verified')


class UpdateKreatorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = KreatorProfile
        exclude = ('account', 'created_at', 'updated_at', 'verified')


class ProfilePictureSerializer(serializers.ModelSerializer):
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ['profile_picture']

    def get_profile_picture(self, obj):
        """Get the full Cloudinary URL for the profile picture"""
        if obj.profile_picture:
            # Get the full URL from Cloudinary
            return obj.profile_picture.url
        return None


class ProfileSerializer(serializers.ModelSerializer):
    hobbies = serializers.ListField(child=serializers.CharField(), required=False)

    class Meta:
        model = Profile
        fields = '__all__'

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['hobbies'] = instance.hobbies_list
        return data

    def to_internal_value(self, data):
        if 'hobbies' in data:
            data['hobbies'] = ','.join(data['hobbies'])
        return super().to_internal_value(data)


class WaitlistSerializer(serializers.ModelSerializer):
    """Serializer for waitlist entries"""
    full_name = serializers.CharField(write_only=True, required=True)
    university_name = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = Waitlist
        fields = ['waitlist_id', 'full_name', 'university_name', 'email', 
                 'created_at', 'is_approved', 'approved_at']
        read_only_fields = ['waitlist_id', 'created_at', 'is_approved', 'approved_at']

    def validate_email(self, value):
        """Validate that email is not already in waitlist or registered"""
        if Waitlist.objects.filter(email=value).exists():
            raise serializers.ValidationError("This email is already on the waitlist.")
        if Account.objects.filter(email=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value

    def validate_full_name(self, value):
        """Validate full name format"""
        if len(value.split()) < 2:
            raise serializers.ValidationError("Please provide both first and last name.")
        return value

    def create(self, validated_data):
        """Create a new waitlist entry"""
        # Split full name into first and last name
        full_name = validated_data.pop('full_name')
        name_parts = full_name.split()
        first_name = name_parts[0]
        last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
        
        # Create waitlist entry
        return Waitlist.objects.create(
            first_name=first_name,
            last_name=last_name,
            email=validated_data['email'],
            university=validated_data['university_name']
        )