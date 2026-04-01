from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    create_reminder_api,
    save_board_api,
    delete_reminder_api,
    create_board_api,
    update_board_api,
    delete_board_api,
    get_share_links_api,
    join_board_view,
)

urlpatterns = [
    path("create_reminder/", create_reminder_api, name="create_reminder_api"),
    path("save_board/", save_board_api, name="save_board_api"),
    path("delete_reminder/", delete_reminder_api, name="delete_reminder_api"),
    path("create_board/", create_board_api, name="create_board_api"),
    path("update_board/", update_board_api, name="update_board_api"),
    path("delete_board/", delete_board_api, name="delete_board_api"),
    path(
        "board/<int:board_id>/share_links/",
        get_share_links_api,
        name="get_share_links",
    ),
]
