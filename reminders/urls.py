from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GroupViewSet, BoardViewSet, FolderViewSet, ReminderViewSet

router = DefaultRouter()
router.register(r"groups", GroupViewSet, basename="group")
router.register(r"boards", BoardViewSet, basename="board")
router.register(r"folders", FolderViewSet, basename="folder")
router.register(r"reminders", ReminderViewSet, basename="reminder")

urlpatterns = [
    path("", include(router.urls)),
]
