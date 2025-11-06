from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.shortcuts import get_object_or_404

from users.models import Group, GroupMembership, Board, Folder, Reminder
from .serializers import (
    GroupSerializer,
    GroupMembershipSerializer,
    BoardSerializer,
    FolderSerializer,
    ReminderSerializer,
)
from .permissions import (
    IsGroupMember,
    IsGroupAdmin,
    HasBoardAccess,
    HasFolderAccess,
    HasReminderAccess,
    CanEditBoard,
)
from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    Класс, который сохраняет аутентификацию по sessionid, но
    отключает внутреннюю проверку CSRF DRF, которая конфликтует в Docker/AJAX.
    """

    def enforce_csrf(self, request):
        # Если этот метод возвращает None, проверка CSRF не выполняется,
        # но аутентификация по сессии сохраняется.
        return


class GroupViewSet(viewsets.ModelViewSet):
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated]

    authentication_classes = [CsrfExemptSessionAuthentication]

    def get_queryset(self):
        """Используем прямую связь через groups_joined"""
        user = self.request.user
        return user.accessible_groups  # Используем property из модели

    def get_permissions(self):
        if self.action in ["update", "partial_update", "destroy"]:
            self.permission_classes = [IsAuthenticated, IsGroupAdmin]
        elif self.action in ["retrieve"]:
            self.permission_classes = [IsAuthenticated, IsGroupMember]
        return super().get_permissions()

    @action(detail=True, methods=["post"])
    def join(self, request, pk=None):
        """Вступление в публичную группу"""
        group = self.get_object()
        if not group.is_public:
            return Response(
                {"error": "Группа не публичная"}, status=status.HTTP_403_FORBIDDEN
            )

        membership = group.add_member(user=request.user, invited_by=request.user)

        serializer = GroupMembershipSerializer(membership)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def leave(self, request, pk=None):
        """Выход из группы"""
        group = self.get_object()

        if not request.user.is_group_member(group):
            return Response(
                {"error": "Вы не состоите в этой группе"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        group.remove_member(request.user)
        return Response({"message": "Вы вышли из группы"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get", "post"])
    def members(self, request, pk=None):
        """Управление участниками группы"""
        group = self.get_object()

        if request.method == "GET":
            # Используем прямую связь для получения участников
            members = group.memberships.all().select_related("user")
            serializer = GroupMembershipSerializer(members, many=True)
            return Response(serializer.data)

        elif request.method == "POST":
            # Добавление участника (только админы)
            if not request.user.is_group_admin(group):
                return Response(
                    {"error": "Только администраторы могут добавлять участников"},
                    status=status.HTTP_403_FORBIDDEN,
                )

            serializer = GroupMembershipSerializer(data=request.data)
            if serializer.is_valid():
                user_id = serializer.validated_data["user_id"]
                access_level = serializer.validated_data.get("access_level", "read")

                try:
                    from django.contrib.auth import get_user_model

                    User = get_user_model()
                    user = User.objects.get(id=user_id)

                    membership = group.add_member(
                        user=user, access_level=access_level, invited_by=request.user
                    )

                    result_serializer = GroupMembershipSerializer(membership)
                    return Response(
                        result_serializer.data, status=status.HTTP_201_CREATED
                    )

                except User.DoesNotExist:
                    return Response(
                        {"error": "Пользователь не найден"},
                        status=status.HTTP_404_NOT_FOUND,
                    )

            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BoardViewSet(viewsets.ModelViewSet):
    serializer_class = BoardSerializer
    permission_classes = [IsAuthenticated, HasBoardAccess]

    authentication_classes = [CsrfExemptSessionAuthentication]

    def get_queryset(self):
        """Используем оптимизированный метод из модели пользователя"""
        return self.request.user.get_user_boards()

    def get_permissions(self):
        if self.action in ["update", "partial_update", "destroy"]:
            self.permission_classes = [IsAuthenticated, HasBoardAccess, CanEditBoard]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class FolderViewSet(viewsets.ModelViewSet):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated, HasFolderAccess]

    def get_queryset(self):
        user = self.request.user

        # Используем оптимизированный метод для получения досок
        accessible_boards = user.get_user_boards()
        return Folder.objects.filter(board__in=accessible_boards)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ReminderViewSet(viewsets.ModelViewSet):
    serializer_class = ReminderSerializer
    permission_classes = [IsAuthenticated, HasReminderAccess]

    authentication_classes = [CsrfExemptSessionAuthentication]

    def get_queryset(self):
        user = self.request.user

        # Используем оптимизированный метод для получения досок
        accessible_boards = user.get_user_boards()
        accessible_folders = Folder.objects.filter(board__in=accessible_boards)
        return Reminder.objects.filter(folder__in=accessible_folders)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
