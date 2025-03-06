from typing import Optional, Any, Dict
import websockets
import asyncio
import json
from vedro.plugins import Plugin
from vedro.core import Dispatcher, PluginConfig

class WebSocketPlugin(Plugin):
    def __init__(self, config: "WebSocketConfig"):
        super().__init__(config)
        self._ws: Optional[websockets.WebSocketClientProtocol] = None

    async def connect(self, url: str):
        """Подключение к WebSocket серверу"""
        self._ws = await websockets.connect(url)

    async def send_message(self, message: Dict[str, Any]):
        """Отправка сообщения"""
        if not self._ws:
            raise RuntimeError("WebSocket не подключен")
        await self._ws.send(json.dumps(message))

    async def receive_message(self, timeout: float = 5.0) -> Dict[str, Any]:
        """Получение сообщения с таймаутом"""
        if not self._ws:
            raise RuntimeError("WebSocket не подключен")
        try:
            message = await asyncio.wait_for(self._ws.recv(), timeout=timeout)
            return json.loads(message)
        except asyncio.TimeoutError:
            raise TimeoutError(f"Не получено сообщение в течение {timeout} секунд")

    async def close(self):
        """Закрытие соединения"""
        if self._ws:
            await self._ws.close()
            self._ws = None

class WebSocketConfig(PluginConfig):
    plugin = WebSocketPlugin