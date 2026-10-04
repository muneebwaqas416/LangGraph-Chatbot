from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from .checkpointer import checkpointer

# Models the UI is allowed to pick from; the first one is the default.
AVAILABLE_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"]
DEFAULT_MODEL = AVAILABLE_MODELS[0]
DEFAULT_TEMPERATURE = 0.0


class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


def chat_node(state: ChatState, config: RunnableConfig):
    # Model and temperature come per request via config["configurable"].
    configurable = config.get("configurable", {})
    llm = ChatOpenAI(
        model=configurable.get("model", DEFAULT_MODEL),
        temperature=configurable.get("temperature", DEFAULT_TEMPERATURE),
    )
    response = llm.invoke(state["messages"])
    return {"messages": [response]}


def build_chatbot():
    graph = StateGraph(ChatState)
    graph.add_node("chat", chat_node)
    graph.add_edge(START, "chat")
    graph.add_edge("chat", END)
    return graph.compile(checkpointer=checkpointer)


chatbot = build_chatbot()
