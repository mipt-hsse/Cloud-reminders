from django.contrib.auth.models import AbstractUser
from django.db import models
import os


def user_avatar_path(instance, filename):
    return f"avatars/user_{instance.id}/{filename}"


class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    avatar = models.ImageField(
        upload_to=user_avatar_path,
        null=True,
        blank=True,
        default="",
    )
    preferences = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.username

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
