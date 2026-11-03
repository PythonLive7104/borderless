# Hand-written: Docker on the authoring machine had a wedged container that
# blocked `makemigrations`. Verify with `manage.py makemigrations --check
# --dry-run` before deploying — it must report no changes.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("organizations", "0001_initial"),
        ("referrals", "0001_initial"),
    ]

    operations = [
        # The wallet began as referral credit only. It now also holds money the
        # customer paid in, so the ledger has to say which is which.
        migrations.AlterField(
            model_name="creditentry",
            name="kind",
            field=models.CharField(
                choices=[
                    ("earned", "Earned from a referral"),
                    ("redeemed", "Redeemed against a plan"),
                    ("adjustment", "Manual adjustment"),
                    ("topup", "Added by the customer"),
                    ("spent", "Spent on a domain or add-on"),
                    ("refund", "Refunded to the wallet"),
                ],
                max_length=12,
            ),
        ),
        migrations.CreateModel(
            name="WalletTopup",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True,
                                           serialize=False, verbose_name="ID")),
                ("bachs_session_id", models.CharField(blank=True, db_index=True,
                                                      default="", max_length=120)),
                ("amount_cents", models.IntegerField(
                    default=0, help_text="Confirmed amount; 0 until paid.")),
                ("status", models.CharField(
                    choices=[("pending", "Awaiting payment"),
                             ("credited", "Paid and credited"),
                             ("failed", "Payment did not complete")],
                    db_index=True, default="pending", max_length=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("credited_at", models.DateTimeField(blank=True, null=True)),
                ("organization", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="wallet_topups", to="organizations.organization")),
                ("user", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="wallet_topups", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-created_at",)},
        ),
    ]
