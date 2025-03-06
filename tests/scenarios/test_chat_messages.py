import vedro
from .base import BaseScenario

class ChatMessagesTest(BaseScenario):
    subject = "Проверка обмена сообщениями в чате"

    async def run(self):
        # Отправляем сообщение в чат
        test_message = {
            "type": "message",
            "content": "Тестовое сообщение",
            "user": "test_user"
        }
        await self.ws.send_message(test_message)

        # Получаем подтверждение
        response = await self.ws.receive_message()

        # Проверяем ответ
        assert response["type"] == "message_received", "Сообщение не получено"
        assert response["status"] == "success", "Статус сообщения не success"