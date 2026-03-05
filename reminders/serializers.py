from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Group, GroupMembership, Board, BoardItem, TaskData
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


class GroupMembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True)
    invited_by = UserSerializer(read_only=True)

    class Meta:
        model = GroupMembership
        fields = ("id", "user", "user_id", "access_level", "joined_at", "invited_by")
        read_only_fields = ("joined_at", "invited_by")


class GroupSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    members_count = serializers.SerializerMethodField()
    boards_count = serializers.SerializerMethodField()
    user_access_level = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()
    is_public = serializers.BooleanField(
        source="settings.is_public", default=False, read_only=True
    )

    class Meta:
        model = Group
        fields = (
            "id",
            "name",
            "description",
            "created_by",
            "created_at",
            "updated_at",
            "is_public",
            "members_count",
            "boards_count",
            "user_access_level",
            "is_member",
        )
        read_only_fields = ("created_by", "created_at", "updated_at")

    def get_members_count(self, obj):
        return obj.memberships.count()

    def get_boards_count(self, obj):
        return obj.boards.count()

    def get_user_access_level(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            try:
                membership = obj.memberships.filter(user=request.user).first()
                return membership.access_level if membership else None
            except:
                return None
        return None

    def get_is_member(self, obj):
        return self.get_user_access_level(obj) is not None


class GroupCreateSerializer(serializers.ModelSerializer):
    is_public = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = Group
        fields = ["name", "description", "is_public"]

    def create(self, validated_data):
        # Извлекаем is_public из данных
        is_public = validated_data.pop("is_public", False)

        # Создаем группу
        group = Group.objects.create(**validated_data)

        # Обновляем settings
        group.settings["is_public"] = is_public
        group.save()
        return group

    def validate_name(self, value):
        """Проверка уникальности имени группы"""
        if Group.objects.filter(name=value).exists():
            raise serializers.ValidationError("Группа с таким именем уже существует")
        return value


class GroupUpdateSerializer(serializers.ModelSerializer):
    """Сериализатор для обновления группы"""

    class Meta:
        model = Group
        fields = ["name", "description", "is_public"]

    def validate_name(self, value):
        """Проверка уникальности имени группы (исключая текущую группу)"""
        if Group.objects.filter(name=value).exclude(id=self.instance.id).exists():
            raise serializers.ValidationError("Группа с таким именем уже существует")
        return value


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
    created_by = UserSerializer(read_only=True)
    group = GroupSerializer(read_only=True)
    group_id = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        source="group",
        write_only=True,
        required=False,
        allow_null=True,
    )

    # Счетчики для списка досок
    items_count = serializers.SerializerMethodField()
    user_access_level = serializers.SerializerMethodField()

    class Meta:
        model = Board
        fields = (
            "id",
            "title",
            "description",
            "color",
            "is_private",
            "settings",
            "created_by",
            "created_at",
            "updated_at",
            "group",
            "group_id",
            "items_count",
            "user_access_level",
        )
        read_only_fields = ("created_by", "created_at", "updated_at")

    def get_items_count(self, obj):
        return obj.items.count()  # related_name='items'

    def get_user_access_level(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.user_access_level(request.user)
        return None

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user

        # Проверка прав на группу
        group = validated_data.get("group")
        if group and not self.context["request"].user.is_group_member(group):
            raise serializers.ValidationError("Вы не состоите в этой группе")

        return super().create(validated_data)


class BoardDetailSerializer(BoardSerializer):
    """
    Сериализатор для открытия конкретной доски.
    Включает в себя СПИСОК элементов (items).
    """

    items = BoardItemSerializer(many=True, read_only=True)

    class Meta(BoardSerializer.Meta):
        fields = BoardSerializer.Meta.fields + ("items",)
