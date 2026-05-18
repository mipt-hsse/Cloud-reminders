from django.contrib import admin
from django.urls import path, include
from . import views

urlpatterns = [
    # Аутентификация
    path("login/", views.TemplateLoginView.as_view(), name="login_page"),
    path("logout/", views.TemplateLogoutView.as_view(), name="logout_page"),
    path("register/", views.TemplateRegisterView.as_view(), name="register_page"),
    path("auth/yandex/login/", views.yandex_login, name="yandex_login"),
    path("auth/yandex/callback/", views.yandex_callback, name="yandex_callback"),
    # Профиль пользователя
    path("profile/avatar/", views.AvatarUpdateView.as_view(), name="avatar_api"),
    path("profile/", views.ProfileView.as_view(), name="profile_page"),
    path("profile/update/", views.update_user_profile, name="update_profile"),
    # Верификация
    path(
        "verify/email/<str:uidb64>/<str:token>/",
        views.VerifyEmailView.as_view(),
        name="verify_email",
    ),
]
