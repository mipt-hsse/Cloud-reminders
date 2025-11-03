from django.contrib.auth.models import AbstractUser
from django.db import models


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

    def __str__(self):
        return self.username

    def save(self, *args, **kwargs):
        # При первом сохранении устанавливаем дефолтный аватар
        if not self.avatar:
            self.avatar = "avatars/default_avatar.png"
        super().save(*args, **kwargs)

    # Добавляем related_name чтобы избежать конфликтов
    groups = models.ManyToManyField(
        "auth.Group",
        verbose_name="groups",
        blank=True,
        help_text="The groups this user belongs to.",
        related_name="customuser_set",
        related_query_name="user",
    )
    user_permissions = models.ManyToManyField(
        "auth.Permission",
        verbose_name="user permissions",
        blank=True,
        help_text="Specific permissions for this user.",
        related_name="customuser_set",
        related_query_name="user",
    )

    def __str__(self):
        return self.username
