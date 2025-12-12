from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import create_reminder_api, save_board_api, delete_reminder_api

urlpatterns = [
    path("reminders/create/", create_reminder_api, name="create_reminder"),
    path("save_board/", save_board_api, name="save_board"),
    path("reminders/delete/", delete_reminder_api, name="delete_reminder_api"),
]
