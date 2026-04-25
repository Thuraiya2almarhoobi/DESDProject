import json
from dataclasses import dataclass
from typing import Any

from django.conf import settings


class VertexAIUnavailable(Exception):
    pass


class VertexAIResponseError(Exception):
    pass


@dataclass(frozen=True)
class GeneratedSuggestion:
    title: str
    description: str = ""
    ingredients: str = ""
    instructions: str = ""
    body: str = ""
    seasonal_tag: str = ""


def _load_authorized_session():
    try:
        import google.auth
        from google.auth.transport.requests import AuthorizedSession
    except ImportError as exc:
        raise VertexAIUnavailable("Vertex AI support is not installed in this environment.") from exc

    try:
        credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    except Exception as exc:
        raise VertexAIUnavailable("Vertex AI credentials are not available in this environment.") from exc
    return AuthorizedSession(credentials)


def _extract_json_array(text: str) -> list[dict[str, Any]]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start == -1 or end == -1 or end <= start:
        raise VertexAIResponseError("Vertex AI returned content that was not a JSON array.")
    parsed = json.loads(cleaned[start : end + 1])
    if not isinstance(parsed, list):
        raise VertexAIResponseError("Vertex AI returned an unexpected response shape.")
    return parsed


def _build_prompt(content_type: str, products: list[dict[str, Any]], context: dict[str, Any]) -> str:
    return (
        "You are writing producer-owned marketplace content for a Bristol local food platform.\n"
        "Return exactly 3 options as a JSON array and no markdown.\n"
        "Each option must be safe, specific, warm, concise, and editable by the producer.\n"
        "Do not make medical, health-cure, nutrition-cure, or allergen-safety claims.\n"
        "Do not invent certifications, awards, reviews, or facts not present in the context.\n"
        "For recipes, use keys: title, description, ingredients, instructions, seasonal_tag.\n"
        "For farm stories, use keys: title, body, seasonal_tag.\n"
        f"Requested content type: {content_type}\n"
        f"Producer and request context: {json.dumps(context, default=str)}\n"
        f"Selected products: {json.dumps(products, default=str)}\n"
    )


def generate_content_suggestions(
    *,
    content_type: str,
    products: list[dict[str, Any]],
    context: dict[str, Any],
) -> list[GeneratedSuggestion]:
    project_id = (getattr(settings, "VERTEX_AI_PROJECT_ID", "") or "").strip()
    location = (getattr(settings, "VERTEX_AI_LOCATION", "") or "").strip()
    model = (getattr(settings, "VERTEX_AI_MODEL", "") or "").strip()
    timeout_seconds = getattr(settings, "VERTEX_AI_TIMEOUT_SECONDS", 30)

    if not project_id or not location or not model:
        raise VertexAIUnavailable("Vertex AI is not configured for this environment.")

    prompt = _build_prompt(content_type, products, context)
    endpoint = (
        f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}"
        f"/locations/{location}/publishers/google/models/{model}:generateContent"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.75,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
        },
    }

    session = _load_authorized_session()
    try:
        response = session.post(endpoint, json=payload, timeout=timeout_seconds)
    except Exception as exc:
        raise VertexAIResponseError("Vertex AI request failed.") from exc
    if response.status_code >= 400:
        raise VertexAIResponseError(f"Vertex AI returned status {response.status_code}.")

    data = response.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        raise VertexAIResponseError("Vertex AI returned an unexpected response shape.") from exc

    rows = _extract_json_array(text)
    suggestions: list[GeneratedSuggestion] = []
    for row in rows[:3]:
        if not isinstance(row, dict):
            continue
        title = str(row.get("title", "")).strip()
        if not title:
            continue
        suggestions.append(
            GeneratedSuggestion(
                title=title,
                description=str(row.get("description", "")).strip(),
                ingredients=str(row.get("ingredients", "")).strip(),
                instructions=str(row.get("instructions", "")).strip(),
                body=str(row.get("body", "")).strip(),
                seasonal_tag=str(row.get("seasonal_tag", context.get("seasonal_tag", ""))).strip(),
            )
        )

    if len(suggestions) != 3:
        raise VertexAIResponseError("Vertex AI did not return 3 usable suggestions.")
    return suggestions
