from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Dict

try:  # pragma: no cover - optional dependency at runtime
    from livekit import agents
    from livekit.agents import cli
except ImportError:  # pragma: no cover
    agents = None
    cli = None

from .services.livekit_agent import LiveKitAgentBridge


@dataclass
class IncomingCall:
    customer_name: str
    channel: str
    question: str
    customer_contact: str | None = None


async def handle_job(job: "agents.JobRequest", ctx: "agents.JobContext") -> None:
    """Entry point for LiveKit jobs."""

    bridge = LiveKitAgentBridge()
    metadata: Dict[str, Any] = job.input or {}
    call = IncomingCall(
        customer_name=metadata.get("customer_name", "Unknown Caller"),
        channel=metadata.get("channel", "phone"),
        question=metadata.get("question", ""),
        customer_contact=metadata.get("customer_contact"),
    )

    answer = bridge.handle_customer_question(
        customer_name=call.customer_name,
        channel=call.channel,
        question=call.question,
        customer_contact=call.customer_contact,
    )

    if answer:
        await ctx.send_message(answer)
    else:
        await ctx.send_message(
            "Let me check with my supervisor and get back to you shortly."
        )


def run_worker() -> None:
    if not cli or not agents:  # pragma: no cover
        raise RuntimeError(
            "livekit.agents is not installed. Install optional deps to run the worker."
        )
    cli.run_app(handle_job)


if __name__ == "__main__":  # pragma: no cover
    run_worker()
