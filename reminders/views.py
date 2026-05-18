from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from django.urls import reverse
from django.db.models import Q
from django.db import transaction
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from django.utils.dateparse import parse_datetime
from rest_framework.decorators import api_view, permission_classes
from django.views.decorators.csrf import ensure_csrf_cookie
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired, Signer

from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Board, BoardCollaborator, Board, BoardItem, TaskData, GroupMember

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
            Q(owner=user) | Q(group__members__user=user)
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
            Q(board__owner=user) | Q(board__group__members__user=user)
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

    my_boards = (
        Board.objects.filter(owner=user, parent__isnull=True)
        .order_by("-updated_at")
    )

    shared_boards = (
        Board.objects.filter(
            Q(group__members__user=user)
            | Q(
                collaborators__user=user,
                collaborators__status=BoardCollaborator.Status.ACCEPTED,
            )
        )
        .exclude(owner=user)
        .filter(parent__isnull=True)
        .distinct()
        .order_by("-updated_at")
    )

    my_tasks = (
        TaskData.objects.filter(assigned_to=user, is_completed=False)
        .select_related("item", "item__board")
        .order_by("due_date")[:10]
    )

    context = {
        "user": user,
        "my_boards": my_boards,
        "shared_boards": shared_boards,
        "my_tasks": my_tasks,
    }
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

    breadcrumbs = [
        {"id": b.id, "title": b.title} for b in board.get_ancestors()
    ]
    parent_board = board.parent

    context = {
        "board_id": board.id,
        "board_title": board.title,
        "board_data_json": json.dumps(board_data),
        "user_data_json": json.dumps(user_data),
        "breadcrumbs_json": json.dumps(breadcrumbs),
        "parent_board_id": parent_board.id if parent_board else None,
        "can_edit": board.user_can_edit(request.user),
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

        if item_type == BoardItem.ItemType.NESTED_BOARD:
            geometry = data.get("geometry", {"x": 100, "y": 100, "width": 220, "height": 160})
            title = data.get("title", "Новая доска")
            color = data.get("color", board.settings.get("BackgroundColor", "#65d3ff"))

            with transaction.atomic():
                child_board = Board(
                    title=title,
                    owner=board.owner or request.user,
                    parent=board,
                    settings={"BackgroundColor": color},
                )
                child_board.full_clean()
                child_board.save()
                item = BoardItem.objects.create(
                    board=board,
                    item_type=BoardItem.ItemType.NESTED_BOARD,
                    geometry=geometry,
                    style=data.get("style", {"fill": color}),
                    content_payload=str(child_board.id),
                )

            return JsonResponse(
                {
                    "success": True,
                    "id": item.id,
                    "linked_board_id": child_board.id,
                    "linked_board_title": child_board.title,
                }
            )

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
        user = request.user
        can_edit_board = (item.board.owner == user) or item.board.user_can_edit(user)
        is_assignee = False

        try:
            if hasattr(item, "task_data") and item.task_data is not None:
                is_assignee = item.task_data.assigned_to == user
        except Exception:
            pass

        if can_edit_board or is_assignee:
            if item.item_type == BoardItem.ItemType.NESTED_BOARD:
                try:
                    child_id = int(item.content_payload or 0)
                except (TypeError, ValueError):
                    child_id = None
                if child_id:
                    child_board = Board.objects.filter(
                        id=child_id, parent=item.board
                    ).first()
                    if child_board and child_board.user_can_edit(user):
                        child_board.delete()
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

        settings = {"BackgroundColor": color}

        parent_id = request.data.get("parent_id")
        parent_board = None
        if parent_id:
            parent_board = get_object_or_404(Board, id=parent_id)
            if not parent_board.user_can_edit(request.user):
                return JsonResponse(
                    {"success": False, "error": "Access denied"}, status=403
                )

        new_board = Board.objects.create(
            title=title,
            owner=request.user,
            settings=settings,
            parent=parent_board,
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
        stage_attrs = stage_data.get("attrs", {}) if isinstance(stage_data, dict) else {}
        settings_changed = False
        if not isinstance(board.settings, dict):
            board.settings = {}

        if "connectionData" in stage_attrs:
            board.settings["connectionData"] = stage_attrs.get("connectionData")
            settings_changed = True

        if "boardTheme" in stage_attrs:
            board.settings["boardTheme"] = stage_attrs.get("boardTheme")
            settings_changed = True

        if settings_changed:
            board.save(update_fields=["settings", "updated_at"])

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
            if "id" in node["attrs"] and str(node["attrs"]["id"]).isdigit()
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
            # Вложенная доска (храним связь в content_payload)
            "childBoardId",
            "boardTitle",
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


@login_required(login_url="/login/")
def join_board_by_link(request, token):
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

        target_access_level = (
            BoardCollaborator.AccessLevel.EDITOR
            if role == "editor"
            else BoardCollaborator.AccessLevel.VIEWER
        )

        collab, created = BoardCollaborator.objects.get_or_create(
            board=board,
            user=request.user,
            defaults={
                "access_level": target_access_level,
                "status": BoardCollaborator.Status.ACCEPTED,
            },
        )

        if not created:

            if collab.status == BoardCollaborator.Status.PENDING:
                collab.status = BoardCollaborator.Status.ACCEPTED

            if (
                collab.access_level == BoardCollaborator.AccessLevel.VIEWER
                and target_access_level == BoardCollaborator.AccessLevel.EDITOR
            ):
                collab.access_level = target_access_level

            collab.save()

        return redirect("board_page", board_id=board.id)

    except SignatureExpired:
        return render(
            request,
            "errors/403.html",
            {
                "error_message": "Срок действия ссылки истек. Попросите владельца отправить новую."
            },
        )

    except BadSignature:
        return render(
            request,
            "errors/403.html",
            {"error_message": "Недействительная или поврежденная ссылка."},
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_share_links_api(request, board_id):
    try:
        board = Board.objects.get(id=board_id)
    except Board.DoesNotExist:
        return Response({"success": False, "error": "Доска не найдена"}, status=404)

    if not board.user_can_edit(request.user):
        return Response(
            {"success": False, "error": "Нет прав для генерации ссылок"}, status=403
        )

    signer = TimestampSigner()

    viewer_token = signer.sign_object({"board_id": board.id, "role": "viewer"})
    editor_token = signer.sign_object({"board_id": board.id, "role": "editor"})

    base_url = request.build_absolute_uri("/")[:-1]
    viewer_link = f"{base_url}{reverse('join_board', args=[viewer_token])}"
    editor_link = f"{base_url}{reverse('join_board', args=[editor_token])}"

    return Response(
        {"success": True, "viewer_link": viewer_link, "editor_link": editor_link}
    )


# @api_view(["GET"])
# @permission_classes([IsAuthenticated])
# def get_board_members(request, board_id):
#     """
#     API возвращает список всех пользователей, у которых есть доступ к доске.
#     """
#     try:
#         board = Board.objects.get(id=board_id)
#     except Board.DoesNotExist:
#         return Response({"success": False, "error": "Доска не найдена"}, status=404)

#     unique_users = set()

#     unique_users.add(board.owner)

#     if board.group:
#         for member in board.group.members.all():
#             unique_users.add(member.user)

#     users_data = []
#     for u in unique_users:
#         users_data.append(
#             {
#                 "id": u.id,
#                 "username": u.username,
#                 "full_name": f"{u.first_name} {u.last_name}".strip() or u.username,
#                 "avatar_url": (
#                     u.avatar.url
#                     if u.avatar and u.avatar.name != "avatars/default_avatar.png"
#                     else None
#                 ),
#             }
#         )

#     users_data = sorted(users_data, key=lambda x: x["full_name"])

#     return Response({"success": True, "users": users_data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_users_for_invite(request, board_id):
    query = request.GET.get("q", "").strip()

    try:
        board = Board.objects.get(id=board_id)
    except Board.DoesNotExist:
        return Response({"success": False, "error": "Доска не найдена"}, status=404)

    # 1. Кто УЖЕ на этой доске? (Их мы исключим из результатов)
    existing_user_ids = set()
    if board.owner:
        existing_user_ids.add(board.owner.id)
    if board.group:
        existing_user_ids.update(board.group.members.values_list("user_id", flat=True))
    existing_user_ids.update(board.collaborators.values_list("user_id", flat=True))

    # 2. Собираем "Круг общения" текущего пользователя (Контакты)
    # Находим группы пользователя
    my_groups = GroupMember.objects.filter(user=request.user).values_list(
        "group_id", flat=True
    )

    # Находим доски, к которым у пользователя есть доступ (как владелец или соавтор)
    my_boards = Board.objects.filter(
        Q(owner=request.user)
        | Q(collaborators__user=request.user)
        | Q(group__in=my_groups)
    ).values_list("id", flat=True)

    # Получаем всех пользователей, которые пересекаются с нами по группам или доскам
    known_users = (
        CustomUser.objects.filter(
            Q(workgroup_memberships__group__in=my_groups)
            | Q(shared_boards__board__in=my_boards)
            | Q(owned_boards__in=my_boards)
        )
        .exclude(id=request.user.id)
        .exclude(id__in=existing_user_ids)
        .distinct()
    )

    # 3. Фильтруем контакты, если есть поисковый запрос
    if query:
        known_users = known_users.filter(
            Q(username__icontains=query)
            | Q(email__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
        )[:10]
        section_title = (
            "Результаты поиска" if known_users.exists() else "В контактах не найдено"
        )
    else:
        known_users = known_users[:10]
        section_title = (
            "Ваши контакты (коллеги)"
            if known_users.exists()
            else "Нет доступных контактов"
        )

    # 4. Формируем ответ
    users_data = []
    for u in known_users:
        users_data.append(
            {
                "id": u.id,
                "username": u.username,
                "full_name": f"{u.first_name} {u.last_name}".strip() or u.username,
                "avatar_url": (
                    u.avatar.url
                    if hasattr(u, "avatar")
                    and u.avatar
                    and u.avatar.name != "avatars/default_avatar.png"
                    else None
                ),
            }
        )

    return Response(
        {"success": True, "users": users_data, "section_title": section_title}
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_board_collaborator(request, board_id):
    try:
        board = Board.objects.get(id=board_id)
    except Board.DoesNotExist:
        return Response({"success": False, "error": "Доска не найдена"}, status=404)

    # Используем ваш метод модели для проверки прав:
    # только те, кто может редактировать доску, могут добавлять людей
    if not board.user_can_edit(request.user):
        return Response(
            {"success": False, "error": "Нет прав для приглашения участников"},
            status=403,
        )

    user_id = request.data.get("user_id")
    access_level = request.data.get("access_level")

    # Валидация уровня доступа
    if access_level not in [
        BoardCollaborator.AccessLevel.VIEWER,
        BoardCollaborator.AccessLevel.EDITOR,
    ]:
        return Response(
            {"success": False, "error": "Неверный уровень доступа"}, status=400
        )

    try:
        user_to_add = CustomUser.objects.get(id=user_id)
    except CustomUser.DoesNotExist:
        return Response(
            {"success": False, "error": "Пользователь не найден"}, status=404
        )

    # Проверка: не пытаемся ли мы добавить владельца
    if board.owner == user_to_add:
        return Response(
            {"success": False, "error": "Этот пользователь — владелец доски"},
            status=400,
        )

    # Создаем или обновляем уровень доступа (update_or_create)
    collab, created = BoardCollaborator.objects.update_or_create(
        board=board, user=user_to_add, defaults={"access_level": access_level}
    )

    role_name = (
        "редактор"
        if access_level == BoardCollaborator.AccessLevel.EDITOR
        else "читатель"
    )

    return Response(
        {"success": True, "message": f"Пользователь добавлен как {role_name}"}
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_my_invitations(request):
    """Возвращает список приглашений для текущего пользователя"""
    invites = BoardCollaborator.objects.filter(
        user=request.user, status=BoardCollaborator.Status.PENDING
    ).select_related("board", "board__owner")

    data = []
    for invite in invites:
        data.append(
            {
                "board_id": invite.board.id,
                "board_title": invite.board.title,
                "inviter": invite.board.owner.username,
                "access_level": invite.get_access_level_display(),
                "created_at": invite.created_at.strftime("%d.%m %H:%M"),
            }
        )

    return Response({"success": True, "invitations": data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def respond_to_invitation(request, board_id):
    """Принять или отклонить приглашение"""
    action = request.data.get("action")  # 'accept' или 'decline'

    try:
        collab = BoardCollaborator.objects.get(
            board_id=board_id,
            user=request.user,
            status=BoardCollaborator.Status.PENDING,
        )
    except BoardCollaborator.DoesNotExist:
        return Response(
            {"success": False, "error": "Приглашение не найдено"}, status=404
        )

    if action == "accept":
        collab.status = BoardCollaborator.Status.ACCEPTED
        collab.save()
        return Response({"success": True, "message": "Приглашение принято"})

    elif action == "decline":
        collab.delete()  # Просто удаляем запись, если отказался
        return Response({"success": True, "message": "Вы отклонили приглашение"})

    return Response({"success": False, "error": "Неверное действие"}, status=400)
