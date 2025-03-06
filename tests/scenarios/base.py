import vedro
from vedro.plugins.director import director
from plugins.websocket import WebSocketPlugin

class BaseScenario(vedro.Scenario):
    @director.register_hook
    async def before_scenario(self):
        self.ws = WebSocketPlugin.get_instance()
        await self.ws.connect("ws://localhost:8080/ws")  # Укажите правильный URL вашего WebSocket сервера

    @director.register_hook
    async def after_scenario(self):
        await self.ws.close()