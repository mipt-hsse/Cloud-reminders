from django.shortcuts import render, redirect
from django.views import View
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from rest_framework import generics, permissions, status
from django.http import JsonResponse
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
        # serializer.is_valid(raise_exception=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
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
        return render(request, "app/dashboard_v2.html")

    def post(self, request):
        username = request.POST.get("username")
        password = request.POST.get("password")

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return redirect("dashboard_page")
        else:
            return render(
                request,
                "app/dashboard_v2.html",
                {
                    "error": "Invalid username or password",
                    "login_data": {"username": username},
                },
            )


class TemplateRegisterView(View):
    def get(self, request):
        if request.user.is_authenticated:
            return redirect("dashboard_page")
        return render(request, "app/dashboard_v2.html")

    def post(self, request):
        if request.user.is_authenticated:
            return redirect("dashboard_page")

        username = request.POST.get("username", "").strip()
        email = request.POST.get("email", "").strip()
        password = request.POST.get("password")
        password2 = request.POST.get("password2")
        first_name = request.POST.get("first_name", "")
        last_name = request.POST.get("last_name", "")

        # Валидация
        if password != password2:
            return render(
                request,
                "app/dashboard_v2.html",
                {"error": "Пароли не совпадают", "register_data": request.POST},
            )

        if CustomUser.objects.filter(username=username).exists():
            return render(
                request,
                "app/dashboard_v2.html",
                {
                    "error": "Пользователь с таким именем уже существует",
                    "register_data": request.POST,
                },
            )

        if CustomUser.objects.filter(email=email).exists():
            return render(
                request,
                "app/dashboard_v2.html",
                {
                    "error": "Пользователь с таким email уже существует",
                    "register_data": request.POST,
                },
            )

        # Создание пользователя
        try:
            user = CustomUser.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
            )
            login(request, user)
            return redirect("dashboard_page")

        except Exception as e:
            return render(
                request,
                "app/dashboard_v2.html",
                {
                    "error": f"Ошибка при создании пользователя: {str(e)}",
                    "register_data": request.POST,
                },
            )


class TemplateLogoutView(View):
    def post(self, request):
        logout(request)
        # request.session.flush()
        return redirect("login_page")

    def get(self, request):
        if request.user.is_authenticated:
            logout(request)
            # request.session.flush()
        return redirect("login_page")


class TestView(View):
    def get(self, request):
        return render(request, "1base.html", {"user": request.user})


@method_decorator(login_required, name="dispatch")
class ProfileView(View):
    def get(self, request):
        return render(request, "profile/profile.html", {"user": request.user})

    def post(self, request):
        # Обработка AJAX запросов
        if request.headers.get("X-Requested-With") == "XMLHttpRequest":
            return self.handle_ajax_request(request)
        else:
            return self.handle_regular_request(request)

    def handle_ajax_request(self, request):
        """Обработка AJAX запросов"""
        try:
            user = request.user

            # Обновляем текстовые поля
            user.first_name = request.POST.get("first_name", "")
            user.last_name = request.POST.get("last_name", "")
            user.email = request.POST.get("email", "")
            user.username = request.POST.get("username", "")

            # Обработка загрузки аватара
            avatar_url = None
            if "avatar" in request.FILES:
                avatar_file = request.FILES["avatar"]

                # Проверки размера и типа файла
                if avatar_file.size > 5 * 1024 * 1024:
                    return JsonResponse(
                        {
                            "success": False,
                            "error": "File size too large. Maximum 5MB allowed.",
                        },
                        status=400,
                    )

                allowed_types = ["image/jpeg", "image/png", "image/gif"]
                if avatar_file.content_type not in allowed_types:
                    return JsonResponse(
                        {
                            "success": False,
                            "error": "Invalid file type. Allowed: JPEG, PNG, GIF",
                        },
                        status=400,
                    )

                # Удаляем старый аватар
                if user.avatar and user.avatar.name != "avatars/default_avatar.png":
                    old_avatar_path = user.avatar.path
                    if os.path.exists(old_avatar_path):
                        os.remove(old_avatar_path)

                user.avatar = avatar_file

            user.save()

            # Получаем URL аватара
            if user.avatar:
                avatar_url = user.avatar.url

            return JsonResponse(
                {
                    "success": True,
                    "message": "Profile updated successfully",
                    "user": {
                        "username": user.username,
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "avatar_url": avatar_url,
                    },
                }
            )

        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)}, status=400)

    def handle_regular_request(self, request):
        """Обработка обычных HTML запросов"""
        user = request.user
        user.first_name = request.POST.get("first_name", "")
        user.last_name = request.POST.get("last_name", "")
        user.email = request.POST.get("email", "")
        user.save()

        # Обработка загрузки аватара
        if "avatar" in request.FILES:
            avatar_file = request.FILES["avatar"]
            if avatar_file.size > 5 * 1024 * 1024:
                return render(
                    request,
                    "profile/profile.html",
                    {
                        "user": user,
                        "error": "File size too large. Maximum 5MB allowed.",
                    },
                )

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


from rest_framework.decorators import api_view, permission_classes


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def update_user_profile(request):
    """API endpoint для обновления профиля пользователя"""
    try:
        user = request.user

        # Обновляем текстовые поля
        if "username" in request.data:
            user.username = request.data["username"]
        if "email" in request.data:
            user.email = request.data["email"]
        if "first_name" in request.data:
            user.first_name = request.data["first_name"]
        if "last_name" in request.data:
            user.last_name = request.data["last_name"]

        # Обрабатываем загрузку аватара
        if "avatar" in request.FILES:
            avatar_file = request.FILES["avatar"]

            # Проверяем размер файла (макс 5MB)
            if avatar_file.size > 5 * 1024 * 1024:
                return Response(
                    {"error": "File size too large. Maximum 5MB allowed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Проверяем тип файла
            allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
            if avatar_file.content_type not in allowed_types:
                return Response(
                    {"error": "Invalid file type. Allowed: JPEG, PNG, GIF, WEBP"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Удаляем старый аватар если он не дефолтный
            if user.avatar and user.avatar.name != "avatars/default_avatar.png":
                old_avatar_path = user.avatar.path
                import os

                if os.path.exists(old_avatar_path):
                    os.remove(old_avatar_path)

            user.avatar = avatar_file

        user.save()

        # Возвращаем обновленные данные пользователя
        user_data = {
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "avatar_url": user.avatar.url if user.avatar else None,
        }

        return Response(
            {
                "success": True,
                "message": "Profile updated successfully",
                "user": user_data,
            }
        )

    except Exception as e:
        return Response(
            {"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST
        )
