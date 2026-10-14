import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("organizations", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Testimonial",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True,
                                           serialize=False, verbose_name="ID")),
                ("quote", models.TextField(max_length=400)),
                ("author_name", models.CharField(max_length=120)),
                ("author_role", models.CharField(blank=True, max_length=160)),
                ("author_company", models.CharField(blank=True, max_length=160)),
                ("country", models.CharField(blank=True, max_length=80)),
                ("rating", models.PositiveSmallIntegerField(
                    default=5,
                    help_text="1-5. Published as Review schema, so it must be what they gave.")),
                ("consent", models.BooleanField(
                    default=False,
                    help_text="Explicit permission to publish. Approval is refused without it.")),
                ("consent_text", models.TextField(
                    blank=True,
                    help_text="The exact wording agreed to, as shown at submission.")),
                ("consent_at", models.DateTimeField(blank=True, null=True)),
                ("status", models.CharField(
                    choices=[("pending", "Pending review"), ("approved", "Approved"),
                             ("rejected", "Rejected")],
                    default="pending", max_length=10)),
                ("featured", models.BooleanField(
                    default=False, help_text="Show in the carousel on the landing page.")),
                ("sort", models.IntegerField(
                    default=0, help_text="Lower sorts first within featured.")),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("review_note", models.CharField(blank=True, max_length=300)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("organization", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="testimonials", to="organizations.organization")),
                ("author", models.ForeignKey(
                    help_text="Who submitted it. Kept null-able so deleting a user does not "
                              "delete a testimonial they consented to publish.",
                    null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name="testimonials", to=settings.AUTH_USER_MODEL)),
                ("reviewed_by", models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name="testimonials_reviewed", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("sort", "-created_at")},
        ),
        migrations.AddIndex(
            model_name="testimonial",
            index=models.Index(fields=["status", "featured"],
                               name="testimonial_status_f3ec67_idx"),
        ),
    ]
