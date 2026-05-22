import logging
from typing import Any

import httpx

logger = logging.getLogger("app.arkiv_bridge")


async def send_arkiv_event(
    *,
    bridge_url: str | None,
    bridge_token: str | None,
    payload: dict[str, Any],
) -> None:
    if not bridge_url:
        return

    headers = {"content-type": "application/json"}
    if bridge_token:
        headers["x-arkiv-bridge-token"] = bridge_token

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(bridge_url, json=payload, headers=headers)
            if resp.status_code >= 400:
                logger.warning(
                    "[arkiv_bridge] non-2xx status=%s body=%s",
                    resp.status_code,
                    resp.text[:500],
                )
    except Exception as exc:  # pragma: no cover
        logger.warning("[arkiv_bridge] failed type=%s detail=%r", type(exc).__name__, exc)
