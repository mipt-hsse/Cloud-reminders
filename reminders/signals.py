from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import GroupMembership, Group


@receiver(post_save, sender=Group)
def add_creator_to_group(sender, instance, created, **kwargs):
    """Автоматически добавляем создателя как администратора при создании группы"""
    if created:
        GroupMembership.objects.get_or_create(
            user=instance.created_by,
            group=instance,
            defaults={
                "access_level": Group.AccessLevel.ADMIN,
                "invited_by": instance.created_by,
            },
        )


@receiver(post_save, sender=GroupMembership)
def sync_groups_joined_on_save(sender, instance, created, **kwargs):
    """Синхронизируем groups_joined при сохранении GroupMembership"""
    if instance.group not in instance.user.groups_joined.all():
        instance.user.groups_joined.add(instance.group)


@receiver(post_delete, sender=GroupMembership)
def sync_groups_joined_on_delete(sender, instance, **kwargs):
    """Синхронизируем groups_joined при удалении GroupMembership"""
    if instance.group in instance.user.groups_joined.all():
        instance.user.groups_joined.remove(instance.group)
