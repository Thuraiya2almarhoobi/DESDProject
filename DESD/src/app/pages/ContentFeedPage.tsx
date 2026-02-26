import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, BookOpenText, Leaf, Newspaper, Star } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ApiFeedEntry, ApiRecipe, ApiStory, apiJson } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

type FeedFilter = 'all' | 'recipe' | 'story';

type FeedDetail = ApiRecipe | ApiStory;

function detailKey(type: string, id: number): string {
  return `${type}:${id}`;
}

export function ContentFeedPage() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<ApiFeedEntry[]>([]);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [loading, setLoading] = useState(true);
  const [detailLoadingKey, setDetailLoadingKey] = useState<string | null>(null);
  const [detailsByKey, setDetailsByKey] = useState<Record<string, FeedDetail>>({});
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let mounted = true;

    const loadFeed = async () => {
      setLoading(true);
      try {
        const [entries, recipes] = await Promise.all([
          apiJson<ApiFeedEntry[]>('/api/content/feed/'),
          apiJson<ApiRecipe[]>('/api/content/recipes/'),
        ]);

        if (!mounted) {
          return;
        }

        setFeed(entries);
        setSavedRecipeIds(new Set(recipes.filter((recipe) => recipe.saved).map((recipe) => recipe.id)));
      } catch {
        if (mounted) {
          toast.error('Unable to load recipes and stories feed.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadFeed();

    return () => {
      mounted = false;
    };
  }, []);

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
    } catch (error) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate('/marketplace')}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Marketplace
          </Button>
          <Button variant="outline" onClick={() => navigate('/orders/history')}>Order History</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Recipes & Stories</h1>
          <p className="text-sm text-gray-600 mt-1">Community feed powered by producer content in the `content` app.</p>
        </div>

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
                      {isRecipe && (
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
                                    <Badge key={product.id} variant="outline">{product.name}</Badge>
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
