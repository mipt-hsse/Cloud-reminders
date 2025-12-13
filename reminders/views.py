from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count
from django.views import View
from django.utils.decorators import method_decorator
from django.utils.dateparse import parse_datetime
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from django.views.decorators.csrf import ensure_csrf_cookie
from django.shortcuts import get_object_or_404

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Group, GroupMembership, Board, Folder, Reminder
from users.models import CustomUser
from .serializers import (
    GroupSerializer,
    GroupCreateSerializer,
    GroupUpdateSerializer,
    GroupMembershipSerializer,
    BoardSerializer,
    BoardDetailSerializer,
    FolderSerializer,
    FolderDetailSerializer,
    ReminderSerializer,
)
from .permissions import (
    IsGroupMember,
    IsGroupAdmin,
    HasBoardAccess,
    HasFolderAccess,
    HasReminderAccess,
    CanEditBoard,
    IsGroupOwner,
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
    """
    ViewSet для управления группами с полным CRUD и дополнительными действиями
    """

    permission_classes = [IsAuthenticated]

    authentication_classes = [CsrfExemptSessionAuthentication]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["name", "description"]
    filterset_fields = ["is_public", "created_by"]
    ordering_fields = ["name", "created_at", "updated_at", "members_count"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        """Выбор сериализатора в зависимости от действия"""
        if self.action == "create":
            return GroupCreateSerializer
        elif self.action in ["update", "partial_update"]:
            return GroupUpdateSerializer
        return GroupSerializer

    def get_queryset(self):
        """Оптимизированный queryset с аннотациями"""
        user = self.request.user

        # Базовый queryset с аннотациями
        queryset = Group.objects.annotate(
            members_count=Count("members_direct", distinct=True),
            boards_count=Count("boards", distinct=True),
        )

        # Для действий join и retrieve - разрешаем доступ к публичным группам
        if self.action in ["join", "retrieve"]:
            return queryset.filter(
                Q(members_direct=user) | Q(is_public=True)
            ).distinct()

        # Для списка: группы пользователя + публичные группы
        elif self.action == "list":
            return queryset.filter(
                Q(members_direct=user) | Q(is_public=True)
            ).distinct()

        # Для поиска и публичных групп - все публичные + группы пользователя
        elif self.action in ["search", "public_groups", "available_to_join"]:
            return queryset.filter(
                Q(is_public=True) | Q(members_direct=user)
            ).distinct()

        # Для остальных действий: только группы где пользователь участник
        else:
            return queryset.filter(members_direct=user)

    def get_permissions(self):
        """Динамические permissions в зависимости от действия"""
        if self.action == "create":
            self.permission_classes = [IsAuthenticated]
        elif self.action in ["update", "partial_update"]:
            self.permission_classes = [IsAuthenticated, IsGroupAdmin]
        elif self.action == "destroy":
            self.permission_classes = [IsAuthenticated, IsGroupOwner]
        elif self.action in ["retrieve", "members", "leave", "my_membership"]:
            self.permission_classes = [IsAuthenticated, IsGroupMember]
        elif self.action in ["add_member", "remove_member", "update_member"]:
            self.permission_classes = [IsAuthenticated, IsGroupAdmin]
        # Для join разрешаем доступ всем аутентифицированным пользователям
        elif self.action == "join":
            self.permission_classes = [IsAuthenticated]

        return super().get_permissions()

    def perform_create(self, serializer):
        """Автоматически устанавливаем создателя группы"""
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        """Удаление группы с дополнительной проверкой"""
        group = self.get_object()

        # Дополнительная проверка что пользователь является создателем
        if group.created_by != request.user:
            return Response(
                {"error": "Только создатель группы может её удалить"},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def my_groups(self, request):
        """Только группы где пользователь является участником"""
        groups = self.get_queryset().filter(members_direct=request.user)

        page = self.paginate_queryset(groups)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(groups, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def public_groups(self, request):
        """Только публичные группы (без пагинации для выпадающих списков)"""
        groups = Group.objects.filter(is_public=True).annotate(
            members_count=Count("members_direct", distinct=True)
        )

        serializer = self.get_serializer(groups, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def owned_groups(self, request):
        """Группы созданные пользователем"""
        groups = self.get_queryset().filter(created_by=request.user)

        page = self.paginate_queryset(groups)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(groups, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def join(self, request, pk=None):
        """Вступление в публичную группу"""
        try:
            group = self.get_object()
        except Group.DoesNotExist:
            return Response(
                {"error": "Группа не найдена"}, status=status.HTTP_404_NOT_FOUND
            )

        # Дополнительная проверка в самом действии
        if not group.is_public:
            return Response(
                {
                    "error": "Эта группа не публичная. Запрос на вступление должен быть одобрен администратором."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if request.user.is_group_member(group):
            return Response(
                {"error": "Вы уже состоите в этой группе"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = group.add_member(
            user=request.user,
            access_level=Group.AccessLevel.READ,
            invited_by=request.user,
        )

        serializer = GroupMembershipSerializer(membership)
        return Response(
            {
                "message": "Вы успешно присоединились к группе",
                "membership": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def leave(self, request, pk=None):
        """Выход из группы"""
        group = self.get_object()

        if not request.user.is_group_member(group):
            return Response(
                {"error": "Вы не состоите в этой группе"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Не позволяем создателю покинуть группу
        if group.created_by == request.user:
            return Response(
                {
                    "error": "Создатель группы не может её покинуть. Передайте права или удалите группу."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        group.remove_member(request.user)
        return Response({"message": "Вы вышли из группы"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get", "post"])
    def members(self, request, pk=None):
        """Управление участниками группы"""
        group = self.get_object()

        if request.method == "GET":
            # Оптимизированный запрос с select_related
            members = group.memberships.all().select_related("user", "invited_by")

            # Фильтрация по уровню доступа
            access_level = request.query_params.get("access_level")
            if access_level:
                members = members.filter(access_level=access_level)

            serializer = GroupMembershipSerializer(members, many=True)
            return Response(serializer.data)

        elif request.method == "POST":
            return self._add_member(group, request)

    def _add_member(self, group, request):
        """Внутренний метод для добавления участника"""
        serializer = GroupMembershipSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user_id = serializer.validated_data["user_id"]
        access_level = serializer.validated_data.get(
            "access_level", Group.AccessLevel.READ
        )

        try:
            user = CustomUser.objects.get(id=user_id)

            # Проверяем что пользователь не уже в группе
            if user.is_group_member(group):
                return Response(
                    {"error": "Пользователь уже состоит в группе"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            membership = group.add_member(
                user=user, access_level=access_level, invited_by=request.user
            )

            result_serializer = GroupMembershipSerializer(membership)
            return Response(
                {
                    "message": "Пользователь успешно добавлен в группу",
                    "membership": result_serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )

        except CustomUser.DoesNotExist:
            return Response(
                {"error": "Пользователь не найден"},
                status=status.HTTP_404_NOT_FOUND,
            )

    @action(detail=True, methods=["post"])
    def add_member(self, request, pk=None):
        """Альтернативный endpoint для добавления участника"""
        group = self.get_object()
        return self._add_member(group, request)

    @action(detail=True, methods=["delete"])
    def remove_member(self, request, pk=None):
        """Удаление участника из группы"""
        group = self.get_object()

        user_id = request.data.get("user_id")
        if not user_id:
            return Response(
                {"error": "user_id обязателен"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = CustomUser.objects.get(id=user_id)

            if not user.is_group_member(group):
                return Response(
                    {"error": "Пользователь не состоит в этой группе"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Не позволяем удалить создателя
            if group.created_by == user:
                return Response(
                    {"error": "Нельзя удалить создателя группы"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            group.remove_member(user)
            return Response(
                {"message": "Пользователь удален из группы"}, status=status.HTTP_200_OK
            )

        except CustomUser.DoesNotExist:
            return Response(
                {"error": "Пользователь не найден"}, status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=["patch"])
    def update_member(self, request, pk=None):
        """Изменение уровня доступа участника"""
        group = self.get_object()

        user_id = request.data.get("user_id")
        access_level = request.data.get("access_level")

        if not user_id or not access_level:
            return Response(
                {"error": "user_id и access_level обязательны"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if access_level not in dict(Group.AccessLevel.choices):
            return Response(
                {"error": "Неверный уровень доступа"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = CustomUser.objects.get(id=user_id)
            membership = GroupMembership.objects.get(user=user, group=group)

            # Не позволяем изменить права создателю
            if group.created_by == user:
                return Response(
                    {"error": "Нельзя изменить права создателя группы"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            membership.access_level = access_level
            membership.save()

            serializer = GroupMembershipSerializer(membership)
            return Response(
                {
                    "message": "Уровень доступа пользователя обновлен",
                    "membership": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        except CustomUser.DoesNotExist:
            return Response(
                {"error": "Пользователь не найден"}, status=status.HTTP_404_NOT_FOUND
            )
        except GroupMembership.DoesNotExist:
            return Response(
                {"error": "Пользователь не состоит в этой группе"},
                status=status.HTTP_404_NOT_FOUND,
            )

    @action(detail=True, methods=["get"])
    def boards(self, request, pk=None):
        """Получение всех досок группы"""
        group = self.get_object()
        boards = group.boards.all().select_related("created_by")

        from .serializers import BoardSerializer

        serializer = BoardSerializer(boards, many=True, context={"request": request})

        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def my_membership(self, request, pk=None):
        """Получение информации о своем членстве в группе"""
        group = self.get_object()

        try:
            membership = GroupMembership.objects.get(user=request.user, group=group)
            serializer = GroupMembershipSerializer(membership)
            return Response(serializer.data)
        except GroupMembership.DoesNotExist:
            return Response(
                {"error": "Вы не состоите в этой группе"},
                status=status.HTTP_404_NOT_FOUND,
            )

    @action(detail=False, methods=["get"])
    def search(self, request):
        """Поиск групп по имени и описанию"""
        query = request.query_params.get("q", "")

        if not query:
            return Response(
                {"error": "Параметр поиска 'q' обязателен"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Ищем среди публичных групп и групп пользователя
        groups = (
            Group.objects.filter(
                Q(name__icontains=query) | Q(description__icontains=query),
                Q(is_public=True) | Q(members_direct=request.user),
            )
            .distinct()
            .annotate(members_count=Count("members_direct", distinct=True))
        )

        page = self.paginate_queryset(groups)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(groups, many=True)
        return Response(serializer.data)

    def get_serializer_class(self):
        if self.action == "create":
            return GroupCreateSerializer
        elif self.action in ["update", "partial_update"]:
            return GroupUpdateSerializer
        return GroupSerializer

    @action(detail=True, methods=["post"])
    def request_join(self, request, pk=None):
        """Запрос на вступление в приватную группу (для админов группы)"""
        group = self.get_object()

        if group.is_public:
            return Response(
                {"error": "Эта группа публичная. Используйте endpoint /join/"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.user.is_group_member(group):
            return Response(
                {"error": "Вы уже состоите в этой группе"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Здесь можно реализовать систему запросов на вступление
        # Пока просто возвращаем сообщение
        return Response(
            {
                "message": "Запрос на вступление отправлен администраторам группы. "
                "Они рассмотрят вашу заявку в ближайшее время."
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"])
    def join_requests(self, request, pk=None):
        """Получение запросов на вступление (только для админов)"""
        group = self.get_object()

        if not request.user.is_group_admin(group):
            return Response(
                {
                    "error": "Только администраторы могут просматривать запросы на вступление"
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Здесь можно вернуть список запросов на вступление
        # Пока возвращаем заглушку
        return Response(
            {"message": "Список запросов на вступление будет реализован в будущем"},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"])
    def available_to_join(self, request):
        """Группы в которые пользователь может вступить"""
        user = request.user

        # Группы которые публичные и в которых пользователь еще не состоит
        groups = (
            Group.objects.filter(is_public=True)
            .exclude(members_direct=user)
            .annotate(
                members_count=Count("members_direct", distinct=True),
                boards_count=Count("boards", distinct=True),
            )
        )

        page = self.paginate_queryset(groups)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(groups, many=True)
        return Response(serializer.data)


class BoardViewSet(viewsets.ModelViewSet):
    serializer_class = BoardSerializer
    permission_classes = [IsAuthenticated, HasBoardAccess]

    authentication_classes = [CsrfExemptSessionAuthentication]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return BoardDetailSerializer
        return BoardSerializer

    def get_queryset(self):
        user = self.request.user

        # Личные доски пользователя
        personal_boards = Board.objects.filter(created_by=user, group__isnull=True)

        # Доски из групп где пользователь состоит
        group_boards = Board.objects.filter(group__members_direct=user)

        return (personal_boards | group_boards).distinct()

    def get_permissions(self):
        if self.action in ["update", "partial_update", "destroy"]:
            self.permission_classes = [IsAuthenticated, HasBoardAccess, CanEditBoard]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class FolderViewSet(viewsets.ModelViewSet):
    serializer_class = FolderSerializer
    permission_classes = [IsAuthenticated, HasFolderAccess]

    authentication_classes = [CsrfExemptSessionAuthentication]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return FolderDetailSerializer
        return FolderSerializer

    def get_queryset(self):
        user = self.request.user

        # Папки из досок доступных пользователю
        accessible_boards = Board.objects.filter(
            Q(created_by=user) | Q(group__members_direct=user)
        )

        return Folder.objects.filter(board__in=accessible_boards)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ReminderViewSet(viewsets.ModelViewSet):
    serializer_class = ReminderSerializer
    permission_classes = [IsAuthenticated, HasReminderAccess]

    authentication_classes = [CsrfExemptSessionAuthentication]

    def get_queryset(self):
        user = self.request.user

        # Напоминания из папок доступных пользователю
        accessible_folders = Folder.objects.filter(
            board__in=Board.objects.filter(
                Q(created_by=user) | Q(group__members_direct=user)
            )
        )

        return Reminder.objects.filter(folder__in=accessible_folders)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect


@login_required
def dashboard_page(request):
    """Отображает список досок пользователя"""
    # Получаем все доски пользователя, новые сверху
    boards = Board.objects.filter(created_by=request.user).order_by("-created_at")

    return render(
        request, "app/dashboard_v2.html", {"user": request.user, "boards": boards}
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_board_api(request):
    """API для создания новой доски"""
    try:
        data = request.data
        title = request.data.get("title", "Новая доска")
        color = data.get("color", "#ffffff")

        new_board = Board.objects.create(
            title=title,
            created_by=request.user,
            state_data={},
            color=color,
        )

        return JsonResponse({"success": True, "board_id": new_board.id})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_board_api(request):
    """Обновление названия и цвета доски"""
    try:
        data = request.data
        board_id = data.get("board_id")
        title = data.get("title")
        color = data.get("color")

        board = get_object_or_404(Board, id=board_id, created_by=request.user)

        if title:
            board.title = title
        if color:
            board.color = color

        board.save()
        return JsonResponse({"success": True})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def delete_board_api(request):
    """Удаление доски"""
    try:
        data = request.data
        board_id = data.get("board_id")
        board = get_object_or_404(Board, id=board_id, created_by=request.user)
        board.delete()
        return JsonResponse({"success": True})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=400)


import json
from django.http import JsonResponse


def api_icons(request):
    """API endpoint для иконок"""
    if request.method == "GET":
        icons_data = {
            "success": "mdi-check",
            "error": "mdi-alert",
            "warning": "mdi-warning",
            "info": "mdi-information",
        }
        return JsonResponse(icons_data)


@login_required
@ensure_csrf_cookie
def board_page(request, board_id):
    """Открывает конкретную доску по ID"""

    board = get_object_or_404(Board, id=board_id, created_by=request.user)

    board_state_json = json.dumps(board.state_data) if board.state_data else "null"

    context = {
        "board_id": board.id,
        "board_data": board_state_json,
    }

    return render(request, "board.html", context)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_reminder_api(request):
    """Создает запись в БД и возвращает ID для фронтенда"""
    try:
        data = request.data
        board_id = data.get("board_id")
        board = Board.objects.get(id=board_id, created_by=request.user)

        # Создаем напоминание
        reminder = Reminder.objects.create(
            title="Новое напоминание",
            created_by=request.user,
            description="",
        )

        return JsonResponse({"success": True, "id": reminder.id})
    except Board.DoesNotExist:
        return JsonResponse(
            {"success": False, "error": "Доска не найдена или нет доступа"}, status=404
        )
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_board_api(request):
    try:
        data = request.data
        board_id = data.get("board_id")
        konva_json_str = data.get("board_data")

        if not board_id:
            return JsonResponse({"success": False, "error": "No board ID"}, status=400)

        # 1. Сохраняем JSON (как было)
        board = get_object_or_404(Board, id=board_id, created_by=request.user)
        if isinstance(konva_json_str, str):
            stage_data = json.loads(konva_json_str)
        else:
            stage_data = konva_json_str
        board.state_data = stage_data
        board.save()

        # 2. СИНХРОНИЗАЦИЯ
        try:
            layers = stage_data.get("children", [])
            for layer in layers:
                for node in layer.get("children", []):
                    attrs = node.get("attrs", {})

                    if attrs.get("name") == "reminder-group" and attrs.get("id"):
                        rem_id = attrs.get("id")
                        text_content = attrs.get("text_content", "Без названия")
                        deadline_iso = attrs.get("deadline_iso")

                        # === НОВОЕ: Достаем цвет ===
                        color_hex = attrs.get("color")

                        update_fields = {
                            "title": text_content,
                            "description": text_content,
                        }

                        # Если цвет есть, добавляем в обновление
                        if color_hex:
                            update_fields["color"] = color_hex

                        if deadline_iso:
                            dt = parse_datetime(deadline_iso)
                            if dt:
                                update_fields["due_date"] = dt

                        Reminder.objects.filter(
                            id=rem_id, created_by=request.user
                        ).update(**update_fields)

        except Exception as sync_error:
            print(f"Sync error: {sync_error}")

        return JsonResponse({"success": True})

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=400)


# === 2. НОВАЯ ФУНКЦИЯ УДАЛЕНИЯ ===
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def delete_reminder_api(request):
    """Удаляет напоминание из БД"""
    try:
        rem_id = request.data.get("id")
        if not rem_id:
            return JsonResponse(
                {"success": False, "error": "No ID provided"}, status=400
            )

        # Удаляем только свои напоминания
        deleted_count, _ = Reminder.objects.filter(
            id=rem_id, created_by=request.user
        ).delete()

        if deleted_count > 0:
            return JsonResponse({"success": True})
        else:
            return JsonResponse(
                {"success": False, "error": "Reminder not found or access denied"},
                status=404,
            )

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=400)
