from django.shortcuts import render, redirect
from django.views import View
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import CustomUser
from .serializers import (
    RegisterSerializer,
    UserProfileSerializer,
    LoginSerializer,
    AvatarUpdateSerializer,
)
from rest_framework.parsers import MultiPartParser, FormParser
import os


# API Views
class RegisterView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Автоматически логиним пользователя после регистрации
        login(request, user)

        return Response(
            {
                "user": UserProfileSerializer(user).data,
                "message": "Registration successful",
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return Response(
                {
                    "user": UserProfileSerializer(user).data,
                    "message": "Login successful",
                }
            )
        else:
            return Response(
                {"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
            )


class LogoutView(View):
    def post(self, request):
        logout(request)
        # request.session.flush()
        return redirect("login_page")


class UserProfileView(generics.UpdateAPIView):
    serializer_class = AvatarUpdateSerializer
    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser)

    def get_object(self):
        return self.request.user


class AvatarUpdateView(generics.UpdateAPIView):
    serializer_class = AvatarUpdateSerializer
    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser)

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        user = self.get_object()

        # Удаляем старый аватар если он не дефолтный
        if user.avatar and user.avatar.name != "avatars/default_avatar.png":
            old_avatar_path = user.avatar.path
            if os.path.exists(old_avatar_path):
                os.remove(old_avatar_path)

        serializer = self.get_serializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {"message": "Avatar updated successfully", "avatar_url": user.avatar.url}
        )


# Template Views
class TemplateLoginView(View):
    def get(self, request):
        if request.user.is_authenticated:
            return redirect("dashboard_page")
        return render(request, "auth/login.html")

    def post(self, request):
        username = request.POST.get("username")
        password = request.POST.get("password")

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return redirect("dashboard_page")
        else:
            return render(
                request, "auth/login.html", {"error": "Invalid username or password"}
            )


class TemplateLogoutView(View):
    def post(self, request):
        logout(request)
        # request.session.flush()
        return redirect("login_page")


@method_decorator(login_required, name="dispatch")
class DashboardView(View):
    def get(self, request):
        return render(request, "app/dashboard.html", {"user": request.user})


@method_decorator(login_required, name="dispatch")
class ProfileView(View):
    def get(self, request):
        return render(request, "profile/profile.html", {"user": request.user})

    def post(self, request):
        # Обработка обновления профиля
        user = request.user
        user.first_name = request.POST.get("first_name", "")
        user.last_name = request.POST.get("last_name", "")
        user.email = request.POST.get("email", "")
        user.save()

        # Обработка загрузки аватара
        if "avatar" in request.FILES:
            avatar_file = request.FILES["avatar"]
            # Проверяем размер файла (макс 5MB)
            if avatar_file.size > 5 * 1024 * 1024:
                return render(
                    request,
                    "profile/profile.html",
                    {
                        "user": user,
                        "error": "File size too large. Maximum 5MB allowed.",
                    },
                )

            # Проверяем тип файла
            allowed_types = ["image/jpeg", "image/png", "image/gif"]
            if avatar_file.content_type not in allowed_types:
                return render(
                    request,
                    "profile/profile.html",
                    {
                        "user": user,
                        "error": "Invalid file type. Allowed: JPEG, PNG, GIF",
                    },
                )

            user.avatar = avatar_file
            user.save()

        return render(
            request,
            "profile/profile.html",
            {"user": user, "success": "Profile updated successfully!"},
        )
