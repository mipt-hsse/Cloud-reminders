from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count
from django.db import transaction
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from django.utils.dateparse import parse_datetime
from rest_framework.decorators import api_view, permission_classes
from django.views.decorators.csrf import ensure_csrf_cookie
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired

from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Board, BoardCollaborator, Board, BoardItem, TaskData

from .serializers import (
    BoardSerializer,
    BoardDetailSerializer,
    BoardItemSerializer,
    TaskDataSerializer,
    UserSerializer,
)

from users.views import CustomUser

import json
import uuid


@ensure_csrf_cookie
class BoardViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
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
            Q(owner=user) | Q(group__memberships__user=user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

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
            and board.owner != request.user
        ):
            return Response({"error": "Нет прав"}, status=403)
        board.items.all().delete()
        return Response({"status": "cleared"})


class BoardItemViewSet(viewsets.ModelViewSet):
    queryset = BoardItem.objects.all()
    serializer_class = BoardItemSerializer
    permission_classes = [IsAuthenticated]

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
            if not board.user_can_edit(self.request.user):
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
    boards = Board.objects.filter(
        Q(owner=user) | Q(group__members__user=user) | Q(collaborators__user=user)
    ).distinct()

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
        if not board.user_can_read(request.user):
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
        if not board.user_can_edit(request.user):
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
        if item.board.owner == request.user or (
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
        settings = {"BackgroundColor": color}

        new_board = Board.objects.create(
            title=title, owner=request.user, settings=settings
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

        if not board.user_can_edit(request.user):
            return JsonResponse(
                {"success": False, "error": "Access denied"}, status=403
            )

        if "title" in data:
            board.title = data["title"]
        if "color" in data:
            board.settings["BackgroundColor"] = data["color"]

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
        board = get_object_or_404(Board, id=board_id, owner=request.user)
        if board.owner != request.user:
            return JsonResponse(
                {"success": False, "error": "Только владелец доски может её удалить"},
                status=403,
            )
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
        if not board.user_can_read(request.user):
            return JsonResponse(
                {"success": False, "error": "Access denied"}, status=403
            )
        if not board.user_can_edit(request.user):
            return JsonResponse({"error": "Только для чтения"}, status=403)
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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_share_links_api(request, board_id):
    """Генерирует временные ссылки с помощью TimestampSigner"""
    board = get_object_or_404(Board, id=board_id)

    if board.owner != request.user:
        return JsonResponse(
            {"success": False, "error": "Только владелец может делиться доской"},
            status=403,
        )

    signer = TimestampSigner()

    viewer_token = signer.sign_object({"board_id": board.id, "role": "viewer"})
    editor_token = signer.sign_object({"board_id": board.id, "role": "editor"})

    base_url = request.build_absolute_uri("/")[:-1]

    return JsonResponse(
        {
            "success": True,
            "viewer_link": f"{base_url}/board/join/{viewer_token}/",
            "editor_link": f"{base_url}/board/join/{editor_token}/",
        }
    )


@login_required(login_url="/login/")
def join_board_view(request, token):
    """Обрабатывает переход по временной ссылке-приглашению"""
    signer = TimestampSigner()
    ONE_DAY_IN_SECONDS = 86400

    try:
        data = signer.unsign_object(token, max_age=ONE_DAY_IN_SECONDS)

        board_id = data.get("board_id")
        role = data.get("role")

        board = get_object_or_404(Board, id=board_id)

        if board.owner == request.user:
            return redirect("board_page", board_id=board.id)

        access_level = (
            BoardCollaborator.AccessLevel.EDITOR
            if role == "editor"
            else BoardCollaborator.AccessLevel.VIEWER
        )

        collab, created = BoardCollaborator.objects.get_or_create(
            board=board, user=request.user, defaults={"access_level": access_level}
        )

        if (
            not created
            and collab.access_level == BoardCollaborator.AccessLevel.VIEWER
            and access_level == BoardCollaborator.AccessLevel.EDITOR
        ):
            collab.access_level = access_level
            collab.save()

        return redirect("board_page", board_id=board.id)

    except SignatureExpired:
        return JsonResponse(
            {
                "error": "Срок действия ссылки истек. Попросите владельца отправить новую."
            },
            status=400,
        )

    except BadSignature:
        return JsonResponse(
            {"error": "Недействительная или поврежденная ссылка"}, status=400
        )
