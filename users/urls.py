from django.contrib import admin
from django.urls import path, include
from . import views

urlpatterns = [
    # Аутентификация
    path("login/", views.TemplateLoginView.as_view(), name="login_api"),
    path("logout/", views.TemplateLogoutView.as_view(), name="logout_api"),
    path("register/", views.RegisterView.as_view(), name="register_api"),
    # Профиль пользователя
    path("profile/avatar/", views.AvatarUpdateView.as_view(), name="avatar_api"),
    path("profile/", views.UserProfileView.as_view(), name="profile_api"),
    # path('change-password/', views.change_password, name='change_password'),
]
