import os
import requests

from django.views import View

from django.shortcuts import render, redirect
from django.urls import reverse
from django.core.mail import send_mail
from django.http import JsonResponse
from django.conf import settings

from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required

from django.utils.decorators import method_decorator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str

from rest_framework.response import Response
from rest_framework import generics, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser


from .models import CustomUser
from .serializers import AvatarUpdateSerializer


class VerifyEmailView(View):
    def get(self, request, uidb64, token):
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = CustomUser.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, CustomUser.DoesNotExist):
            user = None

        if user is not None and default_token_generator.check_token(user, token):
            user.is_active = True
            user.save()
            login(request, user)
            return redirect("dashboard_page")
        else:
            return render(
                request,
                "app/dashboard_v2.html",
                {"error": "Ссылка для подтверждения недействительна или устарела."},
            )


class TemplateLoginView(View):
    def get(self, request):
        if request.user.is_authenticated:
            return redirect("dashboard_page")
        return render(request, "app/dashboard_v2.html")

    def post(self, request):
        username = request.POST.get("username")
        password = request.POST.get("password")

        is_ajax = request.headers.get("x-requested-with") == "XMLHttpRequest"
        try:
            user_check = CustomUser.objects.get(username=username)

            if user_check.check_password(password) and not user_check.is_active:
                error_msg = "Почта не подтверждена. Проверьте ваш email и перейдите по ссылке из письма."

                if is_ajax:
                    return JsonResponse({"success": False, "error": error_msg})

                return render(
                    request,
                    "app/dashboard_v2.html",
                    {"error": error_msg, "login_data": {"username": username}},
                )

        except CustomUser.DoesNotExist:
            # Если такого пользователя вообще нет, идем дальше к стандартной ошибке
            pass

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            if is_ajax:
                return JsonResponse({"success": True})
            return redirect("dashboard_page")
        else:
            error_msg = "Неверный логин или пароль"
            if is_ajax:
                return JsonResponse({"success": False, "error": error_msg})

            return render(
                request,
                "app/dashboard_v2.html",
                {
                    "error": error_msg,
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

        is_ajax = request.headers.get("x-requested-with") == "XMLHttpRequest"

        username = request.POST.get("username", "").strip()
        email = request.POST.get("email", "").strip()
        password = request.POST.get("password")

        password2 = request.POST.get("password2")
        if password2 and password != password2:
            error_msg = "Пароли не совпадают"
            if is_ajax:
                return JsonResponse({"success": False, "error": error_msg})
            return render(request, "app/dashboard_v2.html", {"error": error_msg})

        if CustomUser.objects.filter(username=username).exists():
            error_msg = "Пользователь с таким логином уже существует"
            if is_ajax:
                return JsonResponse({"success": False, "error": error_msg})
            return render(request, "app/dashboard_v2.html", {"error": error_msg})

        if CustomUser.objects.filter(email=email).exists():
            error_msg = "Пользователь с таким email уже существует"
            if is_ajax:
                return JsonResponse({"success": False, "error": error_msg})
            return render(request, "app/dashboard_v2.html", {"error": error_msg})

        try:
            user = CustomUser.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=request.POST.get("first_name", ""),
                last_name=request.POST.get("last_name", ""),
            )
            user.is_active = False
            user.save()

            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            relative_url = reverse(
                "verify_email", kwargs={"uidb64": uid, "token": token}
            )
            verify_url = request.build_absolute_uri(relative_url)

            send_mail(
                subject="Подтверждение регистрации CloudReminders",
                message=f"Привет, {user.username}!\n\nПожалуйста, перейдите по ссылке, чтобы подтвердить вашу почту:\n{verify_url}\n\nЕсли это были не вы, просто проигнорируйте письмо.",
                from_email=None,
                recipient_list=[user.email],
                fail_silently=False,
            )

            if is_ajax:
                return JsonResponse(
                    {
                        "success": True,
                        "message": "Письмо с подтверждением отправлено на вашу почту!",
                    }
                )
            return redirect("dashboard_page")

        except Exception as e:
            error_msg = f"Ошибка при создании пользователя: {str(e)}"
            if is_ajax:
                return JsonResponse({"success": False, "error": error_msg})
            return render(request, "app/dashboard_v2.html", {"error": error_msg})


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

        if "username" in request.data:
            user.username = request.data["username"]
        if "email" in request.data:
            user.email = request.data["email"]
        if "first_name" in request.data:
            user.first_name = request.data["first_name"]
        if "last_name" in request.data:
            user.last_name = request.data["last_name"]

        if "avatar" in request.FILES:
            avatar_file = request.FILES["avatar"]

            FIVE_MB_IN_BITES = 5 * 1024 * 1024
            if avatar_file.size > FIVE_MB_IN_BITES:
                return Response(
                    {"error": "File size too large. Maximum 5MB allowed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
            if avatar_file.content_type not in allowed_types:
                return Response(
                    {"error": "Invalid file type. Allowed: JPEG, PNG, GIF, WEBP"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if user.avatar and user.avatar.name != "avatars/default_avatar.png":
                old_avatar_path = user.avatar.path
                import os

                if os.path.exists(old_avatar_path):
                    os.remove(old_avatar_path)

            user.avatar = avatar_file

        user.save()

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


def yandex_login(request):
    client_id = settings.YANDEX_CLIENT_ID
    redirect_uri = request.build_absolute_uri("/user/auth/yandex/callback/")

    url = f"https://oauth.yandex.ru/authorize?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}"
    return redirect(url)


def yandex_callback(request):
    code = request.GET.get("code")
    if not code:
        return redirect("login_page")

    token_url = "https://oauth.yandex.ru/token"
    token_data = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": settings.YANDEX_CLIENT_ID,
        "client_secret": settings.YANDEX_CLIENT_SECRET,
        "redirect_uri": request.build_absolute_uri("/user/auth/yandex/callback/"),
    }
    token_response = requests.post(token_url, data=token_data).json()
    access_token = token_response.get("access_token")

    if not access_token:
        return redirect("login_page")

    info_url = "https://login.yandex.ru/info?format=json"
    headers = {"Authorization": f"OAuth {access_token}"}
    info_response = requests.get(info_url, headers=headers).json()

    email = info_response.get("default_email")
    username = info_response.get("login")
    first_name = info_response.get("first_name", "")
    last_name = info_response.get("last_name", "")

    if not email:
        email = f"{username}@yandex.ru"

    user = CustomUser.objects.filter(email=email).first()

    if not user:
        if CustomUser.objects.filter(username=username).exists():
            username = f"{username}_ya"

        user = CustomUser.objects.create(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            is_active=True,
        )
        user.set_unusable_password()
        user.save()

    login(request, user)
    return redirect("dashboard_page")
