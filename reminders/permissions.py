from rest_framework import permissions
from .models import Group, Board, Folder, Reminder


class IsGroupMember(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Group):
            return obj.user_is_member(request.user)
        return False


class IsGroupAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Group):
            return obj.user_is_admin(request.user)
        return False


class HasBoardAccess(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Board):
            return obj.user_has_access(request.user)
        return False


class HasFolderAccess(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Folder):
            return obj.user_has_access(request.user)
        return False


class HasReminderAccess(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Reminder):
            return obj.user_has_access(request.user)
        return False


class CanEditBoard(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Board):
            access_level = obj.user_access_level(request.user)
            return access_level in ["write", "admin"]
        return False


class IsGroupOwner(permissions.BasePermission):
    """Разрешает доступ только создателю группы"""

    def has_object_permission(self, request, view, obj):
        return obj.created_by == request.user
