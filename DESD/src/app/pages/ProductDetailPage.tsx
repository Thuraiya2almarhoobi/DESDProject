import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, ShoppingCart, Plus, Minus, ChefHat, Refrigerator, MapPin, Sprout } from 'lucide-react';
import { mockProducts, mockProducers } from '../data/mockData';
import { useCart } from '../contexts/CartContext';
import { Product } from '../types';
import { fetchMarketplaceProductsFromApi } from '../services/productApi';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { AvailabilityBadge, OrganicBadge, SurplusBadge } from '../components/ProductBadges';
import { ProductMeta } from '../components/ProductMeta';
import { AllergenBlock } from '../components/AllergenBlock';
import { FarmLocationMap } from '../components/FarmLocationMap';
import { SurplusInfo } from '../components/SurplusInfo';
import { Separator } from '../components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { toast } from 'sonner';

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadProducts() {
      try {
        const persistedProducts = await fetchMarketplaceProductsFromApi();
        if (isMounted) {
          setApiProducts(persistedProducts);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    void loadProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  const allProducts = useMemo(() => {
    const merged = new Map<string, Product>();
    mockProducts.forEach((product) => merged.set(product.id, product));
    apiProducts.forEach((product) => merged.set(product.id, product));
    return Array.from(merged.values());
  }, [apiProducts]);

  const product = allProducts.find((p) => p.id === id);
  const producer = product
    ? mockProducers.find((p) => p.id === product.producerId) ?? {
        id: product.producerId,
        name: product.producerName,
        location: product.producerLocation,
        description: 'Local producer committed to fresh, seasonal products.',
        deliveryLeadTime: 48,
      }
    : null;

  if (!product && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Product not found</p>
          <Button onClick={() => navigate('/marketplace')}>
            Back to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  const isAvailable = product.availability !== 'unavailable' && product.stock > 0;
  const maxQuantity = Math.min(product.stock, 99);

  const handleAddToCart = () => {
    if (!isAvailable) return;
    
    addToCart(product, quantity);
    toast.success(`Added ${quantity} ${product.unit} of ${product.name} to cart`);
  };

  const incrementQuantity = () => {
    if (quantity < maxQuantity) {
      setQuantity(q => q + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(q => q - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/marketplace')}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Marketplace
          </Button>
        </div>
      </header>

      {/* Product Detail */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Product Image */}
          <div className="space-y-4">
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Title and Badges */}
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <AvailabilityBadge availability={product.availability} />
                {product.isOrganic && <OrganicBadge />}
                {product.isSurplus && <SurplusBadge />}
              </div>
              <h1 className="text-3xl font-semibold mb-2">{product.name}</h1>
              <p className="text-gray-600">{product.description}</p>
            </div>

            {/* Producer Meta (TC-003/013) */}
            <ProductMeta
              producerName={product.producerName}
              producerLocation={product.producerLocation}
              harvestDate={product.harvestDate}
              foodMiles={product.foodMiles}
            />

            <Separator />

            {/* Price */}
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-green-700">
                  £{product.price.toFixed(2)}
                </span>
                <span className="text-xl text-gray-500">per {product.unit}</span>
              </div>
              {product.stock > 0 && product.stock < 10 && (
                <p className="text-sm text-orange-600 mt-2">
                  Only {product.stock} {product.unit} remaining
                </p>
              )}
            </div>

            {/* Quantity Selector */}
            {isAvailable && (
              <div className="space-y-3">
                <label className="text-sm font-medium">Quantity</label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={decrementQuantity}
                    disabled={quantity <= 1}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <div className="w-20 text-center">
                    <span className="text-lg font-medium">{quantity}</span>
                    <span className="text-sm text-gray-500 ml-1">{product.unit}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={incrementQuantity}
                    disabled={quantity >= maxQuantity}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Add to Cart Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleAddToCart}
              disabled={!isAvailable}
            >
              <ShoppingCart className="size-5 mr-2" />
              {isAvailable ? 'Add to Cart' : 'Currently Unavailable'}
            </Button>

            {/* Allergen Warning (TC-015/016) */}
            <AllergenBlock allergens={product.allergens} />

            <Separator />

            {/* Additional Details */}
            <div className="space-y-4">
              <h3 className="font-semibold">About this product</h3>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Category</p>
                  <p className="font-medium">{product.category}</p>
                </div>
                {product.seasonalDates && (
                  <div>
                    <p className="text-gray-500">Season</p>
                    <p className="font-medium">{product.seasonalDates}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">Certification</p>
                  <p className="font-medium">{product.isOrganic ? 'Organic Certified' : 'Non-organic'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Stock</p>
                  <p className="font-medium">
                    {product.stock > 0 ? `${product.stock} ${product.unit} available` : 'Out of stock'}
                  </p>
                </div>
              </div>
            </div>

            {/* Producer Info Card */}
            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold mb-2">From {product.producerName}</h4>
                <p className="text-sm text-gray-600 mb-2">Located in {product.producerLocation}</p>
                <p className="text-sm text-gray-500">
                  Delivery lead time: 48 hours minimum
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-8">
          <Accordion type="single" collapsible className="space-y-2">
            {/* Farm Location */}
            {producer && (
              <AccordionItem value="location" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-5 text-green-600" />
                    <span className="font-medium">Farm Location</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <FarmLocationMap
                    producerName={product.producerName}
                    location={product.producerLocation}
                    postcode={producer.postcode}
                    coordinates={producer.coordinates}
                    foodMiles={product.foodMiles}
                  />
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Storage Tips */}
            {product.storageTips && (
              <AccordionItem value="storage" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Refrigerator className="size-5 text-green-600" />
                    <span className="font-medium">Storage Tips</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <p className="text-sm text-gray-600">{product.storageTips}</p>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Recipe Ideas */}
            {product.recipeIdeas && product.recipeIdeas.length > 0 && (
              <AccordionItem value="recipes" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <ChefHat className="size-5 text-green-600" />
                    <span className="font-medium">Recipe Ideas</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <ul className="space-y-2">
                    {product.recipeIdeas.map((recipe, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="size-1.5 rounded-full bg-green-600" />
                        {recipe}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Surplus Info */}
            {product.isSurplus && product.surplusDiscount && product.surplusOriginalPrice && product.surplusExpiresAt && product.surplusBestBefore && (
              <AccordionItem value="surplus" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">Surplus Deal</Badge>
                    <span className="font-medium">Why is this discounted?</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      This item is part of our surplus program to reduce food waste. It's perfectly good to eat but may be close to its best-before date or the producer has excess stock.
                    </p>
                    <SurplusInfo
                      discount={product.surplusDiscount}
                      originalPrice={product.surplusOriginalPrice}
                      currentPrice={product.price}
                      expiresAt={product.surplusExpiresAt}
                      bestBefore={product.surplusBestBefore}
                      unit={product.unit}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Producer Information */}
            <AccordionItem value="producer" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Sprout className="size-5 text-green-600" />
                  <span className="font-medium">About {product.producerName}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    {producer?.description}
                  </p>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-500">
                      Delivery lead time: {producer?.deliveryLeadTime || 48} hours minimum
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </main>
    </div>
  );
}
