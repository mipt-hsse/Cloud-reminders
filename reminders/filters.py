import django_filters
from .models import Group


class GroupFilter(django_filters.FilterSet):
    # Говорим фильтру искать внутри JSON
    is_public = django_filters.BooleanFilter(field_name="settings__is_public")

    class Meta:
        model = Group
        fields = ["created_by"]
