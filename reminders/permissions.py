from rest_framework import permissions
from .models import Group, GroupMembership, Board, BoardItem


class IsGroupMember(permissions.BasePermission):
    """
    Проверяет, является ли пользователь участником группы.
    """

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Group):
            # Проверяем наличие записи в таблице связей
            return obj.memberships.filter(user=request.user).exists()
        return False


class IsGroupAdmin(permissions.BasePermission):
    """
    Проверяет, является ли пользователь администратором группы.
    """

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Group):
            # Проверяем уровень доступа напрямую через ORM
            return obj.memberships.filter(
                user=request.user, access_level=GroupMembership.AccessLevel.ADMIN
            ).exists()
        return False


class HasBoardAccess(permissions.BasePermission):
    """
    Проверяет доступ к доске (через владельца или группу).
    Использует метод модели Board.user_has_access.
    """

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Board):
            return obj.user_has_access(request.user)
        return False


class HasBoardItemAccess(permissions.BasePermission):
    """
    НОВЫЙ КЛАСС: Заменяет HasFolderAccess и HasReminderAccess.
    Проверяет доступ к элементу через доступ к его доске.
    """

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, BoardItem):
            # Если есть доступ к доске -> есть доступ к элементу
            return obj.board.user_has_access(request.user)
        return False


class CanEditBoard(permissions.BasePermission):
    """
    Разрешает редактирование только владельцам или участникам группы с правами WRITE/ADMIN.
    """

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Board):
            # 1. Владелец всегда может редактировать
            if obj.created_by == request.user:
                return True

            # 2. Если доска в группе, проверяем права в группе
            if obj.group:
                # Получаем уровень доступа
                access_level = obj.user_access_level(request.user)
                # Разрешаем, если уровень WRITE или ADMIN
                return access_level in [
                    GroupMembership.AccessLevel.WRITE,
                    GroupMembership.AccessLevel.ADMIN,
                ]
        return False


class IsGroupOwner(permissions.BasePermission):
    """
    Разрешает доступ только создателю группы.
    """

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Group):
            return obj.created_by == request.user
        return False
