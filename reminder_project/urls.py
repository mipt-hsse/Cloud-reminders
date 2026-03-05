from django.contrib import admin
from django.urls import path, include
from django.conf import settings
import users.views as views
import reminders

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("users.urls")),
    path("api/", include("reminders.urls")),
    # Frontend views
    path("", views.TemplateLoginView.as_view(), name="home_page"),
    path("login/", views.TemplateLoginView.as_view(), name="login_page"),
    path("register/", views.TemplateRegisterView.as_view(), name="register_page"),
    path("logout/", views.TemplateLogoutView.as_view(), name="logout_page"),
    path("dashboard/", reminders.views.dashboard_page, name="dashboard_page"),
    path("profile/", views.ProfileView.as_view(), name="profile_page"),
    # path("test", views.TestView.as_view(), name="test_page"),
    path("board/<int:board_id>/", reminders.views.board_page, name="board_page"),
]
