"""
DESD Marketplace documentation.

File role:
    Source module for the content area.

Domain context:
    Content domain: recipes, farm stories, saved recipe feeds, and AI-assisted producer content generation.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

import json
from dataclasses import dataclass
from typing import Any

import requests
from django.conf import settings


class VertexAIUnavailable(Exception):
    """
    Documents the `VertexAIUnavailable` boundary for this module.

    The class belongs to the file role described above: Source module for the content area.
    It keeps related behavior grouped so the content domain: recipes, farm stories, saved recipe feeds, and ai-assisted producer content generation.
    can be changed without spreading the same responsibility across unrelated files.
    """
    pass


class VertexAIResponseError(Exception):
    """
    Documents the `VertexAIResponseError` boundary for this module.

    The class belongs to the file role described above: Source module for the content area.
    It keeps related behavior grouped so the content domain: recipes, farm stories, saved recipe feeds, and ai-assisted producer content generation.
    can be changed without spreading the same responsibility across unrelated files.
    """
    pass


_PLACEHOLDER_API_KEYS = {
    "your_google_ai_studio_key_here",
    "your_gemini_api_key_here",
    "paste_your_key_here",
}


def _clean_api_key(value: str) -> str:
    """
    Helper for the file role: Source module for the content area.

    `_clean_api_key` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Content domain: recipes, farm stories, saved recipe feeds, and AI-assisted producer content generation.
    """
    # Ignore common placeholder values so `.env` examples do not make the app
    # attempt a real Gemini request and return confusing provider 400 errors.
    key = (value or "").strip()
    if not key or key.lower() in _PLACEHOLDER_API_KEYS:
        return ""
    return key


def _gemini_model_name(model: str) -> str:
    """
    Helper for the file role: Source module for the content area.

    `_gemini_model_name` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Content domain: recipes, farm stories, saved recipe feeds, and AI-assisted producer content generation.
    """
    # Vertex and Google AI Studio sometimes document model ids in different
    # shapes. Normalising here lets `.env` use either `gemini-1.5-flash` or a
    # longer provider path without changing the request builder.
    normalized = (model or "").strip().removeprefix("models/")
    return normalized.split("/")[-1]


def _google_error_message(response, provider: str) -> str:
    """
    Helper for the file role: Source module for the content area.

    `_google_error_message` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Content domain: recipes, farm stories, saved recipe feeds, and AI-assisted producer content generation.
    """
    # Surface the provider's short message without dumping credentials, request
    # bodies, or very long Google error payloads into the frontend toast.
    fallback = f"{provider} returned status {response.status_code}."
    try:
        payload = response.json()
    except ValueError:
        return fallback

    if not isinstance(payload, dict):
        return fallback

    error = payload.get("error", {})
    if not isinstance(error, dict):
        return fallback

    message = str(error.get("message", "")).strip()
    status_code = str(error.get("status", "")).strip()
    if not message:
        return fallback

    detail = f"{provider} returned status {response.status_code}: {message[:260]}"
    if status_code:
        detail += f" ({status_code})"
    return detail


@dataclass(frozen=True)
class GeneratedSuggestion:
    """
    Documents the `GeneratedSuggestion` boundary for this module.

    The class belongs to the file role described above: Source module for the content area.
    It keeps related behavior grouped so the content domain: recipes, farm stories, saved recipe feeds, and ai-assisted producer content generation.
    can be changed without spreading the same responsibility across unrelated files.
    """
    title: str
    description: str = ""
    ingredients: str = ""
    instructions: str = ""
    body: str = ""
    seasonal_tag: str = ""


def _load_authorized_session():
    """
    Helper for the file role: Source module for the content area.

    `_load_authorized_session` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Content domain: recipes, farm stories, saved recipe feeds, and AI-assisted producer content generation.
    """
    # Vertex AI uses Google Application Default Credentials. In Docker this can
    # come from the mounted gcloud ADC file; locally it can come from
    # `gcloud auth application-default login`.
    try:
        import google.auth
        from google.auth.transport.requests import AuthorizedSession
    except ImportError as exc:
        raise VertexAIUnavailable("Vertex AI support is not installed in this environment.") from exc

    try:
        credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    except Exception as exc:
        raise VertexAIUnavailable(
            "Vertex AI credentials are not available. Add a Google service-account/ADC JSON file, or set GEMINI_API_KEY/GOOGLE_API_KEY in .env."
        ) from exc
    return AuthorizedSession(credentials)


def _extract_json_array(text: str) -> list[dict[str, Any]]:
    """
    Helper for the file role: Source module for the content area.

    `_extract_json_array` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Content domain: recipes, farm stories, saved recipe feeds, and AI-assisted producer content generation.
    """
    # Gemini/Vertex may wrap JSON in markdown fences even when instructed not
    # to. The parser tolerates that but still requires a JSON array, because the
    # producer UI expects exactly three structured suggestions.
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
    """
    Helper for the file role: Source module for the content area.

    `_build_prompt` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Content domain: recipes, farm stories, saved recipe feeds, and AI-assisted producer content generation.
    """
    # The prompt deliberately constrains claims: producers can edit the copy, but
    # the generator should not invent certifications, allergen guarantees, or
    # medical/nutrition claims that would be risky in a food marketplace.
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


def _parse_suggestions(data: dict[str, Any], context: dict[str, Any]) -> list[GeneratedSuggestion]:
    """
    Helper for the file role: Source module for the content area.

    `_parse_suggestions` is kept at module level because it is reused by views/services
    or isolates a business rule that should remain easy to test. The wider
    context is: Content domain: recipes, farm stories, saved recipe feeds, and AI-assisted producer content generation.
    """
    # Both Vertex and Gemini API-key responses share this candidate/parts shape,
    # which lets the rest of the content view stay provider-agnostic.
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


def _generate_with_gemini_api_key(
    *,
    api_key: str,
    model: str,
    prompt: str,
    context: dict[str, Any],
    timeout_seconds: int,
) -> list[GeneratedSuggestion]:
    # API-key mode is the simplest path for local demos. It calls Google AI
    # Studio's Gemini endpoint directly and avoids requiring gcloud credentials
    # inside Docker.
    model_name = _gemini_model_name(model)
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.75,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
        },
    }
    try:
        response = requests.post(endpoint, params={"key": api_key}, json=payload, timeout=timeout_seconds)
    except requests.RequestException as exc:
        raise VertexAIResponseError("Gemini API request failed.") from exc
    if response.status_code >= 400:
        raise VertexAIResponseError(_google_error_message(response, "Gemini API"))
    return _parse_suggestions(response.json(), context)


def _generate_with_vertex_adc(
    *,
    project_id: str,
    location: str,
    model: str,
    prompt: str,
    context: dict[str, Any],
    timeout_seconds: int,
) -> list[GeneratedSuggestion]:
    # ADC mode is the production-style path: the app exchanges local/service
    # account credentials for a Google-authenticated Vertex AI HTTP session.
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
        raise VertexAIResponseError(_google_error_message(response, "Vertex AI"))
    return _parse_suggestions(response.json(), context)


def generate_content_suggestions(
    *,
    content_type: str,
    products: list[dict[str, Any]],
    context: dict[str, Any],
) -> list[GeneratedSuggestion]:
    # Prefer an explicit Gemini API key when present, then fall back to Vertex
    # ADC. This keeps the feature usable for teammates who cannot create service
    # account JSON keys because of organisation policy.
    project_id = (getattr(settings, "VERTEX_AI_PROJECT_ID", "") or "").strip()
    location = (getattr(settings, "VERTEX_AI_LOCATION", "") or "").strip()
    model = (getattr(settings, "VERTEX_AI_MODEL", "") or "").strip()
    timeout_seconds = getattr(settings, "VERTEX_AI_TIMEOUT_SECONDS", 30)
    api_key = _clean_api_key(getattr(settings, "GOOGLE_GENERATIVE_AI_API_KEY", ""))

    if not model:
        raise VertexAIUnavailable("AI recipe generation is not configured for this environment.")

    prompt = _build_prompt(content_type, products, context)

    if api_key:
        return _generate_with_gemini_api_key(
            api_key=api_key,
            model=model,
            prompt=prompt,
            context=context,
            timeout_seconds=timeout_seconds,
        )

    if not project_id or not location:
        raise VertexAIUnavailable(
            "AI recipe generation needs either VERTEX_AI_PROJECT_ID plus Google ADC credentials, or GEMINI_API_KEY/GOOGLE_API_KEY."
        )

    return _generate_with_vertex_adc(
        project_id=project_id,
        location=location,
        model=model,
        prompt=prompt,
        context=context,
        timeout_seconds=timeout_seconds,
    )
