import re
from datetime import date

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=120, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Producer(models.Model):
    name = models.CharField(max_length=160, unique=True)
    location = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    delivery_lead_time = models.PositiveIntegerField(default=48)
    postcode = models.CharField(max_length=20, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    class Unit(models.TextChoices):
        KG = "kg", "Kilogram"
        LITRE = "litre", "Litre"
        DOZEN = "dozen", "Dozen"
        EACH = "each", "Each"

    class Availability(models.TextChoices):
        IN_SEASON = "in-season", "In Season"
        YEAR_ROUND = "year-round", "Year-round"
        UNAVAILABLE = "unavailable", "Unavailable"

    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    producer = models.ForeignKey(Producer, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    unit = models.CharField(max_length=16, choices=Unit.choices, default=Unit.EACH)
    harvest_date = models.DateField()
    availability = models.CharField(
        max_length=16,
        choices=Availability.choices,
        default=Availability.YEAR_ROUND,
    )
    seasonal_dates = models.CharField(max_length=64, blank=True)
    is_organic = models.BooleanField(default=False, db_index=True)
    organic_certification = models.CharField(max_length=120, blank=True)
    allergens = models.JSONField(default=list, blank=True)
    image_url = models.URLField(blank=True)
    stock = models.PositiveIntegerField(default=0)
    food_miles = models.PositiveIntegerField(default=0)
    is_surplus = models.BooleanField(default=False)
    surplus_discount = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(100)],
    )
    surplus_original_price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    surplus_expires_at = models.DateTimeField(null=True, blank=True)
    surplus_best_before = models.CharField(max_length=64, blank=True)
    storage_tips = models.TextField(blank=True)
    recipe_ideas = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["is_organic", "category"]),
            models.Index(fields=["availability"]),
        ]

    def __str__(self) -> str:
        return self.name

    MONTH_NAME_TO_NUMBER = {
        "jan": 1,
        "january": 1,
        "feb": 2,
        "february": 2,
        "mar": 3,
        "march": 3,
        "apr": 4,
        "april": 4,
        "may": 5,
        "jun": 6,
        "june": 6,
        "jul": 7,
        "july": 7,
        "aug": 8,
        "august": 8,
        "sep": 9,
        "sept": 9,
        "september": 9,
        "oct": 10,
        "october": 10,
        "nov": 11,
        "november": 11,
        "dec": 12,
        "december": 12,
    }

    def _parse_season_range(self) -> tuple[int, int] | None:
        if not self.seasonal_dates:
            return None

        match = re.search(r"([A-Za-z]{3,9})\s*-\s*([A-Za-z]{3,9})", self.seasonal_dates)
        if not match:
            return None

        start_month = self.MONTH_NAME_TO_NUMBER.get(match.group(1).strip().lower())
        end_month = self.MONTH_NAME_TO_NUMBER.get(match.group(2).strip().lower())
        if not start_month or not end_month:
            return None

        return (start_month, end_month)

    def is_in_current_season(self, reference_date: date | None = None) -> bool:
        season_range = self._parse_season_range()
        if not season_range:
            # When no explicit range is provided, preserve configured availability.
            return self.availability != self.Availability.UNAVAILABLE

        current_month = (reference_date or date.today()).month
        start_month, end_month = season_range
        if start_month <= end_month:
            return start_month <= current_month <= end_month

        # Handles wrapped ranges such as Oct-Mar.
        return current_month >= start_month or current_month <= end_month

    def effective_availability(self, reference_date: date | None = None) -> str:
        if self.availability == self.Availability.UNAVAILABLE:
            return self.Availability.UNAVAILABLE

        if self.availability == self.Availability.YEAR_ROUND:
            return self.Availability.YEAR_ROUND

        if self.availability == self.Availability.IN_SEASON:
            return (
                self.Availability.IN_SEASON
                if self.is_in_current_season(reference_date)
                else self.Availability.UNAVAILABLE
            )

        return self.Availability.UNAVAILABLE
