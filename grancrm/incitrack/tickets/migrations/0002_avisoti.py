from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AvisoTI',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo', models.CharField(
                    choices=[
                        ('info', 'Informativo'),
                        ('advertencia', 'Advertencia'),
                        ('critico', 'Crítico'),
                        ('resolucion', 'Resolución'),
                    ],
                    default='info',
                    max_length=20,
                )),
                ('contenido', models.TextField(help_text='Mensaje del aviso (máx. 500 caracteres)')),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                ('expira_en', models.DateTimeField(help_text='Calculado automáticamente: fecha_creacion + 24h')),
                ('activo', models.BooleanField(default=True)),
                ('creado_por', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='avisos_creados',
                    to='tickets.usuario',
                    db_constraint=False,
                )),
            ],
            options={
                'verbose_name': 'Aviso TI',
                'verbose_name_plural': 'Avisos TI',
                'ordering': ['-fecha_creacion'],
            },
        ),
    ]
