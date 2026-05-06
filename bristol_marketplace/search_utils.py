import re
from difflib import SequenceMatcher
from typing import Callable, Iterable

from django.db.models import Q, QuerySet


TOKEN_PATTERN = re.compile(r"[a-z0-9]+")


def normalize_search_tokens(value: str) -> list[str]:
    # this breaks search text into simple words so typo matching stay predictable
    return TOKEN_PATTERN.findall((value or "").lower())


def singular_variants(token: str) -> set[str]:
    # this keep plural and singular product words close together in search
    variants = {token}
    if token.endswith("ies") and len(token) > 4:
        variants.add(f"{token[:-3]}y")
    if token.endswith("es") and len(token) > 3:
        variants.add(token[:-2])
    if token.endswith("s") and len(token) > 3:
        variants.add(token[:-1])
    return variants


def token_matches(query_token: str, candidate_tokens: Iterable[str]) -> bool:
    query_variants = singular_variants(query_token)
    for candidate_token in candidate_tokens:
        candidate_variants = singular_variants(candidate_token)
        # exact word family match is checked before slower fuzzy scoring
        if query_variants & candidate_variants:
            return True
        if any(query in candidate_token or candidate in query for query in query_variants for candidate in candidate_variants):
            return True
        # short words need a softer threshold because one typo changes more
        threshold = 0.72 if min(len(query_token), len(candidate_token)) <= 5 else 0.78
        if SequenceMatcher(None, query_token, candidate_token).ratio() >= threshold:
            return True
    return False


def fuzzy_text_matches(query: str, text: str) -> bool:
    query_tokens = normalize_search_tokens(query)
    if not query_tokens:
        return True
    candidate_tokens = normalize_search_tokens(text)
    if not candidate_tokens:
        return False
    # full text check catches normal searches before token by token fallback
    candidate_text = " ".join(candidate_tokens)
    query_text = " ".join(query_tokens)
    if query_text in candidate_text:
        return True
    return all(token_matches(query_token, candidate_tokens) for query_token in query_tokens)


def build_icontains_query(search_query: str, field_names: Iterable[str]) -> Q:
    query = Q()
    for field_name in field_names:
        # each field gets joined with or so one matching field is enough
        query |= Q(**{f"{field_name}__icontains": search_query})
    return query


def filter_queryset_with_fuzzy_fallback(
    queryset: QuerySet,
    *,
    search_query: str | None,
    field_names: Iterable[str],
    text_getter: Callable[[object], str],
) -> QuerySet:
    normalized_query = (search_query or "").strip()
    if not normalized_query:
        return queryset

    exact_queryset = queryset.filter(build_icontains_query(normalized_query, field_names))
    if exact_queryset.exists():
        return exact_queryset

    # fuzzy fallback only runs when normal database search finds nothing
    matched_ids = [
        item.pk
        for item in queryset
        if fuzzy_text_matches(normalized_query, text_getter(item))
    ]
    return queryset.filter(pk__in=matched_ids)
