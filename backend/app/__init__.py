from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

load_dotenv()


def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Imported here so .env is loaded before the database pool and graph are created.
    from .checkpointer import checkpointer, pool
    from .graph import chatbot
    from .repositories import ThreadRepository
    from .routes import api
    from .services import ChatService

    threads = ThreadRepository(pool)
    threads.create_schema()  # creates the threads table if missing; safe on every start
    app.extensions["chat_service"] = ChatService(chatbot, checkpointer, threads)

    app.register_blueprint(api)
    return app
