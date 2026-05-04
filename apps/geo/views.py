"""
DESD Marketplace documentation.

File role:
    Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.

Domain context:
    Geospatial domain: postcode/location lookup, distance calculations, and map-friendly producer/customer coordinates.

Implementation notes:
    This header is intentionally descriptive so future sprint contributors can
    understand why the file exists before reading individual classes/functions.
    Inline comments below are reserved for business rules, permission checks,
    external-service calls, or data transformations that are not obvious from
    the code itself.
"""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import get_cart_food_miles, get_producers_near_postcode, get_user_default_postcode


class ProducersNearMeAPIView(APIView):
    """
    Documents the `ProducersNearMeAPIView` boundary for this module.

    The class belongs to the file role described above: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.
    It keeps related behavior grouped so the geospatial domain: postcode/location lookup, distance calculations, and map-friendly producer/customer coordinates.
    can be changed without spreading the same responsibility across unrelated files.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        postcode = request.query_params.get("postcode", "")
        if not postcode:
            postcode = get_user_default_postcode(request.user)

        radius_miles = float(request.query_params.get("radius_miles", "20"))
        payload = get_producers_near_postcode(postcode, radius_miles=radius_miles)
        return Response(payload)


class CartFoodMilesAPIView(APIView):
    """
    Documents the `CartFoodMilesAPIView` boundary for this module.

    The class belongs to the file role described above: Exposes HTTP/API behavior and coordinates validation, permissions, service calls, and response formatting.
    It keeps related behavior grouped so the geospatial domain: postcode/location lookup, distance calculations, and map-friendly producer/customer coordinates.
    can be changed without spreading the same responsibility across unrelated files.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        postcode = request.query_params.get("postcode")
        payload = get_cart_food_miles(request.user, postcode=postcode)
        return Response(payload)
