from __future__ import annotations

from calendar import month_abbr
from dataclasses import dataclass
from datetime import date


def format_month_range(start_month: int | None, end_month: int | None) -> str:
    if not start_month or not end_month:
        return ""
    return f"{month_abbr[start_month]} - {month_abbr[end_month]}"


def month_in_range(month: int, start_month: int, end_month: int) -> bool:
    if start_month <= end_month:
        return start_month <= month <= end_month
    return month >= start_month or month <= end_month


def is_current_month_in_range(
    start_month: int | None,
    end_month: int | None,
    reference_date: date | None = None,
) -> bool:
    if not start_month or not end_month:
        return False
    current_month = (reference_date or date.today()).month
    return month_in_range(current_month, start_month, end_month)


@dataclass(frozen=True)
class SeasonReminder:
    starts_within_days: bool
    days_until_start: int | None
    next_start_date: date | None


def next_season_start_date(
    start_month: int | None,
    reference_date: date | None = None,
) -> date | None:
    if not start_month:
        return None
    today = reference_date or date.today()
    year = today.year
    candidate = date(year, start_month, 1)
    if candidate < today.replace(day=1):
        candidate = date(year + 1, start_month, 1)
    return candidate


def season_reminder(
    start_month: int | None,
    end_month: int | None,
    *,
    threshold_days: int = 30,
    reference_date: date | None = None,
) -> SeasonReminder:
    today = reference_date or date.today()
    if not start_month or not end_month:
        return SeasonReminder(starts_within_days=False, days_until_start=None, next_start_date=None)
    if is_current_month_in_range(start_month, end_month, today):
        return SeasonReminder(starts_within_days=False, days_until_start=0, next_start_date=today)
    next_start = next_season_start_date(start_month, today)
    if next_start is None:
        return SeasonReminder(starts_within_days=False, days_until_start=None, next_start_date=None)
    days_until = (next_start - today).days
    return SeasonReminder(
        starts_within_days=days_until <= threshold_days,
        days_until_start=days_until,
        next_start_date=next_start,
    )
