from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Board, BoardItem, TaskData
from users.models import CustomUser
from django.db import transaction

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ("id", "username", "email", "first_name", "last_name", "avatar")

    def __init__(self, *args, **kwargs):
        # Ленивая загрузка модели пользователя
        if self.Meta.model is None:
            self.Meta.model = User
        super().__init__(*args, **kwargs)


class TaskDataSerializer(serializers.ModelSerializer):
    assigned_to = UserSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="assigned_to",
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = TaskData
        fields = (
            "id",
            "assigned_to",
            "assigned_to_id",
            "due_date",
            "is_completed",
            "priority",
            "description",
        )


class BoardItemSerializer(serializers.ModelSerializer):
    # Вложенные данные задачи (если есть)
    task_data = TaskDataSerializer(required=False, allow_null=True)

    # Для чтения
    item_type_display = serializers.CharField(
        source="get_item_type_display", read_only=True
    )

    class Meta:
        model = BoardItem
        fields = [
            "id",
            "board",
            "item_type",
            "item_type_display",
            "geometry",
            "style",
            "content_payload",
            "created_at",
            "updated_at",
            "task_data",  # Вложенный объект
        ]
        read_only_fields = ("created_at", "updated_at")

    def to_representation(self, instance):
        """
        Кастомизация вывода: если это TASK, добавляем task_data.
        Если нет - поле task_data будет None, можно его даже вырезать.
        """
        ret = super().to_representation(instance)
        # Если у элемента нет task_data (например, это стрелка), убираем null из ответа для чистоты
        if instance.item_type != BoardItem.ItemType.TASK:
            ret.pop("task_data", None)
        return ret

    def create(self, validated_data):
        """
        Создание элемента + (опционально) TaskData
        """
        task_data_payload = validated_data.pop("task_data", None)

        with transaction.atomic():
            item = BoardItem.objects.create(**validated_data)

            if item.item_type == BoardItem.ItemType.TASK:
                if task_data_payload is None:
                    task_data_payload = {}

                TaskData.objects.create(item=item, **task_data_payload)

        return item

    def update(self, instance, validated_data):
        """
        Обновление элемента + TaskData
        """
        task_data_payload = validated_data.pop("task_data", None)

        with transaction.atomic():
            # 1. Обновляем поля BoardItem (геометрию, стиль)
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            # 2. Обновляем TaskData, если она есть
            if instance.item_type == BoardItem.ItemType.TASK and task_data_payload:
                task_data_instance, created = TaskData.objects.get_or_create(
                    item=instance
                )

                # Используем сериализатор для обновления вложенных полей
                task_serializer = TaskDataSerializer(
                    task_data_instance, data=task_data_payload, partial=True
                )
                if task_serializer.is_valid(raise_exception=True):
                    task_serializer.save()

        return instance


class BoardSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)

    items_count = serializers.SerializerMethodField()
    user_access_level = serializers.SerializerMethodField()

    class Meta:
        model = Board
        fields = (
            "id",
            "title",
            "settings",
            "owner",
            "created_at",
            "updated_at",
            "group",
            "group_id",
            "parent_id",
            "items_count",
            "user_access_level",
        )
        read_only_fields = ("owner", "created_at", "updated_at")

    def get_items_count(self, obj):
        return obj.items.count()

    def get_user_access_level(self, obj):
        """Возвращает права текущего пользователя в виде строки"""
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            user = request.user
            if obj.owner == user:
                return "owner"
            elif obj.user_can_edit(user):
                return "editor"
            elif obj.user_can_read(user):
                return "viewer"
        return None

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["owner"] = user

        group = validated_data.get("group")
        if group and not group.members.filter(user=user).exists():
            raise serializers.ValidationError("Вы не состоите в этой группе")

        return super().create(validated_data)


class BoardDetailSerializer(BoardSerializer):
    """
    Сериализатор для открытия конкретной доски.
    Включает в себя СПИСОК элементов (items).
    """

    items = BoardItemSerializer(many=True, read_only=True)
    breadcrumb_path = serializers.SerializerMethodField()
    child_boards = serializers.SerializerMethodField()

    class Meta(BoardSerializer.Meta):
        fields = BoardSerializer.Meta.fields + (
            "items",
            "breadcrumb_path",
            "child_boards",
        )

    def get_breadcrumb_path(self, obj):
        parts = []
        node = obj
        seen = set()
        while node is not None:
            if node.id in seen:
                break
            seen.add(node.id)
            parts.append({"id": node.id, "title": node.title})
            node = node.parent
        parts.reverse()
        return parts

    def get_child_boards(self, obj):
        request = self.context.get("request")
        qs = Board.objects.filter(parent=obj).order_by("title")
        out = []
        for c in qs:
            if request and request.user.is_authenticated:
                if not c.user_can_read(request.user):
                    continue
            out.append({"id": c.id, "title": c.title})
        return out
