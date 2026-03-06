from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count
from django.db import transaction
import json
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.utils.dateparse import parse_datetime
from rest_framework.decorators import api_view, permission_classes
from django.views.decorators.csrf import ensure_csrf_cookie

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .filters import GroupFilter
from .models import Group, GroupMembership, Board, BoardItem, TaskData
from users.models import CustomUser

from .serializers import (
    GroupSerializer,
    GroupCreateSerializer,
    GroupUpdateSerializer,
    GroupMembershipSerializer,
    BoardSerializer,
    BoardDetailSerializer,
    BoardItemSerializer,
    TaskDataSerializer,
    UserSerializer,
)
from .permissions import (
    IsGroupMember,
    IsGroupAdmin,
    IsGroupOwner,
    HasBoardAccess,
    CanEditBoard,
    HasBoardItemAccess,
)


@ensure_csrf_cookie
class GroupViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления группами с полным CRUD и дополнительными действиями
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["name", "description"]
    filterset_class = GroupFilter
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
            members_count=Count("memberships", distinct=True),
            boards_count=Count("boards", distinct=True),
        )

        public_condition = Q(settings__is_public=True)

        if self.action in ["join", "retrieve", "list", "search", "public_groups"]:
            return queryset.filter(
                public_condition | Q(memberships__user=user)
            ).distinct()

        return queryset.filter(memberships__user=user)

    def get_permissions(self):
        if self.action == "create":
            self.permission_classes = [IsAuthenticated]
        elif self.action in [
            "update",
            "partial_update",
            "add_member",
            "remove_member",
            "update_member",
        ]:
            self.permission_classes = [IsAuthenticated, IsGroupAdmin]
        elif self.action == "destroy":
            self.permission_classes = [IsAuthenticated, IsGroupOwner]
        elif self.action in ["retrieve", "members", "leave", "my_membership"]:
            self.permission_classes = [IsAuthenticated, IsGroupMember]
        elif self.action == "join":
            self.permission_classes = [IsAuthenticated]
        return super().get_permissions()

    def perform_create(self, serializer):
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
        groups = self.get_queryset().filter(mmemberships__user=request.user)

        page = self.paginate_queryset(groups)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(groups, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def public_groups(self, request):
        """Только публичные группы (без пагинации для выпадающих списков)"""
        groups = Group.objects.filter(settings__is_public=True).annotate(
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
        if not group.settings__is_public:
            return Response(
                {
                    "error": "Эта группа не публичная. Запрос на вступление должен быть одобрен администратором."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if group.memberships.filter(user=request.user).exists():
            return Response(
                {"error": "Вы уже состоите в этой группе"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = group.add_member(
            user=request.user,
            access_level=GroupMembership.AccessLevel.READ,
            invited_by=None,
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

        if not group.memberships.filter(user=request.user).exists():
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
            members = group.memberships.select_related("user", "invited_by")

            # Фильтрация по уровню доступа
            access_level = request.query_params.get("access_level")
            if access_level:
                members = members.filter(access_level=access_level)

            serializer = GroupMembershipSerializer(members, many=True)
            return Response(serializer.data)

        elif request.method == "POST":
            return self._add_member_logic(group, request)

    def _add_member_logic(self, group, request):
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
            if group.memberships.filter(user=user).exists():
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
        """Поиск по группам (публичным или моим)"""
        query = request.query_params.get("q", "")
        if not query:
            return Response({"error": "Пустой запрос"}, status=400)

        queryset = self.get_queryset()
        groups = queryset.filter(
            Q(name__icontains=query) | Q(description__icontains=query)
        )

        page = self.paginate_queryset(groups)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        return Response(self.get_serializer(groups, many=True).data)

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

        if group.settings__is_public:
            return Response(
                {"error": "Эта группа публичная. Используйте endpoint /join/"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if group.memberships.filter(user=request.user).exists():
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
        """Публичные группы, в которых меня нет"""
        user = request.user

        groups = (
            Group.objects.filter(settings__is_public=True)
            .exclude(memberships__user=user)
            .annotate(members_count=Count("memberships", distinct=True))
        )

        page = self.paginate_queryset(groups)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        return Response(self.get_serializer(groups, many=True).data)


@ensure_csrf_cookie
class BoardViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasBoardAccess]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["title"]
    ordering = ["-updated_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return BoardDetailSerializer
        return BoardSerializer

    def get_queryset(self):
        user = self.request.user

        return Board.objects.filter(
            Q(created_by=user) | Q(group__memberships__user=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get"])
    def content(self, request, pk=None):
        board = self.get_object()
        items = BoardItem.objects.filter(board=board).select_related("task_data")
        serializer = BoardItemSerializer(items, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def clear(self, request, pk=None):
        """Очистить доску"""
        board = self.get_object()
        if (
            not request.user.has_perm("can_edit_board", board)
            and board.created_by != request.user
        ):
            return Response({"error": "Нет прав"}, status=403)
        board.items.all().delete()
        return Response({"status": "cleared"})


class BoardItemViewSet(viewsets.ModelViewSet):
    queryset = BoardItem.objects.all()
    serializer_class = BoardItemSerializer
    permission_classes = [IsAuthenticated, HasBoardItemAccess]

    def get_queryset(self):
        # Показываем элементы только с доступных досок
        user = self.request.user
        return BoardItem.objects.filter(
            Q(board__created_by=user) | Q(board__group__memberships__user=user)
        ).distinct()

    def perform_create(self, serializer):
        # Проверка прав на редактирование доски
        board = serializer.validated_data.get("board")
        if board:
            # Здесь можно добавить проверку CanEditBoard
            if not board.user_has_access(self.request.user):
                raise serializers.ValidationError("Нет доступа к этой доске")
        serializer.save()

    @action(detail=False, methods=["post"])
    def bulk_update(self, request):
        updates = request.data.get("updates", [])
        if not updates:
            return Response({"status": "no updates provided"})

        # Получаем ID для проверки прав
        ids = [u.get("id") for u in updates]
        qs = self.get_queryset().filter(id__in=ids)
        existing_items = {item.id: item for item in qs}

        items_to_update = []
        for update_data in updates:
            item_id = update_data.get("id")
            item = existing_items.get(item_id)
            if item:
                # Обновляем геометрию
                if "geometry" in update_data:
                    item.geometry = update_data["geometry"]
                # Обновляем стили (если нужно)
                if "style" in update_data:
                    item.style = update_data["style"]
                items_to_update.append(item)

        if items_to_update:
            BoardItem.objects.bulk_update(items_to_update, ["geometry", "style"])

        return Response({"status": "success", "updated_count": len(items_to_update)})


@login_required
def dashboard_page(request):
    user = request.user
    boards = (
        Board.objects.filter(Q(created_by=user) | Q(group__memberships__user=user))
        .distinct()
        .order_by("-updated_at")
    )

    my_tasks = (
        TaskData.objects.filter(assigned_to=user, is_completed=False)
        .select_related("item", "item__board")
        .order_by("due_date")[:10]
    )

    context = {"user": user, "boards": boards, "my_tasks": my_tasks}
    return render(request, "app/dashboard_v2.html", context)


@login_required
@ensure_csrf_cookie
def board_page(request, board_id):
    """
    Открывает конкретную доску по ID.
    Теперь загружает items и user для передачи в JS.
    """
    try:
        board = Board.objects.get(id=board_id)
        if not board.user_has_access(request.user):
            return render(request, "403.html", status=403)
    except Board.DoesNotExist:
        return render(request, "404.html", status=404)

    board_serializer = BoardDetailSerializer(board, context={"request": request})
    board_data = board_serializer.data

    user_serializer = UserSerializer(request.user)
    user_data = user_serializer.data

    context = {
        "board_id": board.id,
        "board_title": board.title,
        "board_data_json": json.dumps(board_data),
        "user_data_json": json.dumps(user_data),
    }
    return render(request, "board.html", context)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_reminder_api(request):
    """
    Универсальное создание элемента доски (Задача, Стикер, Текст, Рисунок).
    """
    try:
        data = request.data.copy()
        board_id = data.get("board_id")
        board = get_object_or_404(Board, id=board_id)
        if not board.user_has_access(request.user):
            return JsonResponse(
                {"success": False, "error": "Access denied"}, status=403
            )

        item_type = data.get("item_type", BoardItem.ItemType.TASK)

        content_payload = data.get("content_payload", "")
        if item_type == BoardItem.ItemType.TASK and not content_payload:
            content_payload = data.get("title", "Новая задача")
        elif item_type == BoardItem.ItemType.TEXT and not content_payload:
            content_payload = "Новый текст"

        item_data = {
            "board": board_id,
            "item_type": item_type,
            "geometry": data.get("geometry", {"x": 100, "y": 100}),
            "style": data.get("style", {}),
            "content_payload": content_payload,
        }
        if item_type == BoardItem.ItemType.TASK:
            raw_task_data = data.get("task_data", {})

            item_data["task_data"] = {
                "assigned_to_id": raw_task_data.get("assigned_to_id")
                or request.user.id,
                "description": raw_task_data.get("description", ""),
                "priority": raw_task_data.get("priority", "medium"),
                "is_completed": raw_task_data.get("is_completed", False),
            }

            if raw_task_data.get("due_date"):
                item_data["task_data"]["due_date"] = raw_task_data.get("due_date")
        serializer = BoardItemSerializer(data=item_data)

        print(item_data, flush=True)
        if serializer.is_valid():
            item = serializer.save()
            return JsonResponse({"success": True, "id": item.id})
        else:
            print("Serializer Errors:", serializer.errors)
            return JsonResponse(
                {"success": False, "error": serializer.errors}, status=400
            )

    except Exception as e:
        import traceback

        traceback.print_exc()
        return JsonResponse({"success": False, "error": str(e)}, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def delete_reminder_api(request):
    """Удаление любого элемента (не только напоминания)"""
    try:
        item_id = request.data.get("id")
        item = get_object_or_404(BoardItem, id=item_id)
        if item.board.created_by == request.user or (
            item.task_data.assigned_to == request.user
            if hasattr(item, "task_data")
            else False
        ):

            item.delete()
            return JsonResponse({"success": True})
        else:
            return JsonResponse(
                {"success": False, "error": "Нет прав на удаление"}, status=403
            )

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_board_api(request):
    """API создания доски"""
    try:
        title = request.data.get("title", "Новая доска")
        color = request.data.get("color", "#ffffff")

        # state_data больше нет, используем settings для цвета
        settings = {"backgroundColor": color}

        new_board = Board.objects.create(
            title=title, created_by=request.user, color=color, settings=settings
        )
        return JsonResponse({"success": True, "board_id": new_board.id})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_board_api(request):
    """Обновление метаданных доски (название, цвет)"""
    try:
        data = request.data
        board_id = data.get("board_id")
        board = get_object_or_404(Board, id=board_id)

        if not board.user_has_access(request.user):  # Или CanEditBoard
            return JsonResponse(
                {"success": False, "error": "Access denied"}, status=403
            )

        if "title" in data:
            board.title = data["title"]
        if "color" in data:
            board.color = data["color"]
            board.settings = {**board.settings, "backgroundColor": data["color"]}

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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_board_api(request):
    """
    Сохранение состояния доски.
    Теперь умеет сохранять points для линий и text для стикеров.
    """
    try:
        data = request.data
        board_id = data.get("board_id")
        konva_json_raw = data.get("board_data")

        if not board_id:
            return JsonResponse({"success": False, "error": "No board ID"}, status=400)

        board = get_object_or_404(Board, id=board_id)
        if not board.user_has_access(request.user):
            return JsonResponse(
                {"success": False, "error": "Access denied"}, status=403
            )

        stage_data = (
            json.loads(konva_json_raw)
            if isinstance(konva_json_raw, str)
            else konva_json_raw
        )

        items_to_update = []
        tasks_to_update = []

        def extract_nodes(node):
            attrs = node.get("attrs", {})
            if attrs.get("id"):
                yield node
            for child in node.get("children", []):
                yield from extract_nodes(child)

        incoming_nodes_map = {
            str(node["attrs"]["id"]): node
            for node in extract_nodes(stage_data)
            if "id" in node["attrs"]
        }

        if not incoming_nodes_map:
            return JsonResponse(
                {"success": True, "updated": 0, "message": "No items to update"}
            )

        db_items = BoardItem.objects.filter(
            id__in=incoming_nodes_map.keys(), board_id=board.id
        ).select_related("task_data")

        # --- СПИСОК ИСКЛЮЧЕНИЙ ---
        NON_STYLE_KEYS = {
            # Мета-данные
            "id",
            "name",
            "draggable",
            "listening",
            "visible",
            "zIndex",
            "className",
            # Геометрия (храним в geometry)
            "x",
            "y",
            "rotation",
            "scaleX",
            "scaleY",
            "width",
            "height",
            "points",
            # Контент и бизнес-логика (храним в своих полях)
            "text",
            "text_content",
            "content_payload",
            "deadline_iso",
            "is_completed",
        }

        with transaction.atomic():
            for db_item in db_items:
                node = incoming_nodes_map.get(str(db_item.id))
                attrs = node.get("attrs", {})
                item_changed = False

                new_geometry = {
                    "x": attrs.get("x", 0),
                    "y": attrs.get("y", 0),
                    "rotation": attrs.get("rotation", 0),
                    "scaleX": attrs.get("scaleX", 1),
                    "scaleY": attrs.get("scaleY", 1),
                    "width": attrs.get("width"),
                    "height": attrs.get("height"),
                    "zIndex": attrs.get("zIndex", 0),
                    "points": attrs.get("points"),
                }

                current_style_from_front = {
                    k: v for k, v in attrs.items() if k not in NON_STYLE_KEYS
                }

                if db_item.geometry != new_geometry:
                    db_item.geometry = new_geometry
                    item_changed = True

                if db_item.style != current_style_from_front:
                    db_item.style = current_style_from_front
                    item_changed = True

                new_content = (
                    attrs.get("content_payload")
                    or attrs.get("text_content")
                    or attrs.get("text")
                )
                if new_content is not None and db_item.content_payload != new_content:
                    db_item.content_payload = new_content
                    item_changed = True

                if item_changed:
                    items_to_update.append(db_item)

                if db_item.item_type == BoardItem.ItemType.TASK and hasattr(
                    db_item, "task_data"
                ):
                    task_data = db_item.task_data
                    task_changed = False

                    deadline_iso = attrs.get("deadline_iso")
                    if deadline_iso:
                        new_date = parse_datetime(deadline_iso)
                        if task_data.due_date != new_date:
                            task_data.due_date = new_date
                            task_changed = True

                    is_done = attrs.get("is_completed")
                    if is_done is not None and task_data.is_completed != is_done:
                        task_data.is_completed = is_done
                        task_changed = True

                    if task_changed:
                        tasks_to_update.append(task_data)
            if items_to_update:
                BoardItem.objects.bulk_update(
                    items_to_update, ["geometry", "style", "content_payload"]
                )

            if tasks_to_update:
                TaskData.objects.bulk_update(
                    tasks_to_update, ["due_date", "is_completed"]
                )

        return JsonResponse({"success": True, "updated": len(items_to_update)})

    except Exception as e:
        import traceback

        traceback.print_exc()
        return JsonResponse({"success": False, "error": str(e)}, status=400)


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
