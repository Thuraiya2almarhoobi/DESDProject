import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, ShoppingCart, Plus, Minus, ChefHat, MapPin, Sprout } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Card, CardContent } from '../components/ui/card';
import { AvailabilityBadge, OrganicBadge } from '../components/ProductBadges';
import { ProductMeta } from '../components/ProductMeta';
import { AllergenBlock } from '../components/AllergenBlock';
import { FarmLocationMap } from '../components/FarmLocationMap';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { toast } from 'sonner';
import { Product } from '../types';
import { ApiProduct, ApiRecipe, apiJson, mapApiProductToProduct } from '../lib/api';

interface ProducerDistanceRow {
  producer_id: number;
  distance_miles: number;
  coordinates?: {
    lat: number;
    lng: number;
  };
  postcode?: string;
}

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deliveryLeadTime, setDeliveryLeadTime] = useState(48);
  const [producerCoordinates, setProducerCoordinates] = useState<{ lat: number; lng: number } | undefined>();
  const [producerPostcode, setProducerPostcode] = useState('');
  const [linkedRecipes, setLinkedRecipes] = useState<ApiRecipe[]>([]);
  const [hasReviewedAllergens, setHasReviewedAllergens] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadProduct = async () => {
      if (!id) {
        setError('Product not found');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const [profile, products] = await Promise.all([
          apiJson<{ postcode: string }>('/api/orders/profile/'),
          apiJson<ApiProduct[]>('/api/orders/products/'),
        ]);

        const target = products.find((item) => item.id === Number(id));
        if (!target) {
          throw new Error('Product not found');
        }

        const producersNear = await apiJson<{
          producers: ProducerDistanceRow[];
        }>(`/api/geo/producers-near-me/?postcode=${encodeURIComponent(profile.postcode || '')}&radius_miles=20000`);

        const producerRow = producersNear.producers.find((row) => row.producer_id === target.producer.id);
        const mappedProduct = mapApiProductToProduct(target, producerRow?.distance_miles);

        const recipes = await apiJson<ApiRecipe[]>(`/api/content/products/${target.id}/recipes/`);

        if (!mounted) {
          return;
        }

        setProduct({
          ...mappedProduct,
          recipeIdeas: recipes.map((recipe) => recipe.title),
        });
        setLinkedRecipes(recipes);
        setDeliveryLeadTime(target.producer.lead_time_hours);
        setProducerCoordinates(producerRow?.coordinates);
        setProducerPostcode(target.producer.postcode || producerRow?.postcode || '');
        const hasAllergens = mappedProduct.allergens.length > 0;
        const hasReviewed =
          typeof window !== 'undefined' &&
          window.localStorage.getItem(`allergen-reviewed-${mappedProduct.id}`) === 'true';
        setHasReviewedAllergens(!hasAllergens || hasReviewed);
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load product');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProduct();

    return () => {
      mounted = false;
    };
  }, [id]);

  const isAvailable = useMemo(() => {
    if (!product) {
      return false;
    }
    return product.availability !== 'unavailable' && product.stock > 0;
  }, [product]);

  const maxQuantity = useMemo(() => {
    if (!product) {
      return 1;
    }
    return Math.min(product.stock, 99);
  }, [product]);
  const isBulkRole = user?.role === 'COMMUNITY' || user?.role === 'RESTAURANT';
  const requiresAllergenReview = product?.allergens.length ? product.allergens.length > 0 : false;

  const handleAddToCart = () => {
    if (!product || !isAvailable) {
      return;
    }
    if (requiresAllergenReview && !hasReviewedAllergens) {
      toast.warning('Please review and acknowledge allergen information before adding to cart.');
      return;
    }

    addToCart(product, quantity);
    toast.success(`Added ${quantity} ${product.unit} of ${product.name} to cart`);
  };

  const handleAllergenReviewToggle = (checked: boolean) => {
    setHasReviewedAllergens(checked);

    if (typeof window !== 'undefined' && product && requiresAllergenReview) {
      window.localStorage.setItem(`allergen-reviewed-${product.id}`, checked ? 'true' : 'false');
    }
  };

  const incrementQuantity = () => {
    if (quantity < maxQuantity) {
      setQuantity((value) => value + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity((value) => value - 1);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
        <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] sticky top-0 z-10 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate('/marketplace')}>
              <ArrowLeft className="size-4 mr-2" />
              Back to Marketplace
            </Button>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-10 text-center text-gray-600">Loading product details...</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!product || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
        <div className="text-center max-w-md px-4">
          <p className="text-gray-700 mb-4">{error || 'Product not found'}</p>
          <Button onClick={() => navigate('/marketplace')}>Back to Marketplace</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/marketplace')}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Marketplace
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <AvailabilityBadge availability={product.availability} />
                {product.isOrganic && <OrganicBadge />}
              </div>
              <h1 className="text-3xl font-semibold mb-2">{product.name}</h1>
              <p className="text-gray-600">{product.description}</p>
            </div>

            <ProductMeta
              producerName={product.producerName}
              producerLocation={product.producerLocation}
              harvestDate={product.harvestDate}
              foodMiles={product.foodMiles}
            />

            <Separator />

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-green-700">£{product.price.toFixed(2)}</span>
                <span className="text-xl text-gray-500">per {product.unit}</span>
              </div>
              {product.stock > 0 && product.stock < 10 && (
                <p className="text-sm text-orange-600 mt-2">Only {product.stock} {product.unit} remaining</p>
              )}
            </div>

            {isAvailable && (
              <div className="space-y-3">
                <label className="text-sm font-medium">Quantity</label>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" onClick={decrementQuantity} disabled={quantity <= 1}>
                    <Minus className="size-4" />
                  </Button>
                  {isBulkRole ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max={String(maxQuantity)}
                        step="1"
                        value={quantity}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          if (!Number.isFinite(next)) {
                            return;
                          }
                          setQuantity(Math.max(1, Math.min(maxQuantity, Math.floor(next))));
                        }}
                        className="w-24 text-center"
                      />
                      <span className="text-sm text-gray-500">{product.unit}</span>
                    </div>
                  ) : (
                    <div className="w-20 text-center">
                      <span className="text-lg font-medium">{quantity}</span>
                      <span className="text-sm text-gray-500 ml-1">{product.unit}</span>
                    </div>
                  )}
                  <Button variant="outline" size="icon" onClick={incrementQuantity} disabled={quantity >= maxQuantity}>
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            <Button className="w-full" size="lg" onClick={handleAddToCart} disabled={!isAvailable}>
              <ShoppingCart className="size-5 mr-2" />
              {isAvailable ? 'Add to Cart' : 'Currently Unavailable'}
            </Button>

            <AllergenBlock allergens={product.allergens} />
            {requiresAllergenReview && (
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <Checkbox checked={hasReviewedAllergens} onCheckedChange={(value) => handleAllergenReviewToggle(Boolean(value))} />
                <span>I have reviewed allergen information for this product.</span>
              </label>
            )}

            <Separator />

            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold mb-2">From {product.producerName}</h4>
                <p className="text-sm text-gray-600 mb-2">Located in {product.producerLocation}</p>
                <p className="text-sm text-gray-500">Delivery lead time: {deliveryLeadTime} hours minimum</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-8">
          <Accordion type="single" collapsible className="space-y-2">
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
                  postcode={producerPostcode}
                  coordinates={producerCoordinates}
                  foodMiles={product.foodMiles}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="recipes" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <ChefHat className="size-5 text-green-600" />
                  <span className="font-medium">Recipe Suggestions</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {linkedRecipes.length === 0 ? (
                  <p className="text-sm text-gray-600">No linked recipes published for this product yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {linkedRecipes.map((recipe) => (
                      <li key={recipe.id} className="border rounded-md p-3 bg-white">
                        <p className="font-medium">{recipe.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{recipe.description || 'No description provided.'}</p>
                        <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="font-medium text-gray-800 mb-1">Ingredients</p>
                            <p className="text-gray-700 whitespace-pre-line">{recipe.ingredients}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 mb-1">Instructions</p>
                            <p className="text-gray-700 whitespace-pre-line">{recipe.instructions}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>

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
                    Local producer serving the Bristol regional network with transparent supply information,
                    seasonal updates, and traceable origin details.
                  </p>
                  <div className="pt-2 border-t">
                    <Badge variant="secondary">Lead time: {deliveryLeadTime} hours</Badge>
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
