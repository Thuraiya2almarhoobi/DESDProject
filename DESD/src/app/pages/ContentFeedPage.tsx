import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, BookOpenText, Leaf, Newspaper, Sparkles, Star, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ApiFeedEntry, ApiGeneratedContentSuggestion, ApiRecipe, ApiStory, apiJson } from '../lib/api';
import { useSafeBack } from '../lib/navigation';
import { useAuth } from '../contexts/AuthContext';
import { ImageSourceField } from '../components/ImageSourceField';
import { SiteHeader } from '../components/SiteHeader';
import { FeedLoadingSkeleton } from '../components/LoadingSkeletons';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Skeleton } from '../components/ui/skeleton';

type FeedFilter = 'all' | 'recipe' | 'story';
type AiContentType = 'recipe' | 'story';

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

interface AiDraft {
  content_type: AiContentType;
  product_ids: number[];
  notes: string;
  tone: string;
  occasion: string;
  storage_context: string;
  seasonal_tag: string;
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

const INITIAL_AI_DRAFT: AiDraft = {
  content_type: 'recipe',
  product_ids: [],
  notes: '',
  tone: '',
  occasion: '',
  storage_context: '',
  seasonal_tag: '',
};

function detailKey(type: string, id: number): string {
  return `${type}:${id}`;
}

export function ContentFeedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isProducer = user?.role === 'PRODUCER';
  const isBuyer = user?.role === 'CUSTOMER' || user?.role === 'PRODUCER' || user?.role === 'COMMUNITY' || user?.role === 'RESTAURANT';
  const goBack = useSafeBack(isProducer ? '/producer/dashboard' : '/marketplace');

  const [feed, setFeed] = useState<ApiFeedEntry[]>([]);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [loading, setLoading] = useState(true);
  const [detailLoadingKey, setDetailLoadingKey] = useState<string | null>(null);
  const [detailsByKey, setDetailsByKey] = useState<Record<string, FeedDetail>>({});
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<number>>(new Set());
  const [producerProducts, setProducerProducts] = useState<ProducerProductOption[]>([]);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft>(INITIAL_RECIPE_DRAFT);
  const [storyDraft, setStoryDraft] = useState<StoryDraft>(INITIAL_STORY_DRAFT);
  const [composerMode, setComposerMode] = useState<AiContentType>('recipe');
  const [aiDraft, setAiDraft] = useState<AiDraft>(INITIAL_AI_DRAFT);
  const [aiSuggestions, setAiSuggestions] = useState<ApiGeneratedContentSuggestion[]>([]);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [publishingRecipe, setPublishingRecipe] = useState(false);
  const [publishingStory, setPublishingStory] = useState(false);
  const backButton = (
    <Button variant="ghost" onClick={goBack}>
      <ArrowLeft className="mr-2 size-4" />
      Back
    </Button>
  );

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const [entries, recipes, producerProductsPayload, aiSuggestionsPayload] = await Promise.all([
        apiJson<ApiFeedEntry[]>('/api/content/feed/'),
        apiJson<ApiRecipe[]>('/api/content/recipes/'),
        isProducer
          ? apiJson<ProducerProductOption[]>('/api/content/producer/products/')
          : Promise.resolve([] as ProducerProductOption[]),
        isProducer
          ? apiJson<ApiGeneratedContentSuggestion[]>('/api/content/ai/suggestions/')
          : Promise.resolve([] as ApiGeneratedContentSuggestion[]),
      ]);

      setFeed(entries);
      setSavedRecipeIds(new Set(recipes.filter((recipe) => recipe.saved).map((recipe) => recipe.id)));
      setProducerProducts(producerProductsPayload);
      setAiSuggestions(aiSuggestionsPayload);
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

  const toggleAiProduct = (productId: number, checked: boolean) => {
    setAiDraft((previous) => ({
      ...previous,
      product_ids: checked
        ? Array.from(new Set([...previous.product_ids, productId]))
        : previous.product_ids.filter((id) => id !== productId),
    }));
  };

  const generateAiSuggestions = async () => {
    if (aiDraft.product_ids.length === 0) {
      toast.error('Select at least one product for the AI assistant.');
      return;
    }

    setGeneratingAi(true);
    try {
      const suggestions = await apiJson<ApiGeneratedContentSuggestion[]>('/api/content/ai/suggestions/', {
        method: 'POST',
        body: JSON.stringify(aiDraft),
      });
      setAiSuggestions((previous) => [...suggestions, ...previous]);
      toast.success('AI suggestions saved privately.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to generate AI suggestions.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const deleteAiSuggestion = async (suggestionId: number) => {
    try {
      await apiJson<null>(`/api/content/ai/suggestions/${suggestionId}/`, { method: 'DELETE' });
      setAiSuggestions((previous) => previous.filter((suggestion) => suggestion.id !== suggestionId));
      toast.success('AI suggestion removed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete AI suggestion.');
    }
  };

  const markAiSuggestionUsed = async (suggestionId: number) => {
    try {
      const updated = await apiJson<ApiGeneratedContentSuggestion>(`/api/content/ai/suggestions/${suggestionId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'used' }),
      });
      setAiSuggestions((previous) =>
        previous.map((suggestion) => (suggestion.id === suggestionId ? updated : suggestion)),
      );
    } catch {
      // The existing form is already populated; a status update failure should not block editing.
    }
  };

  const useAiSuggestion = (suggestion: ApiGeneratedContentSuggestion) => {
    const productIds = suggestion.products.map((product) => product.id);
    if (suggestion.content_type === 'recipe') {
      setRecipeDraft({
        title: suggestion.title,
        description: suggestion.description,
        ingredients: suggestion.ingredients,
        instructions: suggestion.instructions,
        seasonal_tag: suggestion.seasonal_tag,
        image_url: '',
        product_ids: productIds,
      });
      setComposerMode('recipe');
      toast.success('Recipe draft filled from AI suggestion.');
    } else {
      setStoryDraft({
        title: suggestion.title,
        body: suggestion.body,
        seasonal_tag: suggestion.seasonal_tag,
        image_url: '',
      });
      setComposerMode('story');
      toast.success('Farm story draft filled from AI suggestion.');
    }
    void markAiSuggestionUsed(suggestion.id);
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
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {backButton}
          {isBuyer ? (
            <Button variant="outline" onClick={() => navigate('/orders/history')}>
              Order History
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate('/marketplace')}>
              Marketplace
            </Button>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-semibold">Recipes & Farm Stories</h1>
          <p className="mt-1 text-sm text-gray-600">
            Seasonal recipes, farm stories, and linked local products published by producers.
          </p>
        </div>

        {isProducer && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
            <Card className="border-[#e4e1d8] bg-[#fffefa] shadow-sm">
              <CardHeader className="border-b border-[#eee8dc]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Create producer content</CardTitle>
                    <p className="mt-1 text-sm text-gray-600">
                      Publish the tested TC-020 recipe and farm story flow from one focused editor.
                    </p>
                  </div>
                  <Tabs value={composerMode} onValueChange={(value) => setComposerMode(value as AiContentType)}>
                    <TabsList>
                      <TabsTrigger value="recipe">Recipe</TabsTrigger>
                      <TabsTrigger value="story">Farm Story</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                {composerMode === 'recipe' ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="recipe-title">Recipe Title</Label>
                        <Input
                          id="recipe-title"
                          value={recipeDraft.title}
                          onChange={(event) =>
                            setRecipeDraft((previous) => ({ ...previous, title: event.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="recipe-season">Seasonal Tag</Label>
                        <Input
                          id="recipe-season"
                          placeholder="Autumn/Winter"
                          value={recipeDraft.seasonal_tag}
                          onChange={(event) =>
                            setRecipeDraft((previous) => ({
                              ...previous,
                              seasonal_tag: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="recipe-description">Recipe Description</Label>
                      <Textarea
                        id="recipe-description"
                        value={recipeDraft.description}
                        onChange={(event) =>
                          setRecipeDraft((previous) => ({
                            ...previous,
                            description: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div>
                        <Label htmlFor="recipe-ingredients">Ingredients</Label>
                        <Textarea
                          id="recipe-ingredients"
                          className="min-h-36"
                          value={recipeDraft.ingredients}
                          onChange={(event) =>
                            setRecipeDraft((previous) => ({
                              ...previous,
                              ingredients: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="recipe-instructions">Cooking Instructions</Label>
                        <Textarea
                          id="recipe-instructions"
                          className="min-h-36"
                          value={recipeDraft.instructions}
                          onChange={(event) =>
                            setRecipeDraft((previous) => ({
                              ...previous,
                              instructions: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <ImageSourceField
                      id="recipe-image"
                      label="Recipe Image URL"
                      value={recipeDraft.image_url}
                      onChange={(value) =>
                        setRecipeDraft((previous) => ({
                          ...previous,
                          image_url: value,
                        }))
                      }
                      uploadScope="recipes"
                      helpText="Paste a recipe image URL or upload a recipe image from your computer."
                    />
                    <div>
                      <p className="mb-2 text-sm font-medium">Link Products</p>
                      {producerProducts.length === 0 ? (
                        <p className="text-sm text-gray-600">No producer products are available to link.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {producerProducts.map((product) => {
                            const checked = recipeDraft.product_ids.includes(product.id);
                            return (
                              <label
                                key={product.id}
                                className="flex cursor-pointer items-center gap-3 rounded-md border border-[#eee8dc] bg-white/70 p-2"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) =>
                                    toggleRecipeProduct(product.id, value === true)
                                  }
                                />
                                <span className="text-sm">
                                  {product.name} ({product.unit}) • £{Number(product.price).toFixed(2)}
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
                  </>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="story-title">Story Title</Label>
                        <Input
                          id="story-title"
                          value={storyDraft.title}
                          onChange={(event) =>
                            setStoryDraft((previous) => ({ ...previous, title: event.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="story-season">Seasonal Tag</Label>
                        <Input
                          id="story-season"
                          placeholder="Harvest Season"
                          value={storyDraft.seasonal_tag}
                          onChange={(event) =>
                            setStoryDraft((previous) => ({
                              ...previous,
                              seasonal_tag: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="story-body">Story</Label>
                      <Textarea
                        id="story-body"
                        className="min-h-48"
                        value={storyDraft.body}
                        onChange={(event) =>
                          setStoryDraft((previous) => ({ ...previous, body: event.target.value }))
                        }
                      />
                    </div>
                    <ImageSourceField
                      id="story-image"
                      label="Story Image URL"
                      value={storyDraft.image_url}
                      onChange={(value) =>
                        setStoryDraft((previous) => ({
                          ...previous,
                          image_url: value,
                        }))
                      }
                      uploadScope="stories"
                      helpText="Paste a story image URL or upload a story image from your computer."
                    />
                    <Button onClick={publishStory} disabled={publishingStory}>
                      {publishingStory ? 'Publishing...' : 'Publish Story'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#d8d0c0] bg-[#f8f4ec] shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Sparkles className="size-5 text-[var(--earth-accent)]" />
                      AI assistant
                    </CardTitle>
                    <p className="mt-1 text-sm text-gray-600">
                      Optional drafts. Nothing publishes until you use and edit a suggestion.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setAiPanelOpen((value) => !value)}>
                    {aiPanelOpen ? 'Hide' : 'Open'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {aiPanelOpen && (
                  <div className="space-y-4 rounded-xl border border-[#e4ded2] bg-[#fffefa] p-4">
                    <Tabs
                      value={aiDraft.content_type}
                      onValueChange={(value) =>
                        setAiDraft((previous) => ({ ...previous, content_type: value as AiContentType }))
                      }
                    >
                      <TabsList>
                        <TabsTrigger value="recipe">Recipe</TabsTrigger>
                        <TabsTrigger value="story">Farm Story</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <div>
                        <Label htmlFor="ai-tone">Tone</Label>
                        <Input
                          id="ai-tone"
                          placeholder="Warm, practical"
                          value={aiDraft.tone}
                          onChange={(event) =>
                            setAiDraft((previous) => ({ ...previous, tone: event.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="ai-season">Seasonal Tag</Label>
                        <Input
                          id="ai-season"
                          placeholder="Autumn"
                          value={aiDraft.seasonal_tag}
                          onChange={(event) =>
                            setAiDraft((previous) => ({ ...previous, seasonal_tag: event.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="ai-occasion">Occasion</Label>
                      <Input
                        id="ai-occasion"
                        placeholder="Weekly box, family dinner, harvest update"
                        value={aiDraft.occasion}
                        onChange={(event) =>
                          setAiDraft((previous) => ({ ...previous, occasion: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="ai-notes">Product Context</Label>
                      <Textarea
                        id="ai-notes"
                        value={aiDraft.notes}
                        onChange={(event) =>
                          setAiDraft((previous) => ({ ...previous, notes: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="ai-storage">Storage or Cooking Guidance</Label>
                      <Textarea
                        id="ai-storage"
                        value={aiDraft.storage_context}
                        onChange={(event) =>
                          setAiDraft((previous) => ({ ...previous, storage_context: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-medium">Products for Context</p>
                      {producerProducts.length === 0 ? (
                        <p className="text-sm text-gray-600">No producer products are available for AI context.</p>
                      ) : (
                        <div className="grid gap-2">
                          {producerProducts.map((product) => {
                            const checked = aiDraft.product_ids.includes(product.id);
                            return (
                              <label
                                key={product.id}
                                className="flex cursor-pointer items-center gap-3 rounded-md border border-[#eee8dc] bg-white/70 p-2"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) => toggleAiProduct(product.id, value === true)}
                                />
                                <span className="text-sm">
                                  {product.name} ({product.unit}) • £{Number(product.price).toFixed(2)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <Button onClick={generateAiSuggestions} disabled={generatingAi} className="w-full">
                      <Sparkles className="mr-2 size-4" />
                      {generatingAi ? 'Generating...' : 'Generate 3 Suggestions'}
                    </Button>
                  </div>
                )}

                {generatingAi && (
                  <div className="grid gap-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="rounded-lg border border-[#eee8dc] bg-white/75 p-4">
                        <Skeleton className="h-5 w-2/3 bg-[color-mix(in_srgb,var(--forest-green)_12%,white)]" />
                        <Skeleton className="mt-3 h-3 w-full bg-[#ece8df]" />
                        <Skeleton className="mt-2 h-3 w-5/6 bg-[#ece8df]" />
                      </div>
                    ))}
                  </div>
                )}

                {!generatingAi && aiSuggestions.length === 0 && (
                  <div className="rounded-lg border border-dashed border-[#d8d0c0] bg-white/60 p-4 text-sm text-gray-600">
                    Saved AI suggestions appear here privately.
                  </div>
                )}

                {!generatingAi &&
                  aiSuggestions.slice(0, 5).map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="rounded-lg border border-[#e4ded2] bg-white/80 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--forest-green)]">
                            {suggestion.content_type === 'recipe' ? 'Recipe suggestion' : 'Farm story suggestion'}
                            {suggestion.status === 'used' ? ' • used' : ''}
                          </p>
                          <h3 className="mt-1 font-semibold">{suggestion.title}</h3>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAiSuggestion(suggestion.id)}
                          aria-label="Delete AI suggestion"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <p className="mt-2 max-h-24 overflow-hidden whitespace-pre-line text-sm text-gray-700">
                        {suggestion.content_type === 'recipe'
                          ? suggestion.description || suggestion.instructions
                          : suggestion.body}
                      </p>
                      {suggestion.products.length > 0 && (
                        <p className="mt-2 text-xs text-gray-500">
                          Context: {suggestion.products.map((product) => product.name).join(', ')}
                        </p>
                      )}
                      <Button size="sm" className="mt-3" onClick={() => useAiSuggestion(suggestion)}>
                        Use as {suggestion.content_type === 'recipe' ? 'recipe' : 'story'}
                      </Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={filter} onValueChange={(value) => setFilter(value as FeedFilter)}>
          <TabsList>
            <TabsTrigger value="all">All Content</TabsTrigger>
            <TabsTrigger value="recipe">Recipes</TabsTrigger>
            <TabsTrigger value="story">Farm Stories</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <FeedLoadingSkeleton rows={4} />
        ) : visibleFeed.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-600">
              No feed entries available for this filter.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleFeed.map((entry) => {
              const key = detailKey(entry.type, entry.id);
              const details = detailsByKey[key];
              const isRecipe = entry.type === 'recipe';

              return (
                <Card key={key}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">{entry.title}</CardTitle>
                        <p className="mt-1 text-sm text-gray-600">By {entry.producer_name}</p>
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
                        {details
                          ? isRecipe
                            ? 'Hide Recipe'
                            : 'Hide Story'
                          : isRecipe
                            ? 'View Full Recipe'
                            : 'View Full Story'}
                      </Button>
                      {isRecipe && isBuyer && (
                        <Button
                          size="sm"
                          variant={savedRecipeIds.has(entry.id) ? 'default' : 'outline'}
                          onClick={() => toggleSavedRecipe(entry.id)}
                        >
                          <Star className="mr-2 size-4" />
                          {savedRecipeIds.has(entry.id) ? 'Saved Recipe' : 'Save Recipe'}
                        </Button>
                      )}
                    </div>

                    {detailLoadingKey === key && (
                      <div className="space-y-3 rounded-md border bg-gray-50 p-3">
                        <Skeleton className="h-40 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    )}

                    {details && (
                      <div className="space-y-3 rounded-md border bg-gray-50 p-3">
                        {details.image_url && (
                          <img
                            src={details.image_url}
                            alt={details.title}
                            className="h-48 w-full rounded-md object-cover"
                          />
                        )}

                        {'ingredients' in details ? (
                          <>
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <BookOpenText className="size-4" />
                              Ingredients
                            </div>
                            <p className="whitespace-pre-line text-sm">{details.ingredients}</p>
                            <div className="mt-3 flex items-center gap-2 text-sm font-medium">
                              <Newspaper className="size-4" />
                              Instructions
                            </div>
                            <p className="whitespace-pre-line text-sm">{details.instructions}</p>
                            {details.linked_products.length > 0 && (
                              <div className="pt-2">
                                <p className="text-xs text-gray-600">Linked products</p>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {details.linked_products.map((product) => (
                                    <Button
                                      key={product.id}
                                      variant="outline"
                                      size="sm"
                                      onClick={() => navigate(`/product/${product.id}`)}
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
                            <p className="whitespace-pre-line text-sm">{details.body}</p>
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
