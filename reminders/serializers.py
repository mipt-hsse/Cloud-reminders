from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Group, GroupMembership, Board, Folder, Reminder
from users.models import CustomUser


# Ленивый сериализатор для пользователя
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser  # Будет установлен динамически
        fields = ("id", "username", "email", "first_name", "last_name", "avatar")

    def __init__(self, *args, **kwargs):
        # Ленивая загрузка модели пользователя
        if self.Meta.model is None:
            self.Meta.model = get_user_model()
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
        return obj.members_direct.count()

    def get_boards_count(self, obj):
        return obj.boards.count()

    def get_user_access_level(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            try:
                membership = GroupMembership.objects.get(user=request.user, group=obj)
                return membership.access_level
            except GroupMembership.DoesNotExist:
                return None
        return None

    def get_is_member(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return request.user.is_group_member(obj)
        return False


class GroupCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания группы"""

    class Meta:
        model = Group
        fields = ["name", "description", "is_public"]

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


class BoardSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    group = GroupSerializer(read_only=True)
    group_id = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )
    folders_count = serializers.SerializerMethodField()
    user_access_level = serializers.SerializerMethodField()

    class Meta:
        model = Board
        fields = (
            "id",
            "title",
            "description",
            "created_by",
            "created_at",
            "updated_at",
            "color",
            "is_private",
            "group",
            "group_id",
            "folders_count",
            "user_access_level",
        )
        read_only_fields = ("created_by", "created_at", "updated_at")

    def get_folders_count(self, obj):
        return obj.folders.count()

    def get_user_access_level(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.user_access_level(request.user)
        return None

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        group_id = validated_data.pop("group_id", None)
        if group_id:
            try:
                group = Group.objects.get(id=group_id)
                # Проверяем что пользователь состоит в группе
                if not self.context["request"].user.is_group_member(group):
                    raise serializers.ValidationError("Вы не состоите в этой группе")
                validated_data["group"] = group
            except Group.DoesNotExist:
                raise serializers.ValidationError("Группа не найдена")
        return super().create(validated_data)


class FolderSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    board = serializers.PrimaryKeyRelatedField(queryset=Board.objects.all())
    reminders_count = serializers.SerializerMethodField()

    class Meta:
        model = Folder
        fields = (
            "id",
            "name",
            "description",
            "board",
            "created_by",
            "created_at",
            "order",
            "reminders_count",
        )
        read_only_fields = ("created_by", "created_at")

    def get_reminders_count(self, obj):
        return obj.reminders.count()

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class ReminderSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    assigned_to = UserSerializer(read_only=True)
    assigned_to_id = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )
    folder = serializers.PrimaryKeyRelatedField(queryset=Folder.objects.all())

    class Meta:
        model = Reminder
        fields = (
            "id",
            "title",
            "description",
            "due_date",
            "is_completed",
            "priority",
            "color",
            "font",
            "folder",
            "created_by",
            "assigned_to",
            "assigned_to_id",
            "created_at",
            "updated_at",
            "completed_at",
        )
        read_only_fields = ("created_by", "created_at", "updated_at", "completed_at")

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class BoardDetailSerializer(BoardSerializer):
    folders = FolderSerializer(many=True, read_only=True)

    class Meta(BoardSerializer.Meta):
        fields = (
            "id",
            "title",
            "description",
            "created_by",
            "created_at",
            "updated_at",
            "color",
            "is_private",
            "group",
            "group_id",
            "folders_count",
            "user_access_level",
            "folders",
        )


class FolderDetailSerializer(FolderSerializer):
    reminders = ReminderSerializer(many=True, read_only=True)

    class Meta(FolderSerializer.Meta):
        fields = (
            "id",
            "name",
            "description",
            "board",
            "created_by",
            "created_at",
            "order",
            "reminders_count",
            "reminders",
        )
