import vedro
from .base import BaseScenario

class WebSocketConnectionTest(BaseScenario):
    subject = "Проверка подключения к WebSocket"

    async def run(self):
        # Отправляем тестовое сообщение
        await self.ws.send_message({"type": "ping"})

        # Ожидаем ответ
        response = await self.ws.receive_message()

        # Проверяем ответ
        assert response["type"] == "pong", "Неверный тип ответа"