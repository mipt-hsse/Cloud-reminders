from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    create_reminder_api,
    save_board_api,
    delete_reminder_api,
    create_board_api,
    update_board_api,
    delete_board_api,
    login_page,
    logout_page
)

urlpatterns = [
    path("reminders/create/", create_reminder_api, name="create_reminder"),
    path("save_board/", save_board_api, name="save_board"),
    path("", login_page, name="dashboard_page"),
    path("reminders/delete/", delete_reminder_api, name="delete_reminder_api"),
    path("create_board/", create_board_api, name="create_board_api"),
    path("update_board/", update_board_api, name="update_board_api"),
    path("delete_board/", delete_board_api, name="delete_board_api"),
    path("login/", login_page, name="login_page"),
    path('register/', login_page, name='register_page'),
    path('logout/', logout_page, name='logout_page'),
]
