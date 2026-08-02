import json
import os
import re
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator


ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"

SYSTEM_PROMPT = """You are a strict app-spec extractor. You convert a spoken (transcribed) app description into a JSON object matching this exact schema — nothing more, nothing less:
{
  \"app_name\": string,
  \"description\": string,
  \"entities\": [{ \"name\": string, \"fields\": [string] }],
  \"features\": [string],
  \"confidence\": \"high\" | \"medium\" | \"low\",
  \"clarification_needed\": string | null
}
Rules: output ONLY valid JSON; use a short catchy app_name; each entity name is singular PascalCase; fields are non-empty snake_case names; always include at least one entity and one feature; provide 3–6 short requested features only; do not infer types, auth, notifications, or sharing. If vague or materially ambiguous, use medium/low confidence with one short clarification question. If confidence is high, clarification_needed must be null. Never leave a field empty."""


class Entity(BaseModel):
    name: str = Field(min_length=1)
    fields: list[str] = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def pascal_case(cls, value: str) -> str:
        if not re.fullmatch(r"[A-Z][A-Za-z0-9]*", value):
            raise ValueError("entity names must be singular PascalCase")
        return value

    @field_validator("fields")
    @classmethod
    def snake_case_fields(cls, values: list[str]) -> list[str]:
        if any(not re.fullmatch(r"[a-z][a-z0-9_]*", field) for field in values):
            raise ValueError("field names must be snake_case")
        return values


class AppSpec(BaseModel):
    app_name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    entities: list[Entity] = Field(min_length=1)
    features: list[str] = Field(min_length=3, max_length=6)
    confidence: Literal["high", "medium", "low"]
    clarification_needed: str | None

    @field_validator("features")
    @classmethod
    def no_empty_features(cls, values: list[str]) -> list[str]:
        if any(not feature.strip() for feature in values):
            raise ValueError("features cannot be empty")
        return values

    def model_post_init(self, __context: Any) -> None:
        if self.confidence == "high" and self.clarification_needed is not None:
            raise ValueError("high confidence specs cannot require clarification")
        if self.confidence != "high" and not self.clarification_needed:
            raise ValueError("lower confidence specs need a clarification question")


class ParseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10_000)


async def call_llm(text: str, stricter: bool = False) -> str:
    """Call OpenAI's Responses API with an env-configured API key and model."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(503, "Parser is not configured. Set OPENAI_API_KEY and retry.")

    extra = " Your last response was not valid JSON matching the schema. Return ONLY the JSON object, no other text." if stricter else ""
    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        "input": f"{SYSTEM_PROMPT}{extra}\n\nNow parse this transcribed input:\n{json.dumps(text)}",
        "text": {"format": {"type": "json_object"}},
    }
    async with httpx.AsyncClient(timeout=40) as client:
        response = await client.post(
            "https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
    if response.is_error:
        raise HTTPException(502, "The spec parser could not be reached. Please try again.")
    data = response.json()
    try:
        return data["output"][0]["content"][0]["text"]
    except (KeyError, IndexError, TypeError) as error:
        raise ValueError("LLM response did not contain text") from error


async def parse_spec(text: str) -> AppSpec:
    for attempt in range(2):
        try:
            raw = await call_llm(text, stricter=attempt == 1)
            return AppSpec.model_validate_json(raw)
        except HTTPException:
            raise
        except Exception:
            continue
    raise HTTPException(422, "Sorry, I couldn't understand that clearly — could you describe your app idea again?")


app = FastAPI(title="voice-to-app")
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/", include_in_schema=False)
async def home() -> FileResponse:
    return FileResponse(STATIC / "index.html")


@app.post("/parse-spec", response_model=AppSpec)
async def parse_spec_endpoint(request: ParseRequest) -> AppSpec:
    return await parse_spec(request.text.strip())
