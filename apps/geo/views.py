from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import get_cart_food_miles, get_producers_near_postcode, get_user_default_postcode


class ProducersNearMeAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        postcode = request.query_params.get("postcode", "")
        if not postcode:
            postcode = get_user_default_postcode(request.user)

        radius_miles = float(request.query_params.get("radius_miles", "20"))
        payload = get_producers_near_postcode(postcode, radius_miles=radius_miles)
        return Response(payload)


class CartFoodMilesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        postcode = request.query_params.get("postcode")
        payload = get_cart_food_miles(request.user, postcode=postcode)
        return Response(payload)
