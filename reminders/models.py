from django.db import models
from django.contrib.postgres.indexes import GinIndex


class Group(models.Model):
    class AccessLevel(models.TextChoices):
        READ = "read", "Только чтение"
        WRITE = "write", "Запись"
        ADMIN = "admin", "Администратор"

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        "users.CustomUser",  # ← Ссылка на модель в другом приложении
        on_delete=models.CASCADE,
        related_name="created_groups",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["name"]),
            GinIndex(fields=["settings"], name="group_settings_gin"),
        ]

    @property
    def is_public(self):
        return self.settings.get("is_public", False)

    @is_public.setter
    def is_public(self, value):
        self.settings["is_public"] = bool(value)

    def __str__(self):
        return self.name

    def add_member(self, user, access_level=AccessLevel.READ, invited_by=None):
        """Добавить участника в группу"""
        membership, created = GroupMembership.objects.get_or_create(
            user=user,
            group=self,
            defaults={"access_level": access_level, "invited_by": invited_by},
        )
        if not created:
            membership.access_level = access_level
            membership.save()
        return membership

    def remove_member(self, user):
        """Удалить участника из группы"""
        GroupMembership.objects.filter(user=user, group=self).delete()


class GroupMembership(models.Model):
    class AccessLevel(models.TextChoices):
        READ = "read", "Reading"
        WRITE = "write", "Editing"
        ADMIN = "admin", "Admin"

    user = models.ForeignKey(
        "users.CustomUser", on_delete=models.CASCADE, related_name="memberships"
    )
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="memberships"
    )
    access_level = models.CharField(
        max_length=10, choices=AccessLevel.choices, default=AccessLevel.READ
    )

    class Meta:
        unique_together = ["user", "group"]  # Гарантия уникальности
        indexes = [
            models.Index(
                fields=["user", "group"]
            ),  # Быстрый поиск "есть ли юзер в группе"
        ]


class Board(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        "users.CustomUser", on_delete=models.CASCADE, related_name="created_boards"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    color = models.CharField(max_length=7, default="#ffffff")
    is_private = models.BooleanField(default=True)

    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="boards", null=True, blank=True
    )
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["group"]),
            models.Index(fields=["created_by"]),
        ]

    def __str__(self):
        return self.title

    def user_has_access(self, user):
        """Проверяет есть ли у пользователя доступ к доске"""
        if self.created_by == user:
            return True
        if self.group and user.is_group_member(self.group):
            return True
        return False

    def user_access_level(self, user):
        """Возвращает уровень доступа пользователя к доске"""
        if self.created_by == user:
            return Group.AccessLevel.ADMIN

        if self.group:
            try:
                membership = GroupMembership.objects.get(user=user, group=self.group)
                return membership.access_level
            except GroupMembership.DoesNotExist:
                return None
        return None


class BoardItem(models.Model):

    class ItemType(models.TextChoices):
        TASK = "task", "Напоминание/Задача"
        STICKER = "sticker", "Стикер/Заметка"
        TEXT = "text", "Текст"
        ARROW = "arrow", "Стрелка/Линия"
        DRAWING = "drawing", "Рисунок (Paint)"
        IMAGE = "image", "Картинка"

    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name="items")
    item_type = models.CharField(max_length=20, choices=ItemType.choices)

    geometry = models.JSONField(default=dict)

    style = models.JSONField(default=dict, blank=True)

    content_payload = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["board"])]

    def __str__(self):
        return f"{self.item_type} ({self.id})"


class TaskData(models.Model):
    item = models.OneToOneField(
        BoardItem, on_delete=models.CASCADE, related_name="task_data"
    )

    assigned_to = models.ForeignKey(
        "users.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
    )
    due_date = models.DateTimeField(null=True, blank=True, db_index=True)
    is_completed = models.BooleanField(default=False)
    priority = models.CharField(max_length=10, default="medium")

    description = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["assigned_to", "is_completed"]),
        ]
