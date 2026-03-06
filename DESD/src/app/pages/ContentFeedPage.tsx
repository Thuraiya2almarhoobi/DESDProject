import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, BookOpenText, Leaf, Newspaper, Star } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ApiFeedEntry, ApiRecipe, ApiStory, apiJson } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';

type FeedFilter = 'all' | 'recipe' | 'story';

type FeedDetail = ApiRecipe | ApiStory;

interface ProducerProductOption {
  id: number;
  name: string;
  unit: string;
  price: string;
  is_available: boolean;
  stock_quantity: string;
}

interface RecipeDraft {
  title: string;
  description: string;
  ingredients: string;
  instructions: string;
  seasonal_tag: string;
  image_url: string;
  product_ids: number[];
}

interface StoryDraft {
  title: string;
  body: string;
  seasonal_tag: string;
  image_url: string;
}

const INITIAL_RECIPE_DRAFT: RecipeDraft = {
  title: '',
  description: '',
  ingredients: '',
  instructions: '',
  seasonal_tag: '',
  image_url: '',
  product_ids: [],
};

const INITIAL_STORY_DRAFT: StoryDraft = {
  title: '',
  body: '',
  seasonal_tag: '',
  image_url: '',
};

function detailKey(type: string, id: number): string {
  return `${type}:${id}`;
}

export function ContentFeedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isProducer = user?.role === 'PRODUCER';
  const isCustomer = user?.role === 'CUSTOMER';

  const [feed, setFeed] = useState<ApiFeedEntry[]>([]);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [loading, setLoading] = useState(true);
  const [detailLoadingKey, setDetailLoadingKey] = useState<string | null>(null);
  const [detailsByKey, setDetailsByKey] = useState<Record<string, FeedDetail>>({});
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<number>>(new Set());
  const [producerProducts, setProducerProducts] = useState<ProducerProductOption[]>([]);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft>(INITIAL_RECIPE_DRAFT);
  const [storyDraft, setStoryDraft] = useState<StoryDraft>(INITIAL_STORY_DRAFT);
  const [publishingRecipe, setPublishingRecipe] = useState(false);
  const [publishingStory, setPublishingStory] = useState(false);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const [entries, recipes, producerProductsPayload] = await Promise.all([
        apiJson<ApiFeedEntry[]>('/api/content/feed/'),
        apiJson<ApiRecipe[]>('/api/content/recipes/'),
        isProducer
          ? apiJson<ProducerProductOption[]>('/api/content/producer/products/')
          : Promise.resolve([] as ProducerProductOption[]),
      ]);

      setFeed(entries);
      setSavedRecipeIds(new Set(recipes.filter((recipe) => recipe.saved).map((recipe) => recipe.id)));
      setProducerProducts(producerProductsPayload);
    } catch {
      toast.error('Unable to load recipes and stories feed.');
    } finally {
      setLoading(false);
    }
  }, [isProducer]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!mounted) {
        return;
      }
      await loadFeed();
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [loadFeed]);

  const visibleFeed = useMemo(() => {
    if (filter === 'all') {
      return feed;
    }
    return feed.filter((entry) => entry.type === filter);
  }, [feed, filter]);

  const toggleSavedRecipe = async (recipeId: number) => {
    try {
      const payload = await apiJson<{ saved: boolean }>(`/api/content/recipes/${recipeId}/save/`, {
        method: 'POST',
      });

      setSavedRecipeIds((previous) => {
        const next = new Set(previous);
        if (payload.saved) {
          next.add(recipeId);
        } else {
          next.delete(recipeId);
        }
        return next;
      });

      toast.success(payload.saved ? 'Recipe saved' : 'Recipe removed from saved list');
    } catch {
      toast.error('Unable to update saved recipe status.');
    }
  };

  const openDetails = async (entry: ApiFeedEntry) => {
    const key = detailKey(entry.type, entry.id);
    if (detailsByKey[key]) {
      setDetailsByKey((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
      return;
    }

    setDetailLoadingKey(key);
    try {
      if (entry.type === 'recipe') {
        const recipe = await apiJson<ApiRecipe>(`/api/content/recipes/${entry.id}/`);
        setDetailsByKey((previous) => ({ ...previous, [key]: recipe }));
      } else {
        const story = await apiJson<ApiStory>(`/api/content/stories/${entry.id}/`);
        setDetailsByKey((previous) => ({ ...previous, [key]: story }));
      }
    } catch {
      toast.error('Unable to load full content details.');
    } finally {
      setDetailLoadingKey(null);
    }
  };

  const toggleRecipeProduct = (productId: number, checked: boolean) => {
    setRecipeDraft((previous) => ({
      ...previous,
      product_ids: checked
        ? Array.from(new Set([...previous.product_ids, productId]))
        : previous.product_ids.filter((id) => id !== productId),
    }));
  };

  const publishRecipe = async () => {
    if (!recipeDraft.title.trim() || !recipeDraft.ingredients.trim() || !recipeDraft.instructions.trim()) {
      toast.error('Recipe title, ingredients, and instructions are required.');
      return;
    }
    if (recipeDraft.product_ids.length === 0) {
      toast.error('Link at least one product to the recipe.');
      return;
    }

    setPublishingRecipe(true);
    try {
      await apiJson<ApiRecipe>('/api/content/recipes/', {
        method: 'POST',
        body: JSON.stringify({
          ...recipeDraft,
          is_published: true,
        }),
      });
      toast.success('Recipe published.');
      setRecipeDraft(INITIAL_RECIPE_DRAFT);
      await loadFeed();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to publish recipe.');
    } finally {
      setPublishingRecipe(false);
    }
  };

  const publishStory = async () => {
    if (!storyDraft.title.trim() || !storyDraft.body.trim()) {
      toast.error('Story title and body are required.');
      return;
    }

    setPublishingStory(true);
    try {
      await apiJson<ApiStory>('/api/content/stories/', {
        method: 'POST',
        body: JSON.stringify({
          ...storyDraft,
          is_published: true,
        }),
      });
      toast.success('Farm story published.');
      setStoryDraft(INITIAL_STORY_DRAFT);
      await loadFeed();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to publish story.');
    } finally {
      setPublishingStory(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate(isProducer ? '/producer/dashboard' : '/marketplace')}>
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>
          {isCustomer ? (
            <Button variant="outline" onClick={() => navigate('/orders/history')}>Order History</Button>
          ) : (
            <Button variant="outline" onClick={() => navigate('/producer/inventory')}>My Inventory</Button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Recipes & Stories</h1>
          <p className="text-sm text-gray-600 mt-1">Community feed powered by producer content in the `content` app.</p>
        </div>

        {isProducer && (
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Publish Recipe</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="recipe-title">Title</Label>
                  <Input
                    id="recipe-title"
                    value={recipeDraft.title}
                    onChange={(event) => setRecipeDraft((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="recipe-description">Description</Label>
                  <Textarea
                    id="recipe-description"
                    value={recipeDraft.description}
                    onChange={(event) => setRecipeDraft((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="recipe-ingredients">Ingredients</Label>
                  <Textarea
                    id="recipe-ingredients"
                    value={recipeDraft.ingredients}
                    onChange={(event) => setRecipeDraft((prev) => ({ ...prev, ingredients: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="recipe-instructions">Instructions</Label>
                  <Textarea
                    id="recipe-instructions"
                    value={recipeDraft.instructions}
                    onChange={(event) => setRecipeDraft((prev) => ({ ...prev, instructions: event.target.value }))}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="recipe-season">Seasonal Tag</Label>
                    <Input
                      id="recipe-season"
                      placeholder="Autumn/Winter"
                      value={recipeDraft.seasonal_tag}
                      onChange={(event) => setRecipeDraft((prev) => ({ ...prev, seasonal_tag: event.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="recipe-image">Image URL</Label>
                    <Input
                      id="recipe-image"
                      value={recipeDraft.image_url}
                      onChange={(event) => setRecipeDraft((prev) => ({ ...prev, image_url: event.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Link Products</p>
                  {producerProducts.length === 0 ? (
                    <p className="text-sm text-gray-600">No producer products available to link.</p>
                  ) : (
                    <div className="space-y-2">
                      {producerProducts.map((product) => {
                        const checked = recipeDraft.product_ids.includes(product.id);
                        return (
                          <label key={product.id} className="flex items-center gap-3 border rounded-md p-2 cursor-pointer">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => toggleRecipeProduct(product.id, value === true)}
                            />
                            <span className="text-sm">
                              {product.name} ({product.unit}) · £{Number(product.price).toFixed(2)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Button onClick={publishRecipe} disabled={publishingRecipe}>
                  {publishingRecipe ? 'Publishing...' : 'Publish Recipe'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Publish Farm Story</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="story-title">Title</Label>
                  <Input
                    id="story-title"
                    value={storyDraft.title}
                    onChange={(event) => setStoryDraft((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="story-body">Story</Label>
                  <Textarea
                    id="story-body"
                    value={storyDraft.body}
                    onChange={(event) => setStoryDraft((prev) => ({ ...prev, body: event.target.value }))}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="story-season">Seasonal Tag</Label>
                    <Input
                      id="story-season"
                      placeholder="Harvest Season"
                      value={storyDraft.seasonal_tag}
                      onChange={(event) => setStoryDraft((prev) => ({ ...prev, seasonal_tag: event.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="story-image">Image URL</Label>
                    <Input
                      id="story-image"
                      value={storyDraft.image_url}
                      onChange={(event) => setStoryDraft((prev) => ({ ...prev, image_url: event.target.value }))}
                    />
                  </div>
                </div>

                <Button onClick={publishStory} disabled={publishingStory}>
                  {publishingStory ? 'Publishing...' : 'Publish Story'}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={filter} onValueChange={(value) => setFilter(value as FeedFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="recipe">Recipes</TabsTrigger>
            <TabsTrigger value="story">Farm Stories</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-600">Loading content feed...</CardContent>
          </Card>
        ) : visibleFeed.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-600">No feed entries available for this filter.</CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {visibleFeed.map((entry) => {
              const key = detailKey(entry.type, entry.id);
              const details = detailsByKey[key];
              const isRecipe = entry.type === 'recipe';

              return (
                <Card key={key}>
                  <CardHeader>
                    <div className="flex justify-between gap-3 items-start">
                      <div>
                        <CardTitle className="text-lg">{entry.title}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">By {entry.producer_name}</p>
                      </div>
                      <Badge variant={isRecipe ? 'secondary' : 'outline'}>
                        {isRecipe ? 'Recipe' : 'Story'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-700">{entry.description}</p>

                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Leaf className="size-3" />
                      {entry.seasonal_tag || 'All seasons'}
                      <span>•</span>
                      {format(new Date(entry.created_at), 'MMM d, yyyy')}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDetails(entry)}>
                        {details ? 'Hide Details' : 'View Details'}
                      </Button>
                      {isRecipe && isCustomer && (
                        <Button
                          size="sm"
                          variant={savedRecipeIds.has(entry.id) ? 'default' : 'outline'}
                          onClick={() => toggleSavedRecipe(entry.id)}
                        >
                          <Star className="size-4 mr-2" />
                          {savedRecipeIds.has(entry.id) ? 'Saved' : 'Save'}
                        </Button>
                      )}
                    </div>

                    {detailLoadingKey === key && (
                      <p className="text-sm text-gray-600">Loading details...</p>
                    )}

                    {details && (
                      <div className="border rounded-md p-3 bg-gray-50 space-y-2">
                        {'ingredients' in details ? (
                          <>
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <BookOpenText className="size-4" />
                              Ingredients
                            </div>
                            <p className="text-sm whitespace-pre-line">{details.ingredients}</p>
                            <div className="flex items-center gap-2 text-sm font-medium mt-3">
                              <Newspaper className="size-4" />
                              Instructions
                            </div>
                            <p className="text-sm whitespace-pre-line">{details.instructions}</p>
                            {details.linked_products.length > 0 && (
                              <div className="pt-2">
                                <p className="text-xs text-gray-600">Linked products</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {details.linked_products.map((product) => (
                                    <Button
                                      key={product.id}
                                      variant="outline"
                                      size="sm"
                                      onClick={() => navigate(`/product/${product.id}`)}
                                      disabled={!isCustomer}
                                    >
                                      {product.name}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Newspaper className="size-4" />
                              Story
                            </div>
                            <p className="text-sm whitespace-pre-line">{details.body}</p>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
