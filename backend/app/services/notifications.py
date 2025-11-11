from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class NotificationPayload:
    recipient: str
    channel: str
    message: str


class NotificationSink:
    """Pluggable notification handler. Default implementation logs to stdout."""

    def notify_supervisor(self, payload: NotificationPayload) -> None:  # pragma: no cover
        print(f"[SUPERVISOR NOTIFY] -> {payload.recipient} via {payload.channel}: {payload.message}")

    def notify_customer(self, payload: NotificationPayload) -> None:  # pragma: no cover
        print(f"[CUSTOMER NOTIFY] -> {payload.recipient} via {payload.channel}: {payload.message}")


console_notifier = NotificationSink()
