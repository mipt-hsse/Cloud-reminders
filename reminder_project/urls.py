"""
URL configuration for reminder_project project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
import reminders
import users.views as user_views
import reminders.views as reminder_views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("users.urls")),
    path("api/", include("reminders.urls")),

    # === ГЛАВНАЯ СТРАНИЦА И ЛОГИН ===
    # Мы направляем пустой путь и /login/ на твою универсальную функцию,
    # которая сама решит: показать лендинг или доски пользователя.
    path("", reminder_views.login_page, name="home_page"),
    path("login/", reminder_views.login_page, name="login_page"),

    # === ОСТАЛЬНЫЕ СТРАНИЦЫ ===
    path("register/", user_views.TemplateRegisterView.as_view(), name="register_page"),
    path("logout/", reminder_views.logout_page, name="logout_page"), # Используем твой новый logout
    
    # Путь /dashboard/ теперь по сути дублирует главную, но пусть будет для совместимости
    path("dashboard/", reminder_views.login_page, name="dashboard_page"),
    
    path("profile/", user_views.ProfileView.as_view(), name="profile_page"),
    path("board/<int:board_id>/", reminder_views.board_page, name="board_page"),
    
    path("test/", user_views.TestView.as_view(), name="test_page"),
]
# Обслуживание медиафайлов в разработке
# if settings.DEBUG:
#     urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
#     urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
