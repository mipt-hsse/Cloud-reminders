from django.db import models
from django.db.models import Q, Exists, OuterRef


class GroupManager(models.Manager):
    def for_user(self, user):
        """Оптимизированный запрос групп пользователя"""
        from users.models import GroupMembership

        # Используем EXISTS подзапрос для эффективной проверки членства
        return (
            self.get_queryset()
            .filter(Q(memberships__user=user) | Q(is_public=True))
            .distinct()
            .select_related("created_by")
        )

    def with_user_membership(self, user):
        """Группы с информацией о членстве пользователя"""
        from users.models import GroupMembership

        return self.get_queryset().annotate(
            user_is_member=Exists(
                GroupMembership.objects.filter(group=OuterRef("pk"), user=user)
            ),
            user_access_level=models.Subquery(
                GroupMembership.objects.filter(group=OuterRef("pk"), user=user).values(
                    "access_level"
                )[:1]
            ),
        )


class BoardManager(models.Manager):
    def for_user(self, user):
        """Оптимизированный запрос досок пользователя"""
        from users.models import GroupMembership

        # Личные доски пользователя + доски из групп где он состоит
        return (
            self.get_queryset()
            .filter(Q(created_by=user) | Q(group__memberships__user=user))
            .distinct()
            .select_related("created_by", "group")
        )

    def accessible_to_user(self, user, board_ids):
        """Быстрая проверка доступа к списку досок"""
        from users.models import GroupMembership

        return (
            self.get_queryset()
            .filter(id__in=board_ids)
            .filter(Q(created_by=user) | Q(group__memberships__user=user))
            .values_list("id", flat=True)
        )


class GroupMembershipManager(models.Manager):
    def user_groups(self, user):
        """Все группы пользователя с уровнями доступа"""
        return self.get_queryset().filter(user=user).select_related("group")

    def user_group_ids(self, user):
        """Только ID групп пользователя"""
        return self.get_queryset().filter(user=user).values_list("group_id", flat=True)

    def is_user_in_group(self, user, group_id):
        """Быстрая проверка нахождения пользователя в группе"""
        return self.get_queryset().filter(user=user, group_id=group_id).exists()


# Применяем менеджеры к моделям
models.Group.objects = GroupManager.from_queryset(models.Group.objects)()
models.Board.objects = BoardManager.from_queryset(models.Board.objects)()
models.GroupMembership.objects = GroupMembershipManager.from_queryset(
    models.GroupMembership.objects
)()
