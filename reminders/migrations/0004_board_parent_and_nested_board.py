from django.db import migrations, models
import django.db.models.deletion


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
                related_name="children",
                to="reminders.board",
            ),
        ),
        migrations.AlterField(
            model_name="boarditem",
            name="item_type",
            field=models.CharField(
                choices=[
                    ("task", "Напоминание/Задача"),
                    ("sticker", "Стикер/Заметка"),
                    ("text", "Текст"),
                    ("arrow", "Стрелка/Линия"),
                    ("drawing", "Рисунок (Paint)"),
                    ("image", "Картинка"),
                    ("nested_board", "Вложенная доска"),
                ],
                max_length=20,
            ),
        ),
    ]
