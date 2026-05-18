import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reminders", "0003_boardcollaborator_created_at_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="board",
            name="parent",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="child_boards",
                to="reminders.board",
            ),
        ),
    ]
