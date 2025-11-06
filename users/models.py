from django.contrib.auth.models import AbstractUser
from django.db import models
import os


def user_avatar_path(instance, filename):
    # Файл будет загружен в MEDIA_ROOT/avatars/user_<id>/<filename>
    return f"avatars/user_{instance.id}/{filename}"


class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    avatar = models.ImageField(
        upload_to=user_avatar_path,
        null=True,
        blank=True,
        default="avatars/default_avatar.png",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    groups_joined = models.ManyToManyField(
        "Group",
        through="GroupMembership",
        through_fields=("user", "group"),
        related_name="members_direct",
        blank=True,
    )

    def __str__(self):
        return self.username

    def save(self, *args, **kwargs):
        # При первом сохранении устанавливаем дефолтный аватар
        if not self.avatar:
            self.avatar = "avatars/default_avatar.png"
        super().save(*args, **kwargs)

    @property
    def accessible_groups(self):
        """Все группы доступные пользователю (участник + публичные)"""
        from django.db.models import Q

        return Group.objects.filter(
            Q(members_direct=self) | Q(is_public=True)
        ).distinct()

    def get_group_access_level(self, group):
        """Получить уровень доступа пользователя в группе"""
        try:
            membership = self.group_memberships.get(group=group)
            return membership.access_level
        except GroupMembership.DoesNotExist:
            return None

    def is_group_member(self, group):
        """Проверяет является ли пользователь участником группы"""
        return self.groups_joined.filter(id=group.id).exists()

    def is_group_admin(self, group):
        """Проверяет является ли пользователь администратором группы"""
        return self.group_memberships.filter(
            group=group, access_level=Group.AccessLevel.ADMIN
        ).exists()

    def get_user_boards(self):
        """Все доски доступные пользователю"""
        from django.db.models import Q

        return Board.objects.filter(
            Q(created_by=self) | Q(group__in=self.groups_joined.all())
        ).distinct()


def user_avatar_path(instance, filename):
    return f"avatars/user_{instance.id}/{filename}"


class Group(models.Model):
    class AccessLevel(models.TextChoices):
        READ = "read", "Только чтение"
        WRITE = "write", "Запись"
        ADMIN = "admin", "Администратор"

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="created_groups",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_public = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Группа"
        verbose_name_plural = "Группы"

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
        self.members_direct.remove(user)

    def get_members_with_access(self, access_level=None):
        """Получить участников с определенным уровнем доступа"""
        memberships = self.memberships.all()
        if access_level:
            memberships = memberships.filter(access_level=access_level)
        return memberships


class GroupMembership(models.Model):
    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="group_memberships"
    )
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="memberships"
    )
    access_level = models.CharField(
        max_length=10, choices=Group.AccessLevel.choices, default=Group.AccessLevel.READ
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    invited_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invited_members",
    )

    class Meta:
        unique_together = ["user", "group"]
        verbose_name = "Участник группы"
        verbose_name_plural = "Участники групп"

    def __str__(self):
        return f"{self.user.username} - {self.group.name} ({self.access_level})"

    def save(self, *args, **kwargs):
        """При сохранении обновляем прямую связь ManyToMany"""
        super().save(*args, **kwargs)
        # Добавляем группу в прямую связь пользователя
        if self.group not in self.user.groups_joined.all():
            self.user.groups_joined.add(self.group)

    def delete(self, *args, **kwargs):
        """При удалении убираем группу из прямой связи"""
        group = self.group
        user = self.user
        super().delete(*args, **kwargs)
        # Убираем группу из прямой связи если это последнее членство
        if not GroupMembership.objects.filter(user=user, group=group).exists():
            user.groups_joined.remove(group)


class Board(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="created_boards"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    color = models.CharField(max_length=7, default="#667eea")
    is_private = models.BooleanField(default=True)

    # Связь с группами
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="boards", null=True, blank=True
    )

    class Meta:
        verbose_name = "Доска"
        verbose_name_plural = "Доски"
        ordering = ["-created_at"]

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
            return user.get_group_access_level(self.group)
        return None


class Folder(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name="folders")
    created_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    order = models.IntegerField(default=0)

    class Meta:
        verbose_name = "Папка"
        verbose_name_plural = "Папки"
        ordering = ["order", "created_at"]
        unique_together = ["board", "name"]

    def __str__(self):
        return f"{self.name} ({self.board.title})"

    def user_has_access(self, user):
        return self.board.user_has_access(user)


class Reminder(models.Model):
    class Priority(models.TextChoices):
        LOW = "low", "Низкий"
        MEDIUM = "medium", "Средний"
        HIGH = "high", "Высокий"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    due_date = models.DateTimeField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    priority = models.CharField(
        max_length=10, choices=Priority.choices, default=Priority.MEDIUM
    )
    color = models.CharField(max_length=7, default="#ffffff")
    font = models.CharField(max_length=50, default="Arial")

    folder = models.ForeignKey(
        Folder,
        on_delete=models.CASCADE,
        related_name="reminders",
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="created_reminders"
    )
    assigned_to = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_reminders",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Напоминание"
        verbose_name_plural = "Напоминания"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    def user_has_access(self, user):
        return self.folder.user_has_access(user)

    def save(self, *args, **kwargs):
        if self.is_completed and not self.completed_at:
            from django.utils import timezone

            self.completed_at = timezone.now()
        elif not self.is_completed and self.completed_at:
            self.completed_at = None
        super().save(*args, **kwargs)
