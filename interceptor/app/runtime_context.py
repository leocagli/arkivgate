from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

import httpx

from .cli_auth import CliCaller
from .models import Policy

logger = logging.getLogger("app.runtime_context")


@dataclass
class RuntimeContext:
    caller: CliCaller
    policies: list[Policy]


def _bridge_origin(bridge_url: str | None) -> str | None:
    if not bridge_url:
        return None
    marker = "/api/internal/arkiv/interactions"
    return bridge_url.removesuffix(marker) if bridge_url.endswith(marker) else None


def _policy_from_json(raw: dict[str, Any]) -> Policy:
    return Policy(
        id=UUID(str(raw["id"])),
        org_id=str(raw.get("orgId", "demo")),
        slug=str(raw["slug"]),
        domain=raw["domain"],
        layer=raw["layer"],
        rule=str(raw["rule"]),
        pattern=raw.get("pattern"),
        default_action=raw["defaultAction"],
        severity=raw["severity"],
        source=raw["source"],
        is_active=bool(raw.get("isActive", True)),
        created_at=datetime.fromisoformat(str(raw["createdAt"])),
        updated_at=datetime.fromisoformat(str(raw["updatedAt"])),
    )


async def fetch_runtime_context(
    *,
    token: str,
    bridge_url: str | None,
    bridge_token: str | None,
) -> RuntimeContext | None:
    origin = _bridge_origin(bridge_url)
    if not origin or not bridge_token:
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{origin}/api/internal/interceptor/context",
                json={"token": token},
                headers={
                    "content-type": "application/json",
                    "x-arkiv-bridge-token": bridge_token,
                },
            )
    except Exception:
        logger.exception("[runtime-context] bridge lookup failed")
        return None

    if resp.status_code == 401:
        return None
    if resp.status_code >= 400:
        logger.warning("[runtime-context] non-2xx status=%s body=%s", resp.status_code, resp.text[:500])
        return None

    data = resp.json()
    caller_raw = data.get("caller") or {}
    policies_raw = data.get("policies") or []

    caller = CliCaller(
        member_id=UUID(str(caller_raw["memberId"])),
        org_id=str(caller_raw["orgId"]),
        email=str(caller_raw["email"]),
    )

    return RuntimeContext(
        caller=caller,
        policies=[_policy_from_json(policy) for policy in policies_raw],
    )