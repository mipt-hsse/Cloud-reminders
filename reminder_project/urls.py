from django.contrib import admin
from django.urls import path, include
from django.conf import settings
import users.views as views
import reminders

urlpatterns = [
    path("admin/", admin.site.urls),
    path("user/", include("users.urls")),
    path("api/", include("reminders.urls")),
    # Frontend views
    path("", views.TemplateLoginView.as_view(), name="home_page"),
    path("dashboard/", reminders.views.dashboard_page, name="dashboard_page"),
    path("board/<int:board_id>/", reminders.views.board_page, name="board_page"),
    path(
        "board/join/<str:token>/", reminders.views.join_board_by_link, name="join_board"
    ),
    path(
        "api/board/<int:board_id>/add_collaborator/",
        reminders.views.add_board_collaborator,
        name="add_board_collaborator",
    ),
]
