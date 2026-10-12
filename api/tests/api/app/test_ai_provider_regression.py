import uuid

import pytest
from pydantic_ai.models.test import TestModel

from app.services import ai


class RecordingSession:
    def __init__(self):
        self.usage = []

    def add(self, value):
        self.usage.append(value)

    async def flush(self):
        pass


@pytest.mark.asyncio
async def test_google_provider_receives_settings_key_without_process_env(monkeypatch):
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(ai.settings, "GOOGLE_API_KEY", "offline-test-key")
    captured = {}
    provider_instance = object()

    def provider(*, api_key):
        captured["api_key"] = api_key
        return provider_instance

    def model(name, *, provider):
        captured["model"] = name
        captured["provider"] = provider
        return TestModel(custom_output_args={
            "tasks": [{
                "kind": "main",
                "text": "Billing works on staging",
                "why_it_matters": "Customers can finish purchases",
            }],
        })

    monkeypatch.setattr(ai, "GoogleProvider", provider)
    monkeypatch.setattr(ai, "GoogleModel", model)
    session = RecordingSession()

    draft = await ai.AIService(session, uuid.uuid4(), uuid.uuid4()).generate(
        "Finish billing on staging and prepare it for customer purchases."
    )

    assert captured == {
        "api_key": "offline-test-key",
        "model": "gemini-3.5-flash-lite",
        "provider": provider_instance,
    }
    assert isinstance(draft, ai.GeneratedPlan)
    assert draft.tasks[0].kind == "main"
    assert len(session.usage) == 1
    assert session.usage[0].outcome == "success"
