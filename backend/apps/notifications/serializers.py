from rest_framework import serializers

from .models import Notification, NotifyChannel


class NotifyChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotifyChannel
        fields = ["id", "organization", "name", "prefix", "active", "last_used", "created_at"]
        read_only_fields = ["prefix", "last_used", "created_at"]


class NotificationSerializer(serializers.ModelSerializer):
    channel_name = serializers.CharField(source="channel.name", read_only=True)

    class Meta:
        model = Notification
        fields = ["id", "channel", "channel_name", "title", "message", "read", "created_at"]
        read_only_fields = fields
