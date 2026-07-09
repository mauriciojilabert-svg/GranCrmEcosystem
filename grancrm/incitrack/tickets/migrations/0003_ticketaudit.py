# Generated manually

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0002_avisoti'),
    ]

    operations = [
        migrations.CreateModel(
            name='TicketAudit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('campo_modificado', models.CharField(max_length=100)),
                ('valor_anterior', models.TextField(blank=True, null=True)),
                ('valor_nuevo', models.TextField(blank=True, null=True)),
                ('fecha_modificacion', models.DateTimeField(auto_now_add=True)),
                ('ticket', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='auditorias', to='tickets.ticket')),
                ('usuario', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='auditorias_realizadas', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Auditoría de Ticket',
                'verbose_name_plural': 'Auditorías de Tickets',
                'ordering': ['-fecha_modificacion'],
            },
        ),
    ]
