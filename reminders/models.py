import uuid
from django.conf import settings
from django.db import models
from users.views import CustomUser


class WorkGroup(models.Model):
    name = models.CharField(max_length=255, verbose_name="Название группы")
    description = models.TextField(blank=True, verbose_name="Описание")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# --- 2. УЧАСТНИКИ ГРУППЫ И ИХ РОЛИ ---
class GroupMember(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Администратор"  # Может удалять группу, добавлять людей
        EDITOR = "editor", "Редактор"  # Может создавать и редактировать доски
        VIEWER = "viewer", "Читатель"  # Может только смотреть доски группы

    group = models.ForeignKey(
        WorkGroup, on_delete=models.CASCADE, related_name="members"
    )
    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="workgroup_memberships"
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.VIEWER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "user")  # Один юзер не может быть в группе дважды


# --- 3. ОБНОВЛЕННАЯ ДОСКА ---
class Board(models.Model):
    title = models.CharField(max_length=200)
    owner = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="owned_boards",
        null=True,
        blank=True,
    )
    group = models.ForeignKey(
        "WorkGroup",
        on_delete=models.CASCADE,
        related_name="boards",
        null=True,
        blank=True,
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="child_boards",
        null=True,
        blank=True,
    )
    settings = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # --- ПРОВЕРКА ПРАВ  ---
    def _direct_user_can_read(self, user):
        if self.owner == user:
            return True
        if self.group and self.group.members.filter(user=user).exists():
            return True
        if self.collaborators.filter(
            user=user, status=BoardCollaborator.Status.ACCEPTED
        ).exists():
            return True
        return False

    def user_can_read(self, user):
        """Может ли пользователь смотреть доску (включая доступ по цепочке родителей)."""
        if not user.is_authenticated:
            return False
        seen = set()
        node = self
        while node is not None:
            if node.id in seen:
                return False
            seen.add(node.id)
            if node._direct_user_can_read(user):
                return True
            node = node.parent
        return False

    def _direct_user_can_edit(self, user):
        if self.owner == user:
            return True
        if self.group:
            member = self.group.members.filter(user=user).first()
            if member and member.role in [
                GroupMember.Role.ADMIN,
                GroupMember.Role.EDITOR,
            ]:
                return True
        collab = self.collaborators.filter(
            user=user, status=BoardCollaborator.Status.ACCEPTED
        ).first()
        if collab and collab.access_level == BoardCollaborator.AccessLevel.EDITOR:
            return True
        return False

    def user_can_edit(self, user):
        """Может ли пользователь изменять доску (включая права редактора на предке)."""
        if not user.is_authenticated:
            return False
        seen = set()
        node = self
        while node is not None:
            if node.id in seen:
                return False
            seen.add(node.id)
            if node._direct_user_can_edit(user):
                return True
            node = node.parent
        return False


# --- 4. ПРЯМОЙ ДОСТУП К ЛИЧНЫМ ДОСКАМ (ШАРИНГ) ---
class BoardCollaborator(models.Model):
    class AccessLevel(models.TextChoices):
        EDITOR = "editor", "Редактор"
        VIEWER = "viewer", "Читатель"

    class Status(models.TextChoices):
        PENDING = "pending", "Ожидает подтверждения"
        ACCEPTED = "accepted", "Принято"

    board = models.ForeignKey(
        Board, on_delete=models.CASCADE, related_name="collaborators"
    )
    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="shared_boards"
    )
    access_level = models.CharField(
        max_length=20, choices=AccessLevel.choices, default=AccessLevel.VIEWER
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("board", "user")


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
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
        # verbose_name="Ответственный",
    )
    due_date = models.DateTimeField(null=True, blank=True, db_index=True)
    is_completed = models.BooleanField(default=False)
    priority = models.CharField(max_length=10, default="medium")

    description = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["assigned_to", "is_completed"]),
        ]
