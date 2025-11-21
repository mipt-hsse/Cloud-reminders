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
from django.conf.urls.static import static
import users.views as views
import reminders

from django.views.static import serve
from django.urls import re_path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("users.urls")),
    path("api/", include("reminders.urls")),
    # Frontend views
    path("", views.TemplateLoginView.as_view(), name="home_page"),
    path("login/", views.TemplateLoginView.as_view(), name="login_page"),
    path("logout/", views.TemplateLogoutView.as_view(), name="logout_page"),
    path("dashboard/", reminders.views.DashboardView.as_view(), name="dashboard_page"),
    path("profile/", views.ProfileView.as_view(), name="profile"),
    path("test", views.TestView.as_view(), name="test_page"),
]
# Обслуживание медиафайлов в разработке
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # Для production (осторожно - лучше использовать nginx для serving static files)
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            serve,
            {
                "document_root": settings.MEDIA_ROOT,
            },
        ),
        re_path(
            r"^static/(?P<path>.*)$",
            serve,
            {
                "document_root": settings.STATIC_ROOT,
            },
        ),
    ]
