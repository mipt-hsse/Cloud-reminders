from django.contrib.auth.models import AbstractUser
from django.db import models
from reminders.models import Group, GroupMembership, Folder, Board
import os


def user_avatar_path(instance, filename):
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
    # groups_joined = models.ManyToManyField(
    #     "reminders.Group",  # ← Ссылка на модель в другом приложении
    #     through="reminders.GroupMembership",
    #     through_fields=("user", "group"),
    #     related_name="members_direct",
    #     blank=True,
    # )

    def __str__(self):
        return self.username

    def save(self, *args, **kwargs):
        if not self.avatar:
            self.avatar = "avatars/default_avatar.png"
        super().save(*args, **kwargs)

    '''
    def get_accessible_groups(self):
        """Property для получения доступных групп"""
        from reminders.models import Group
        from django.db.models import Q

        return Group.objects.filter(
            Q(members_direct=self) | Q(is_public=True)
        ).distinct()

    def is_group_member(self, group):
        """Проверяет является ли пользователь участником группы"""
        return self.groups_joined.filter(id=group.id).exists()

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

    def get_group_membership(self, group):
        """Получить объект членства в группе"""
        try:
            return self.group_memberships.get(group=group)
        except GroupMembership.DoesNotExist:
            return None

    def get_group_access_level(self, group):
        """Получить уровень доступа в группе"""
        membership = self.get_group_membership(group)
        return membership.access_level if membership else None

    def is_group_member(self, group):
        """Проверяет является ли пользователь участником группы"""
        return self.groups_joined.filter(id=group.id).exists()

    def is_group_admin(self, group):
        """Проверяет является ли пользователь администратором группы"""
        membership = self.get_group_membership(group)
        return membership and membership.access_level == Group.AccessLevel.ADMIN

    def get_user_groups_with_access(self):
        """Получить все группы пользователя с информацией о доступе"""
        memberships = self.group_memberships.select_related("group")
        return [
            {
                "group": membership.group,
                "access_level": membership.access_level,
                "joined_at": membership.joined_at,
                "invited_by": membership.invited_by,
            }
            for membership in memberships
        ]
    '''
