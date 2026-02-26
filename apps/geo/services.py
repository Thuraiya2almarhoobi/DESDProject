import math
from decimal import Decimal

from apps.orders.models import CustomerProfile, Producer
from apps.orders.services import get_or_create_cart, get_cart_groups

from .models import PostcodeLocation

# Static fallback coordinates around Bristol to keep local demo self-contained.
FALLBACK_POSTCODE_COORDINATES = {
    "BS15JG": (51.4545, -2.5879),  # customer
    "BS14DJ": (51.4510, -2.5904),  # producer sample
    "BS32AA": (51.4382, -2.6010),  # producer sample
    "BS81RL": (51.4583, -2.6030),
    "BS24QA": (51.4502, -2.5730),
}


def normalize_postcode(postcode: str) -> str:
    return "".join((postcode or "").upper().split())


def get_postcode_coordinates(postcode: str) -> tuple[float, float] | None:
    normalized = normalize_postcode(postcode)
    if not normalized:
        return None

    location = PostcodeLocation.objects.filter(postcode=normalized).first()
    if location:
        return (location.latitude, location.longitude)

    fallback = FALLBACK_POSTCODE_COORDINATES.get(normalized)
    if fallback:
        PostcodeLocation.objects.create(postcode=normalized, latitude=fallback[0], longitude=fallback[1])
        return fallback

    return None


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_miles = 3958.8
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(radius_miles * c, 2)


def get_producers_near_postcode(postcode: str, radius_miles: float = 20.0) -> dict:
    customer_coords = get_postcode_coordinates(postcode)
    if not customer_coords:
        return {"postcode": postcode, "radius_miles": radius_miles, "producers": []}

    results = []
    for producer in Producer.objects.filter(is_active=True):
        producer_coords = get_postcode_coordinates(producer.postcode)
        if not producer_coords:
            continue
        distance = haversine_miles(
            customer_coords[0], customer_coords[1], producer_coords[0], producer_coords[1]
        )
        if distance <= radius_miles:
            results.append(
                {
                    "producer_id": producer.id,
                    "producer_name": producer.business_name,
                    "postcode": producer.postcode,
                    "distance_miles": distance,
                    "coordinates": {
                        "lat": producer_coords[0],
                        "lng": producer_coords[1],
                    },
                }
            )

    results.sort(key=lambda row: row["distance_miles"])
    return {
        "postcode": normalize_postcode(postcode),
        "radius_miles": radius_miles,
        "customer_coordinates": {"lat": customer_coords[0], "lng": customer_coords[1]},
        "producers": results,
    }


def get_cart_food_miles(user, postcode: str | None = None) -> dict:
    cart = get_or_create_cart(user)
    profile = CustomerProfile.objects.filter(user=user).first()
    customer_postcode = postcode or (profile.postcode if profile else "")
    customer_coords = get_postcode_coordinates(customer_postcode)

    if not customer_coords:
        return {
            "customer_postcode": customer_postcode,
            "total_food_miles": Decimal("0.00"),
            "items": [],
            "producer_totals": [],
        }

    item_rows = []
    producer_totals: dict[int, dict] = {}
    total = Decimal("0.00")

    for group in get_cart_groups(cart):
        producer_coords = get_postcode_coordinates(group.producer.postcode)
        if not producer_coords:
            continue
        producer_distance = Decimal(
            str(haversine_miles(customer_coords[0], customer_coords[1], producer_coords[0], producer_coords[1]))
        )
        producer_totals[group.producer.id] = {
            "producer_id": group.producer.id,
            "producer_name": group.producer.business_name,
            "distance_miles": producer_distance,
            "item_count": len(group.items),
        }

        for item in group.items:
            item_rows.append(
                {
                    "product_id": item.product.id,
                    "product_name": item.product.name,
                    "producer_id": group.producer.id,
                    "producer_name": group.producer.business_name,
                    "quantity": item.quantity,
                    "distance_miles": producer_distance,
                }
            )
            total += producer_distance

    return {
        "customer_postcode": normalize_postcode(customer_postcode),
        "customer_coordinates": {"lat": customer_coords[0], "lng": customer_coords[1]},
        "total_food_miles": total.quantize(Decimal("0.01")),
        "items": item_rows,
        "producer_totals": list(producer_totals.values()),
    }
