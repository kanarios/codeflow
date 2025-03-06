import vedro
import vedro.plugins.director
from plugins.websocket import WebSocketConfig

class Config(vedro.Config):
    class Plugins(vedro.Config.Plugins):
        class Director(vedro.plugins.director.Director):
            enabled = True

        class WebSocket(WebSocketConfig):
            enabled = True