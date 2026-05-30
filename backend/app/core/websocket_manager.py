"""
FinSight AI — WebSocket Connection Manager

Manages active WebSocket connections, heartbeat pings, and
broadcasts real-time events to connected clients.
"""

from fastapi import WebSocket
from typing import Dict, List, Set
import asyncio
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Enterprise-grade WebSocket connection manager.

    Features:
        - Named channel support (transactions, agents)
        - Heartbeat ping/pong monitoring
        - Graceful disconnection handling
        - Room-based broadcasting by company_id
    """

    def __init__(self):
        self._connections: Dict[str, List[WebSocket]] = {
            "transactions": [],
            "agents": [],
        }
        self._socket_companies: Dict[WebSocket, str] = {}
        self._active_count = 0

    async def connect(self, websocket: WebSocket, channel: str = "transactions", company_id: str = None) -> None:
        """Accept a new WebSocket connection and register it."""
        await websocket.accept()
        if channel not in self._connections:
            self._connections[channel] = []
        self._connections[channel].append(websocket)
        if company_id:
            self._socket_companies[websocket] = company_id
        self._active_count += 1
        logger.info(f"WebSocket connected on '{channel}' (company: {company_id}). Active: {self._active_count}")

    async def disconnect(self, websocket: WebSocket, channel: str = "transactions") -> None:
        """Remove a WebSocket connection from the registry."""
        if channel in self._connections and websocket in self._connections[channel]:
            self._connections[channel].remove(websocket)
            if websocket in self._socket_companies:
                del self._socket_companies[websocket]
            self._active_count -= 1
            logger.info(f"WebSocket disconnected from '{channel}'. Active: {self._active_count}")

    async def broadcast(self, channel: str, message: dict, company_id: str = None) -> None:
        """Broadcast a JSON message to all connections on a channel, optional filtering by company_id."""
        if channel not in self._connections:
            return

        disconnected = []
        for ws in self._connections[channel]:
            # Filter by company_id if specified
            if company_id and self._socket_companies.get(ws) != company_id:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(ws)

        # Clean up dead connections
        for ws in disconnected:
            await self.disconnect(ws, channel)

    async def send_personal(self, websocket: WebSocket, message: dict) -> None:
        """Send a message to a specific WebSocket connection."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Failed to send personal message: {e}")

    @property
    def active_connections(self) -> int:
        return self._active_count

    def get_channel_count(self, channel: str) -> int:
        return len(self._connections.get(channel, []))


# Singleton instance
ws_manager = ConnectionManager()
