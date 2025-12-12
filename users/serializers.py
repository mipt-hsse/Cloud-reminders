from rest_framework import serializers

# from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from .models import CustomUser


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = CustomUser  # Измените на CustomUser
        fields = (
            "username",
            "email",
            "password",
            "password2",
            "first_name",
            "last_name",
        )

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )

        if CustomUser.objects.filter(username=attrs["username"]).exists():
            raise serializers.ValidationError({"username": "Username already exists."})

        if CustomUser.objects.filter(email=attrs["email"]).exists():
            raise serializers.ValidationError({"email": "Email already exists."})

        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        user = CustomUser.objects.create_user(**validated_data)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser  # Измените на CustomUser
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "avatar",
            "avatar_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_avatar_url(self, obj):
        if obj.avatar and hasattr(obj.avatar, "url"):
            return obj.avatar.url
        return ""


class AvatarUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ("avatar",)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password2"]:
            raise serializers.ValidationError(
                {"new_password": "Password fields didn't match."}
            )
        return attrs


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()
