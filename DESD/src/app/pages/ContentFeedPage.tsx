/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the ContentFeedPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  ArrowLeft,
  BookOpenText,
  Flag,
  Leaf,
  Newspaper,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ApiFeedEntry, ApiGeneratedContentSuggestion, ApiRecipe, ApiStory, apiJson } from '../lib/api';
import { hasMinWords, isValidOptionalUrl, validateRequiredText } from '../lib/formValidation';
import { formatCompactNumber } from '../lib/numberFormat';
import { useSafeBack } from '../lib/navigation';
import { reportModerationTarget } from '../lib/moderation';
import { useAuth } from '../contexts/AuthContext';
import { ImageSourceField } from '../components/ImageSourceField';
import { SiteHeader } from '../components/SiteHeader';
import { FeedLoadingSkeleton } from '../components/LoadingSkeletons';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

type FeedFilter = 'all' | 'recipe' | 'story' | 'saved';
type AiContentType = 'recipe' | 'story';
type AiPanelMode = 'generate' | 'saved';
type ContentView = 'all' | 'recipes' | 'stories';
type ProductPickerTarget = 'recipe' | 'ai';

type FeedDetail = ApiRecipe | ApiStory;

/**
 * ALL_PRODUCERS boundary.
 *
 * This exported unit supports the file role: Implements the ContentFeedPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const ALL_PRODUCERS = 'all-producers';
const ALL_PRODUCTS = 'all-products';
const ALL_SEASONS = 'all-seasons';
const AI_SUGGESTION_LIMIT = 2;

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
  is_ai_generated: boolean;
}

interface StoryDraft {
  title: string;
  body: string;
  seasonal_tag: string;
  image_url: string;
  is_ai_generated: boolean;
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

/**
 * INITIAL_RECIPE_DRAFT boundary.
 *
 * This exported unit supports the file role: Implements the ContentFeedPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const INITIAL_RECIPE_DRAFT: RecipeDraft = {
  title: '',
  description: '',
  ingredients: '',
  instructions: '',
  seasonal_tag: '',
  image_url: '',
  product_ids: [],
  is_ai_generated: false,
};

const INITIAL_STORY_DRAFT: StoryDraft = {
  title: '',
  body: '',
  seasonal_tag: '',
  image_url: '',
  is_ai_generated: false,
};

/**
 * INITIAL_AI_DRAFT boundary.
 *
 * This exported unit supports the file role: Implements the ContentFeedPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
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

function sameProductSelection(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = [...left].sort((a, b) => a - b);
  const sortedRight = [...right].sort((a, b) => a - b);
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function isSameRecipeDraft(left: RecipeDraft, right: RecipeDraft): boolean {
  return (
    left.title === right.title &&
    left.description === right.description &&
    left.ingredients === right.ingredients &&
    left.instructions === right.instructions &&
    left.seasonal_tag === right.seasonal_tag &&
    left.image_url === right.image_url &&
    sameProductSelection(left.product_ids, right.product_ids)
  );
}

function isSameStoryDraft(left: StoryDraft, right: StoryDraft): boolean {
  return (
    left.title === right.title &&
    left.body === right.body &&
    left.seasonal_tag === right.seasonal_tag &&
    left.image_url === right.image_url
  );
}

interface ContentFeedPageProps {
  mode?: 'feed' | 'publish';
  contentView?: ContentView;
}

/**
 * ContentFeedPage boundary.
 *
 * This exported unit supports the file role: Implements the ContentFeedPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function ContentFeedPage({ mode = 'feed', contentView = 'all' }: ContentFeedPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isProducer = user?.role === 'PRODUCER';
  const isAdminReadOnly = user?.role === 'ADMIN';
  const adminReturnTo = new URLSearchParams(location.search).get('returnTo')?.startsWith('/admin')
    ? new URLSearchParams(location.search).get('returnTo') || '/admin/moderation'
    : '/admin/moderation';
  const isPublishMode = mode === 'publish';
  const showProducerPublisher = isProducer && isPublishMode;
  const isBuyer = !isAdminReadOnly && (user?.role === 'CUSTOMER' || user?.role === 'PRODUCER' || user?.role === 'COMMUNITY' || user?.role === 'RESTAURANT');
  const goBack = useSafeBack(showProducerPublisher ? '/producer/dashboard' : '/marketplace');
  const pageFilter: FeedFilter =
    contentView === 'recipes' ? 'recipe' : contentView === 'stories' ? 'story' : 'all';
  const isRecipesPage = contentView === 'recipes';
  const isStoriesPage = contentView === 'stories';

  const [feed, setFeed] = useState<ApiFeedEntry[]>([]);
  const [filter, setFilter] = useState<FeedFilter>(pageFilter);
  const [loading, setLoading] = useState(true);
  const [detailLoadingKey, setDetailLoadingKey] = useState<string | null>(null);
  const [detailsByKey, setDetailsByKey] = useState<Record<string, FeedDetail>>({});
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<number>>(new Set());
  const [activeReportKey, setActiveReportKey] = useState<string | null>(null);
  const [contentSearch, setContentSearch] = useState('');
  const [producerFilter, setProducerFilter] = useState(ALL_PRODUCERS);
  const [productFilter, setProductFilter] = useState(ALL_PRODUCTS);
  const [seasonFilter, setSeasonFilter] = useState(ALL_SEASONS);
  const [producerProducts, setProducerProducts] = useState<ProducerProductOption[]>([]);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft>(INITIAL_RECIPE_DRAFT);
  const [storyDraft, setStoryDraft] = useState<StoryDraft>(INITIAL_STORY_DRAFT);
  const [aiRecipeBaseline, setAiRecipeBaseline] = useState<RecipeDraft | null>(null);
  const [aiStoryBaseline, setAiStoryBaseline] = useState<StoryDraft | null>(null);
  const [composerMode, setComposerMode] = useState<AiContentType>('recipe');
  const [aiDraft, setAiDraft] = useState<AiDraft>(INITIAL_AI_DRAFT);
  const [lastAiDraft, setLastAiDraft] = useState<AiDraft | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<ApiGeneratedContentSuggestion[]>([]);
  const [aiPanelMode, setAiPanelMode] = useState<AiPanelMode>('generate');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [publishingRecipe, setPublishingRecipe] = useState(false);
  const [publishingStory, setPublishingStory] = useState(false);
  const [productPickerTarget, setProductPickerTarget] = useState<ProductPickerTarget | null>(null);
  const focusedContentKeyRef = useRef<string | null>(null);
  const adminScopedReturnTo = `${location.pathname}${location.search}`;
  const backButton = (
    <Button variant="ghost" onClick={isAdminReadOnly ? () => navigate(adminReturnTo) : goBack}>
      <ArrowLeft className="mr-2 size-4" />
      {isAdminReadOnly ? 'Back to moderation' : 'Back'}
    </Button>
  );
  const activeContentSection = showProducerPublisher
    ? 'publish'
    : contentView === 'stories'
      ? 'stories'
      : 'recipes';
  const contentNavButtonClass = 'min-w-24 justify-center';
  const contentSectionNav = (
    <div className="inline-flex flex-wrap rounded-xl border border-[#d7dfd0] bg-white p-1 shadow-sm">
      {isProducer && (
        <Button
          type="button"
          variant={activeContentSection === 'publish' ? 'default' : 'ghost'}
          size="sm"
          className={contentNavButtonClass}
          onClick={() => navigate('/producer/publish')}
        >
          Publish
        </Button>
      )}
      <Button
        type="button"
        variant={activeContentSection === 'recipes' ? 'default' : 'ghost'}
        size="sm"
        className={contentNavButtonClass}
        onClick={() => navigate(isAdminReadOnly ? '/admin/content-preview/recipes?adminPreview=1&returnTo=/admin/moderation' : '/content/recipes')}
      >
        Recipes
      </Button>
      <Button
        type="button"
        variant={activeContentSection === 'stories' ? 'default' : 'ghost'}
        size="sm"
        className={contentNavButtonClass}
        onClick={() => navigate(isAdminReadOnly ? '/admin/content-preview/stories?adminPreview=1&returnTo=/admin/moderation' : '/content/stories')}
      >
        Farm Stories
      </Button>
    </div>
  );
  const contentPageCopy = showProducerPublisher
    ? {
        eyebrow: 'Producer workspace',
        title: 'Publish Recipes & Farm Stories',
        description:
          'Create recipes and farm stories from a focused producer editor. AI suggestions stay private until you choose one and publish manually.',
      }
    : isRecipesPage
      ? {
          eyebrow: 'Producer recipes',
          title: 'Recipes',
          description:
            'Browse seasonal ideas from local producers, open full instructions, and save recipes into your own recipe list.',
        }
      : isStoriesPage
        ? {
            eyebrow: 'Farm stories',
            title: 'Farm Stories',
            description:
              'Read producer updates, harvest notes, and farm context that explain where the food is coming from.',
          }
        : {
            eyebrow: 'Published content',
            title: 'Recipes & Farm Stories',
            description:
              'Browse producer recipes and farm stories, then save recipes into your own saved area for later.',
          };

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const [entries, recipes, producerProductsPayload, aiSuggestionsPayload] = await Promise.all([
        apiJson<ApiFeedEntry[]>('/api/content/feed/'),
        apiJson<ApiRecipe[]>('/api/content/recipes/'),
	        showProducerPublisher
	          ? apiJson<ProducerProductOption[]>('/api/content/producer/products/')
	          : Promise.resolve([] as ProducerProductOption[]),
	        showProducerPublisher
	          ? apiJson<ApiGeneratedContentSuggestion[]>('/api/content/ai/suggestions/')
	          : Promise.resolve([] as ApiGeneratedContentSuggestion[]),
      ]);

      const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
      setFeed(
        entries.map((entry) => {
          if (entry.type === 'recipe') {
            return {
              ...entry,
              linked_products: entry.linked_products ?? recipesById.get(entry.id)?.linked_products ?? [],
            };
          }
          return { ...entry, linked_products: entry.linked_products ?? [] };
        }),
      );
      setSavedRecipeIds(new Set(recipes.filter((recipe) => recipe.saved).map((recipe) => recipe.id)));
      setProducerProducts(producerProductsPayload);
      setAiSuggestions(aiSuggestionsPayload.slice(0, AI_SUGGESTION_LIMIT));
    } catch {
      toast.error('Unable to load recipes and stories feed.');
    } finally {
      setLoading(false);
    }
	  }, [showProducerPublisher]);

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

  useEffect(() => {
    const requestedFilter = new URLSearchParams(location.search).get('filter');
    setFilter(!isAdminReadOnly && requestedFilter === 'saved' ? 'saved' : pageFilter);
  }, [isAdminReadOnly, location.search, pageFilter]);

  useEffect(() => {
    setContentSearch('');
    setProducerFilter(ALL_PRODUCERS);
    setProductFilter(ALL_PRODUCTS);
    setSeasonFilter(ALL_SEASONS);
  }, [contentView]);

  const recipeAiLabelLocked = Boolean(
    aiRecipeBaseline && recipeDraft.is_ai_generated && isSameRecipeDraft(recipeDraft, aiRecipeBaseline),
  );
  const storyAiLabelLocked = Boolean(
    aiStoryBaseline && storyDraft.is_ai_generated && isSameStoryDraft(storyDraft, aiStoryBaseline),
  );

  useEffect(() => {
    if (aiRecipeBaseline && isSameRecipeDraft(recipeDraft, aiRecipeBaseline) && !recipeDraft.is_ai_generated) {
      setRecipeDraft((previous) => ({ ...previous, is_ai_generated: true }));
    }
  }, [aiRecipeBaseline, recipeDraft]);

  useEffect(() => {
    if (aiStoryBaseline && isSameStoryDraft(storyDraft, aiStoryBaseline) && !storyDraft.is_ai_generated) {
      setStoryDraft((previous) => ({ ...previous, is_ai_generated: true }));
    }
  }, [aiStoryBaseline, storyDraft]);

  const pageFeed = useMemo(() => {
    if (filter === 'all') {
      return feed;
    }
    if (filter === 'saved') {
      return feed.filter((entry) => entry.type === 'recipe' && savedRecipeIds.has(entry.id));
    }
    return feed.filter((entry) => entry.type === filter);
  }, [feed, filter, savedRecipeIds]);

  const producerOptions = useMemo(
    () => Array.from(new Set(pageFeed.map((entry) => entry.producer_name))).sort((a, b) => a.localeCompare(b)),
    [pageFeed],
  );
  const producerIdByName = useMemo(() => {
    const lookup = new Map<string, number>();
    pageFeed.forEach((entry) => {
      if (entry.producer) {
        lookup.set(entry.producer_name, entry.producer);
      }
    });
    return lookup;
  }, [pageFeed]);

  const productOptions = useMemo(() => {
    const products = new Map<number, { id: number; name: string; unit: string; price: string }>();
    pageFeed.forEach((entry) => {
      (entry.linked_products ?? []).forEach((product) => products.set(product.id, product));
    });
    return Array.from(products.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [pageFeed]);

  const seasonOptions = useMemo(
    () =>
      Array.from(new Set(pageFeed.map((entry) => entry.seasonal_tag.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [pageFeed],
  );

  const visibleFeed = useMemo(() => {
    const normalizedSearch = contentSearch.trim().toLowerCase();
    return pageFeed.filter((entry) => {
      if (producerFilter !== ALL_PRODUCERS && entry.producer_name !== producerFilter) {
        return false;
      }
      if (seasonFilter !== ALL_SEASONS && entry.seasonal_tag !== seasonFilter) {
        return false;
      }
      if (
        productFilter !== ALL_PRODUCTS &&
        !(entry.linked_products ?? []).some((product) => String(product.id) === productFilter)
      ) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        entry.title,
        entry.description,
        entry.producer_name,
        entry.seasonal_tag,
        ...(entry.linked_products ?? []).map((product) => product.name),
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [contentSearch, pageFeed, producerFilter, productFilter, seasonFilter]);

  const activeDiscoveryFilterCount = [
    contentSearch.trim(),
    producerFilter !== ALL_PRODUCERS,
    productFilter !== ALL_PRODUCTS,
    seasonFilter !== ALL_SEASONS,
  ].filter(Boolean).length;
  const storyCount = feed.filter((entry) => entry.type === 'story').length;
  const recipeCount = feed.filter((entry) => entry.type === 'recipe').length;
  const contentCount = isStoriesPage ? storyCount : recipeCount;
  const contentNoun = isStoriesPage
    ? contentCount === 1
      ? 'farm story'
      : 'farm stories'
    : contentCount === 1
      ? 'recipe'
      : 'recipes';
  const aiComposerCopy =
    aiDraft.content_type === 'recipe'
      ? {
          occasionLabel: 'Recipe Goal',
          occasionPlaceholder: 'Quick pasta dinner, family meal, seasonal lunch',
          notesLabel: 'Recipe Request',
          notesPlaceholder: 'Example: Make a pasta recipe using tomatoes and keep it easy for a weeknight.',
          storageLabel: 'Cooking or Storage Guidance',
          storagePlaceholder: 'Example: Include storage tips, prep notes, or cooking constraints.',
          pickerTitle: 'Recipe Products for Context',
          pickerDescription: 'Select the marketplace products the recipe should be built around.',
          button: 'Generate Recipe Suggestions',
        }
      : {
          occasionLabel: 'Story Angle',
          occasionPlaceholder: 'Harvest update, farm visit, supplier spotlight',
          notesLabel: 'Farm Story Brief',
          notesPlaceholder: 'Example: Write a story about this product, the harvest, and why it matters this season.',
          storageLabel: 'Production or Handling Notes',
          storagePlaceholder: 'Example: Mention storage, harvest timing, or producer handling details if relevant.',
          pickerTitle: 'Story Products for Context',
          pickerDescription: 'Select the products the farm story should mention or explain.',
          button: 'Generate Farm Story Suggestions',
        };

  const resetDiscoveryFilters = () => {
    setContentSearch('');
    setProducerFilter(ALL_PRODUCERS);
    setProductFilter(ALL_PRODUCTS);
    setSeasonFilter(ALL_SEASONS);
  };
  const toggleSavedRecipe = async (recipeId: number) => {
    if (isAdminReadOnly) {
      toast.info('Admin preview is read-only.');
      return;
    }
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

  const reportContentEntry = async (entry: ApiFeedEntry) => {
    if (isAdminReadOnly) {
      toast.info('Admin preview is read-only.');
      return;
    }
    if (!user) {
      toast.error('Please sign in to report content.');
      return;
    }

    const targetType = entry.type === 'recipe' ? 'recipe' : 'farm_story';
    const key = detailKey(entry.type, entry.id);
    setActiveReportKey(key);
    try {
      await reportModerationTarget(targetType, entry.id, `Reported from the content feed: ${entry.title}`);
      toast.success(`${entry.type === 'recipe' ? 'Recipe' : 'Farm story'} reported to moderation.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to report this content.');
    } finally {
      setActiveReportKey(null);
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

  useEffect(() => {
    if (!isAdminReadOnly || loading) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const recipeId = Number(params.get('recipeId'));
    const storyId = Number(params.get('storyId'));
    const focusedType = Number.isFinite(recipeId) && recipeId > 0 ? 'recipe' : Number.isFinite(storyId) && storyId > 0 ? 'story' : null;
    const focusedId = focusedType === 'recipe' ? recipeId : focusedType === 'story' ? storyId : 0;

    if (!focusedType || !focusedId) {
      return;
    }

    const key = detailKey(focusedType, focusedId);
    if (focusedContentKeyRef.current === key) {
      return;
    }
    focusedContentKeyRef.current = key;

    const scrollToFocusedCard = () => {
      window.setTimeout(() => {
        document
          .getElementById(`content-entry-${focusedType}-${focusedId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
    };

    const existingEntry = feed.find((entry) => entry.type === focusedType && entry.id === focusedId);
    if (existingEntry) {
      if (!detailsByKey[key]) {
        void openDetails(existingEntry);
      }
      scrollToFocusedCard();
      return;
    }

    const loadFocusedModerationContent = async () => {
      setDetailLoadingKey(key);
      try {
        if (focusedType === 'recipe') {
          const recipe = await apiJson<ApiRecipe>(`/api/content/recipes/${focusedId}/`);
          setDetailsByKey((previous) => ({ ...previous, [key]: recipe }));
          setFeed((previous) =>
            previous.some((entry) => entry.type === 'recipe' && entry.id === recipe.id)
              ? previous
              : [
                  {
                    type: 'recipe',
                    id: recipe.id,
                    title: recipe.title,
                    description: recipe.description,
                    producer: recipe.producer,
                    producer_name: recipe.producer_name,
                    seasonal_tag: recipe.seasonal_tag,
                    is_ai_generated: recipe.is_ai_generated,
                    linked_products: recipe.linked_products,
                    created_at: recipe.created_at,
                  },
                  ...previous,
                ],
          );
        } else {
          const story = await apiJson<ApiStory>(`/api/content/stories/${focusedId}/`);
          setDetailsByKey((previous) => ({ ...previous, [key]: story }));
          setFeed((previous) =>
            previous.some((entry) => entry.type === 'story' && entry.id === story.id)
              ? previous
              : [
                  {
                    type: 'story',
                    id: story.id,
                    title: story.title,
                    description: story.body.slice(0, 300),
                    producer: story.producer,
                    producer_name: story.producer_name,
                    seasonal_tag: story.seasonal_tag,
                    is_ai_generated: story.is_ai_generated,
                    linked_products: [],
                    created_at: story.created_at,
                  },
                  ...previous,
                ],
          );
        }
        scrollToFocusedCard();
      } catch {
        toast.error('Unable to load the moderation preview content.');
      } finally {
        setDetailLoadingKey(null);
      }
    };

    void loadFocusedModerationContent();
  }, [detailsByKey, feed, isAdminReadOnly, loading, location.search]);

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

  const setProductSelection = (target: ProductPickerTarget, productId: number, checked: boolean) => {
    if (target === 'recipe') {
      toggleRecipeProduct(productId, checked);
      return;
    }
    toggleAiProduct(productId, checked);
  };

  const productPickerSelectedIds =
    productPickerTarget === 'recipe'
      ? recipeDraft.product_ids
      : productPickerTarget === 'ai'
        ? aiDraft.product_ids
        : [];

  const renderSelectedProducts = (
    target: ProductPickerTarget,
    selectedIds: number[],
    emptyText: string,
  ) => {
    const selectedProducts = producerProducts.filter((product) => selectedIds.includes(product.id));
    if (selectedProducts.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-[#d9d0c0] bg-white/60 px-4 py-3 text-sm text-gray-600">
          {emptyText}
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {selectedProducts.map((product) => (
          <Badge
            key={product.id}
            variant="outline"
            className="gap-2 rounded-full border-[#d9d0c0] bg-white px-3 py-1 text-sm text-[var(--rich-soil)]"
          >
            {product.name}
            <button
              type="button"
              className="rounded-full text-gray-500 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              onClick={() => setProductSelection(target, product.id, false)}
              aria-label={`Remove ${product.name}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
    );
  };

  const renderProductPickerSummary = (
    target: ProductPickerTarget,
    title: string,
    emptyText: string,
  ) => {
    const selectedIds = target === 'recipe' ? recipeDraft.product_ids : aiDraft.product_ids;
    return (
      <div className="rounded-2xl border border-[#eee8dc] bg-[#fffefa] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-[var(--rich-soil)]">{title}</p>
            <p className="mt-1 text-xs text-gray-600">
              {selectedIds.length === 0
                ? 'No products selected'
                : `${selectedIds.length} product${selectedIds.length === 1 ? '' : 's'} selected`}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setProductPickerTarget(target)}
            disabled={producerProducts.length === 0}
          >
            Select Products
          </Button>
        </div>
        {producerProducts.length === 0 ? (
          <p className="text-sm text-gray-600">No producer products are available.</p>
        ) : (
          renderSelectedProducts(target, selectedIds, emptyText)
        )}
      </div>
    );
  };

  const createRandomAiDraft = (): AiDraft | null => {
    const candidates = producerProducts.filter((product) => product.is_available);
    const productPool = candidates.length > 0 ? candidates : producerProducts;
    if (productPool.length === 0) {
      return null;
    }

    const tones = ['warm and practical', 'seasonal and concise', 'friendly and confident', 'simple and useful'];
    const occasions = ['weekly shop', 'family meal', 'seasonal market', 'local food box'];
    const seasons = ['Current season', 'Market week', 'Fresh harvest', 'Local produce'];
    const selectedProduct = productPool[Math.floor(Math.random() * productPool.length)];

    return {
      content_type: Math.random() > 0.5 ? 'recipe' : 'story',
      product_ids: [selectedProduct.id],
      notes: '',
      tone: tones[Math.floor(Math.random() * tones.length)],
      occasion: occasions[Math.floor(Math.random() * occasions.length)],
      storage_context: '',
      seasonal_tag: seasons[Math.floor(Math.random() * seasons.length)],
    };
  };

  const generateAiSuggestions = async (draftOverride?: AiDraft) => {
    const draftToUse = draftOverride ?? aiDraft;
    if (draftToUse.product_ids.length === 0) {
      toast.error('Select at least one product for the AI assistant.');
      return;
    }

    setAiPanelMode('saved');
    setGeneratingAi(true);
    setLastAiDraft(draftToUse);
    try {
      const suggestions = await apiJson<ApiGeneratedContentSuggestion[]>('/api/content/ai/suggestions/', {
        method: 'POST',
        body: JSON.stringify(draftToUse),
	      });
	      setAiSuggestions(suggestions.slice(0, AI_SUGGESTION_LIMIT));
	      toast.success('AI suggestions saved privately.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to generate AI suggestions.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const reloadAiSuggestions = () => {
    const draftToUse = lastAiDraft ?? aiDraft;
    if (draftToUse.product_ids.length === 0) {
      const randomDraft = createRandomAiDraft();
      if (!randomDraft) {
        toast.error('Add a producer product before generating random AI suggestions.');
        return;
      }
      void generateAiSuggestions(randomDraft);
      return;
    }

    void generateAiSuggestions(draftToUse);
  };

  const fullRefreshAiSuggestions = () => {
    const randomDraft = createRandomAiDraft();
    if (!randomDraft) {
      toast.error('Add a producer product before generating random AI suggestions.');
      return;
    }

    setAiDraft(randomDraft);
    void generateAiSuggestions(randomDraft);
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

/**
 * useAiSuggestion boundary.
 *
 * This exported unit supports the file role: Implements the ContentFeedPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
  const useAiSuggestion = (suggestion: ApiGeneratedContentSuggestion) => {
    const productIds = suggestion.products.map((product) => product.id);
    if (suggestion.content_type === 'recipe') {
      const nextRecipeDraft = {
        title: suggestion.title,
        description: suggestion.description,
        ingredients: suggestion.ingredients,
        instructions: suggestion.instructions,
        seasonal_tag: suggestion.seasonal_tag,
        image_url: '',
        product_ids: productIds,
        is_ai_generated: true,
      };
      setRecipeDraft(nextRecipeDraft);
      setAiRecipeBaseline(nextRecipeDraft);
      setAiStoryBaseline(null);
      setComposerMode('recipe');
      toast.success('Recipe draft filled from AI suggestion.');
    } else {
      const nextStoryDraft = {
        title: suggestion.title,
        body: suggestion.body,
        seasonal_tag: suggestion.seasonal_tag,
        image_url: '',
        is_ai_generated: true,
      };
      setStoryDraft(nextStoryDraft);
      setAiStoryBaseline(nextStoryDraft);
      setAiRecipeBaseline(null);
      setComposerMode('story');
      toast.success('Farm story draft filled from AI suggestion.');
    }
    void markAiSuggestionUsed(suggestion.id);
  };

  const publishRecipe = async () => {
    const requiredError =
      validateRequiredText(recipeDraft.title, 'Recipe title', 3) ||
      validateRequiredText(recipeDraft.description, 'Recipe description', 10) ||
      validateRequiredText(recipeDraft.ingredients, 'Ingredients', 10) ||
      validateRequiredText(recipeDraft.instructions, 'Cooking instructions', 15);
    if (requiredError) {
      toast.error(requiredError);
      return;
    }
    if (!hasMinWords(recipeDraft.instructions, 8)) {
      toast.error('Cooking instructions must include enough detail for a customer to follow them.');
      return;
    }
    if (!isValidOptionalUrl(recipeDraft.image_url)) {
      toast.error('Recipe image URL must start with http:// or https://.');
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
      setAiRecipeBaseline(null);
      await loadFeed();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to publish recipe.');
    } finally {
      setPublishingRecipe(false);
    }
  };

  const publishStory = async () => {
    const requiredError =
      validateRequiredText(storyDraft.title, 'Story title', 3) ||
      validateRequiredText(storyDraft.body, 'Story body', 20);
    if (requiredError) {
      toast.error(requiredError);
      return;
    }
    if (!hasMinWords(storyDraft.body, 12)) {
      toast.error('Farm story body must include at least twelve words.');
      return;
    }
    if (!isValidOptionalUrl(storyDraft.image_url)) {
      toast.error('Farm story image URL must start with http:// or https://.');
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
      setAiStoryBaseline(null);
      await loadFeed();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to publish story.');
    } finally {
      setPublishingStory(false);
    }
  };

	  return (
	    <div className="min-h-screen bg-[#f3fbf1]">
	      <SiteHeader
	        {...(!showProducerPublisher
	          ? {
	              searchQuery: contentSearch,
	              onSearchQueryChange: setContentSearch,
	              onSearchSubmit: setContentSearch,
	              searchPlaceholder: isStoriesPage
	                ? 'Search farm stories, producers, or seasons...'
	                : 'Search recipes, producers, products, or seasons...',
	            }
	          : {})}
	      />

	      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-5 lg:px-6">
	        <div className="flex flex-wrap items-center justify-between gap-3">
	          {backButton}
	          <div className="flex min-h-11 flex-wrap items-center gap-2">
	            {contentSectionNav}
	          {isBuyer ? (
	            <div className="flex flex-wrap gap-2">
	              <Button
	                variant="outline"
	                onClick={() => {
	                  if (showProducerPublisher) {
	                    navigate('/content/recipes?filter=saved');
	                    return;
	                  }
	                  setFilter('saved');
	                }}
	              >
	                <Star className="mr-2 size-4" />
	                Saved Recipes
	              </Button>
	              <Button variant="outline" onClick={() => navigate('/orders/history')}>
	                Order History
	              </Button>
	            </div>
	          ) : isAdminReadOnly ? (
	            <Badge variant="outline" className="rounded-full border-[#c7d7c2] bg-[#f2f8ef] px-3 py-2 text-[#256843]">
	              Admin read-only preview
	            </Badge>
	          ) : (
	            <Button variant="outline" onClick={() => navigate('/marketplace')}>
	              Marketplace
	            </Button>
	          )}
	          </div>
	        </div>

	        {isAdminReadOnly && (
	          <div className="mt-4 rounded-2xl border border-[#c7d7c2] bg-[#f2f8ef] px-4 py-3 text-sm text-[#36573d]">
	            You are viewing this content as an administrator. Reports, saves, publishing, and other write actions are disabled.
	          </div>
	        )}

	        <section className="mt-5 rounded-3xl border border-[#dfe8d9] bg-[#fffefa] px-5 py-6 shadow-sm sm:px-7">
	          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
	            <div className="max-w-3xl">
	              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--earth-accent)]">
	                {contentPageCopy.eyebrow}
	              </p>
	              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--rich-soil)] sm:text-4xl">
	                {contentPageCopy.title}
	              </h1>
	              <p className="mt-2 text-sm leading-6 text-[var(--warm-earth)] sm:text-base">
	                {contentPageCopy.description}
	              </p>
	            </div>
	            {!showProducerPublisher && (
	              <div className="rounded-2xl border border-[#e4e1d8] bg-[#f7f4ec] px-4 py-3 text-sm text-[var(--warm-earth)]">
	                <span className="block text-2xl font-semibold leading-none text-[var(--rich-soil)]">
	                  {formatCompactNumber(contentCount)}
	                </span>
	                <span className="mt-1 block">{contentNoun}</span>
	              </div>
	            )}
	          </div>

	          {!showProducerPublisher && (
	            <div className="mt-5 border-t border-[#eee8dc] pt-4">
	              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-h-10">
                {!isStoriesPage && (
                  <Tabs value={filter} onValueChange={(value) => setFilter(value as FeedFilter)}>
                    <TabsList className="bg-[#ede8dc]">
                      {contentView === 'all' && <TabsTrigger value="all">All Content</TabsTrigger>}
                      <TabsTrigger value="recipe">Recipes</TabsTrigger>
                      {contentView === 'all' && <TabsTrigger value="story">Farm Stories</TabsTrigger>}
                      {!isAdminReadOnly && <TabsTrigger value="saved">Saved Recipes</TabsTrigger>}
                    </TabsList>
                  </Tabs>
                )}
                </div>

	                <div className="grid gap-3 sm:grid-cols-3 xl:w-[34rem]">
	                  <div>
	                    <Label className="text-xs uppercase tracking-[0.14em] text-[var(--warm-earth)]">
	                      Producer
	                    </Label>
	                    <Select value={producerFilter} onValueChange={setProducerFilter}>
	                      <SelectTrigger className="mt-2 h-11 rounded-2xl border-[#ded6c8] bg-white">
	                        <SelectValue />
	                      </SelectTrigger>
	                      <SelectContent>
	                        <SelectItem value={ALL_PRODUCERS}>All producers</SelectItem>
	                        {producerOptions.map((producer) => (
	                          <SelectItem key={producer} value={producer}>
	                            {producer}
	                          </SelectItem>
	                        ))}
	                      </SelectContent>
	                    </Select>
	                  </div>

	                  <div>
	                    <Label className="text-xs uppercase tracking-[0.14em] text-[var(--warm-earth)]">
	                      Product
	                    </Label>
	                    <Select
	                      value={productFilter}
	                      onValueChange={setProductFilter}
	                      disabled={productOptions.length === 0}
	                    >
	                      <SelectTrigger className="mt-2 h-11 rounded-2xl border-[#ded6c8] bg-white">
	                        <SelectValue />
	                      </SelectTrigger>
	                      <SelectContent>
	                        <SelectItem value={ALL_PRODUCTS}>All products</SelectItem>
	                        {productOptions.map((product) => (
	                          <SelectItem key={product.id} value={String(product.id)}>
	                            {product.name}
	                          </SelectItem>
	                        ))}
	                      </SelectContent>
	                    </Select>
	                  </div>

	                  <div>
	                    <Label className="text-xs uppercase tracking-[0.14em] text-[var(--warm-earth)]">
	                      Season
	                    </Label>
	                    <Select value={seasonFilter} onValueChange={setSeasonFilter}>
	                      <SelectTrigger className="mt-2 h-11 rounded-2xl border-[#ded6c8] bg-white">
	                        <SelectValue />
	                      </SelectTrigger>
	                      <SelectContent>
	                        <SelectItem value={ALL_SEASONS}>All seasons</SelectItem>
	                        {seasonOptions.map((season) => (
	                          <SelectItem key={season} value={season}>
	                            {season}
	                          </SelectItem>
	                        ))}
	                      </SelectContent>
	                    </Select>
	                  </div>
	                </div>
	              </div>

	              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--warm-earth)]">
	                <div className="flex items-center gap-2">
	                  <SlidersHorizontal className="size-4 text-[var(--forest-green)]" />
	                  <span>
	                    Showing <span className="font-semibold text-[var(--rich-soil)]">{formatCompactNumber(visibleFeed.length)}</span> of{' '}
	                    <span className="font-semibold text-[var(--rich-soil)]">{formatCompactNumber(pageFeed.length)}</span>
	                  </span>
	                </div>
	                {activeDiscoveryFilterCount > 0 && (
	                  <Button variant="ghost" size="sm" onClick={resetDiscoveryFilters} className="h-8 px-2">
	                    <X className="mr-1 size-4" />
	                    Clear filters
	                  </Button>
	                )}
	              </div>
	            </div>
	          )}
	        </section>

		        {showProducerPublisher && (
	          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
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
                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#eee8dc] bg-white/70 p-3">
                      <Checkbox
                        checked={recipeAiLabelLocked ? true : recipeDraft.is_ai_generated}
                        disabled={recipeAiLabelLocked}
                        onCheckedChange={(value) => {
                          if (recipeAiLabelLocked) {
                            return;
                          }
                          setRecipeDraft((previous) => ({ ...previous, is_ai_generated: value === true }));
                        }}
                        aria-label="Show AI generated label on published recipe"
                      />
                      <span>
                        <span className="block text-sm font-medium text-[var(--rich-soil)]">
                          Show AI generated label
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-gray-600">
                          {recipeAiLabelLocked
                            ? 'This label stays on until you edit the AI-filled draft.'
                            : 'Automatically turns on when you use an AI suggestion. You can turn it off before publishing.'}
                        </span>
                      </span>
                    </label>
                    {renderProductPickerSummary(
                      'recipe',
                      'Linked Products',
                      'Select products to link this recipe to your marketplace listings.',
                    )}
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
                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#eee8dc] bg-white/70 p-3">
                      <Checkbox
                        checked={storyAiLabelLocked ? true : storyDraft.is_ai_generated}
                        disabled={storyAiLabelLocked}
                        onCheckedChange={(value) => {
                          if (storyAiLabelLocked) {
                            return;
                          }
                          setStoryDraft((previous) => ({ ...previous, is_ai_generated: value === true }));
                        }}
                        aria-label="Show AI generated label on published farm story"
                      />
                      <span>
                        <span className="block text-sm font-medium text-[var(--rich-soil)]">
                          Show AI generated label
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-gray-600">
                          {storyAiLabelLocked
                            ? 'This label stays on until you edit the AI-filled draft.'
                            : 'Automatically turns on when you use an AI suggestion. You can turn it off before publishing.'}
                        </span>
                      </span>
                    </label>
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
	                  <Tabs value={aiPanelMode} onValueChange={(value) => setAiPanelMode(value as AiPanelMode)}>
	                    <TabsList>
	                      <TabsTrigger value="generate">Generate</TabsTrigger>
	                      <TabsTrigger value="saved">Suggestions</TabsTrigger>
	                    </TabsList>
	                  </Tabs>
	                </div>
	              </CardHeader>
	              <CardContent className="space-y-4">
	                {aiPanelMode === 'generate' && (
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
                      <Label htmlFor="ai-occasion">{aiComposerCopy.occasionLabel}</Label>
                      <Input
                        id="ai-occasion"
                        placeholder={aiComposerCopy.occasionPlaceholder}
                        value={aiDraft.occasion}
                        onChange={(event) =>
                          setAiDraft((previous) => ({ ...previous, occasion: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="ai-notes">{aiComposerCopy.notesLabel}</Label>
                      <Textarea
                        id="ai-notes"
                        placeholder={aiComposerCopy.notesPlaceholder}
                        value={aiDraft.notes}
                        onChange={(event) =>
                          setAiDraft((previous) => ({ ...previous, notes: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="ai-storage">{aiComposerCopy.storageLabel}</Label>
                      <Textarea
                        id="ai-storage"
                        placeholder={aiComposerCopy.storagePlaceholder}
                        value={aiDraft.storage_context}
                        onChange={(event) =>
                          setAiDraft((previous) => ({ ...previous, storage_context: event.target.value }))
                        }
                      />
                    </div>
                    {renderProductPickerSummary(
                      'ai',
                      aiComposerCopy.pickerTitle,
                      aiComposerCopy.pickerDescription,
                    )}
	                    <Button onClick={() => void generateAiSuggestions()} disabled={generatingAi} className="w-full">
	                      <Sparkles className="mr-2 size-4" />
	                      {generatingAi ? 'Generating...' : aiComposerCopy.button}
	                    </Button>
	                  </div>
	                )}

	                {aiPanelMode === 'saved' && (
	                  <div className="flex flex-col gap-2 rounded-xl border border-[#e4ded2] bg-[#fffefa] p-3 sm:flex-row">
	                    <Button
	                      variant="outline"
	                      onClick={reloadAiSuggestions}
	                      disabled={generatingAi}
	                      className="flex-1 justify-center"
	                    >
	                      <RefreshCw className="mr-2 size-4" />
	                      Reload suggestions
	                    </Button>
	                    <Button
	                      variant="outline"
	                      onClick={fullRefreshAiSuggestions}
	                      disabled={generatingAi}
	                      className="flex-1 justify-center border-[#b89573] text-[#6f4b2f] hover:bg-[#f7efe7]"
	                    >
	                      <Sparkles className="mr-2 size-4" />
	                      Random generate
	                    </Button>
	                  </div>
	                )}

	                {aiPanelMode === 'saved' && generatingAi && (
	                  <div className="grid gap-3">
                    {Array.from({ length: AI_SUGGESTION_LIMIT }).map((_, index) => (
                      <div key={index} className="rounded-lg border border-[#eee8dc] bg-white/75 p-4">
                        <Skeleton className="h-5 w-2/3 bg-[color-mix(in_srgb,var(--forest-green)_12%,white)]" />
                        <Skeleton className="mt-3 h-3 w-full bg-[#ece8df]" />
                        <Skeleton className="mt-2 h-3 w-5/6 bg-[#ece8df]" />
                      </div>
                    ))}
	                  </div>
	                )}

	                {aiPanelMode === 'saved' && !generatingAi && aiSuggestions.length === 0 && (
	                  <div className="rounded-lg border border-dashed border-[#d8d0c0] bg-white/60 p-4 text-sm text-gray-600">
	                    AI suggestions appear here privately.
	                  </div>
	                )}

	                {aiPanelMode === 'saved' && !generatingAi &&
	                  aiSuggestions.slice(0, AI_SUGGESTION_LIMIT).map((suggestion) => (
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

	        {!showProducerPublisher && (
	          <section className="mt-6 space-y-4">
	            {loading ? (
	              <FeedLoadingSkeleton rows={4} />
	            ) : visibleFeed.length === 0 ? (
	              <Card className="border-[#e4e1d8] bg-[#fffefa] shadow-sm">
	                <CardContent className="py-12 text-center text-[var(--warm-earth)]">
	                  {filter === 'saved'
	                    ? 'No saved recipes yet. Save a recipe from the content feed to find it here later.'
	                    : isStoriesPage || filter === 'story'
	                      ? 'No farm stories have been published yet.'
	                      : 'No recipes have been published yet.'}
	                </CardContent>
	              </Card>
	            ) : (
	              <div className="grid gap-4 md:grid-cols-2">
	                {visibleFeed.map((entry) => {
	                  const key = detailKey(entry.type, entry.id);
	                  const details = detailsByKey[key];
	                  const isRecipe = entry.type === 'recipe';
	                  const producerId = entry.producer ?? producerIdByName.get(entry.producer_name);

	                  return (
	                    <Card id={`content-entry-${entry.type}-${entry.id}`} key={key} className="border-[#e4e1d8] bg-[#fffefa] shadow-sm">
	                      <CardHeader>
	                        <div className="flex items-start justify-between gap-3">
	                          <div>
	                            <CardTitle className="text-lg text-[var(--rich-soil)]">{entry.title}</CardTitle>
	                            <p className="mt-1 text-sm text-[var(--warm-earth)]">
	                              By{' '}
	                              {producerId ? (
	                                <button
	                                  type="button"
	                                  className="inline-flex rounded-md text-left font-semibold text-[var(--forest-green)] underline-offset-4 transition-colors hover:text-[oklch(0.34_0.09_145)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
	                                  onClick={() =>
	                                    navigate(
	                                      isAdminReadOnly
	                                        ? `/admin/producer-preview/${producerId}?adminPreview=1&returnTo=${encodeURIComponent(adminScopedReturnTo)}`
	                                        : `/producers/${producerId}`,
	                                    )
	                                  }
	                                >
	                                  {entry.producer_name}
	                                </button>
	                              ) : (
	                                <span className="font-semibold text-[var(--forest-green)]">{entry.producer_name}</span>
	                              )}
	                            </p>
	                          </div>
	                          <div className="flex flex-wrap justify-end gap-2">
	                            {entry.is_ai_generated && (
	                              <Badge variant="outline" className="border-[#d6cab8] bg-[#fbfaf4] text-[var(--earth-accent)]">
	                                AI generated
	                              </Badge>
	                            )}
	                            <Badge variant={isRecipe ? 'secondary' : 'outline'}>
	                              {isRecipe ? 'Recipe' : 'Story'}
	                            </Badge>
	                          </div>
	                        </div>
	                      </CardHeader>
	                      <CardContent className="space-y-4">
	                        <p className="text-sm leading-6 text-[var(--warm-earth)]">{entry.description}</p>

	                        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
	                          <Leaf className="size-3" />
	                          {entry.seasonal_tag || 'All seasons'}
	                          <span>•</span>
	                          {format(new Date(entry.created_at), 'MMM d, yyyy')}
	                        </div>

	                        {(entry.linked_products ?? []).length > 0 && (
	                          <div className="flex flex-wrap gap-2">
	                            {(entry.linked_products ?? []).slice(0, 3).map((product) => (
	                              <Badge
	                                key={product.id}
	                                variant="outline"
	                                className="border-[#dcd3c2] bg-[#fbfaf4] text-[var(--forest-green)]"
	                              >
	                                {product.name}
	                              </Badge>
	                            ))}
	                            {(entry.linked_products ?? []).length > 3 && (
	                              <Badge variant="outline" className="border-[#dcd3c2] bg-[#fbfaf4]">
	                                +{(entry.linked_products ?? []).length - 3} more
	                              </Badge>
	                            )}
	                          </div>
	                        )}

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
	                          {!isAdminReadOnly && (
	                            <Button
	                              variant="ghost"
	                              size="sm"
	                              className="text-[#6a4f45] hover:bg-[#f3eee5] hover:text-[#4b382f]"
	                              disabled={activeReportKey === key}
	                              onClick={() => void reportContentEntry(entry)}
	                            >
	                              <Flag className="mr-2 size-4" />
	                              {activeReportKey === key ? 'Reporting...' : 'Report'}
	                            </Button>
	                          )}
	                          {isRecipe && isBuyer && (
	                            <Button
	                              size="sm"
	                              variant={savedRecipeIds.has(entry.id) ? 'default' : 'outline'}
	                              onClick={() => toggleSavedRecipe(entry.id)}
	                            >
	                              <Star className="mr-2 size-4" />
	                              {savedRecipeIds.has(entry.id) ? 'Saved' : 'Save Recipe'}
	                            </Button>
	                          )}
	                        </div>

	                        {detailLoadingKey === key && (
	                          <div className="space-y-3 rounded-2xl border border-[#e4e1d8] bg-[#fbfaf4] p-3">
	                            <Skeleton className="h-40 w-full" />
	                            <Skeleton className="h-4 w-3/4" />
	                            <Skeleton className="h-4 w-full" />
	                          </div>
	                        )}

	                        {details && (
	                          <div className="space-y-3 rounded-2xl border border-[#e4e1d8] bg-[#fbfaf4] p-4">
	                            {details.is_ai_generated && (
	                              <Badge variant="outline" className="border-[#d6cab8] bg-white text-[var(--earth-accent)]">
	                                AI generated
	                              </Badge>
	                            )}
	                            {details.image_url && (
	                              <img
	                                src={details.image_url}
	                                alt={details.title}
	                                className="h-48 w-full rounded-xl object-cover"
	                              />
	                            )}

	                            {'ingredients' in details ? (
	                              <>
	                                <div className="flex items-center gap-2 text-sm font-medium text-[var(--rich-soil)]">
	                                  <BookOpenText className="size-4" />
	                                  Ingredients
	                                </div>
	                                <p className="whitespace-pre-line text-sm leading-6 text-[var(--warm-earth)]">{details.ingredients}</p>
	                                <div className="mt-3 flex items-center gap-2 text-sm font-medium text-[var(--rich-soil)]">
	                                  <Newspaper className="size-4" />
	                                  Instructions
	                                </div>
	                                <p className="whitespace-pre-line text-sm leading-6 text-[var(--warm-earth)]">{details.instructions}</p>
	                                {details.linked_products.length > 0 && (
	                                  <div className="pt-2">
	                                    <p className="text-xs text-[var(--muted-foreground)]">Linked products</p>
	                                    <div className="mt-1 flex flex-wrap gap-2">
	                                      {details.linked_products.map((product) => (
	                                        <Button
	                                          key={product.id}
	                                          variant="outline"
	                                          size="sm"
	                                          onClick={() =>
	                                            navigate(
	                                              isAdminReadOnly
	                                                ? `/admin/product-preview/${product.id}?adminPreview=1&returnTo=${encodeURIComponent(adminScopedReturnTo)}`
	                                                : `/product/${product.id}`,
	                                            )
	                                          }
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
	                                <div className="flex items-center gap-2 text-sm font-medium text-[var(--rich-soil)]">
	                                  <Newspaper className="size-4" />
	                                  Story
	                                </div>
	                                <p className="whitespace-pre-line text-sm leading-6 text-[var(--warm-earth)]">{details.body}</p>
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
	          </section>
	        )}
      </main>
      <Dialog open={productPickerTarget !== null} onOpenChange={(open) => !open && setProductPickerTarget(null)}>
        <DialogContent className="max-h-[min(88vh,760px)] max-w-3xl overflow-hidden p-0">
          <DialogHeader className="border-b border-[#eee8dc] px-6 py-5">
            <DialogTitle>
              {productPickerTarget === 'recipe' ? 'Select Linked Products' : aiComposerCopy.pickerTitle}
            </DialogTitle>
            <DialogDescription>
              Choose from your full producer catalogue. The page will only show the products you select here.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[52vh] overflow-y-auto px-6 py-4">
            {producerProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d9d0c0] bg-[#fffefa] px-4 py-8 text-center text-sm text-gray-600">
                No producer products are available.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {producerProducts.map((product) => {
                  const checked = productPickerSelectedIds.includes(product.id);
                  return (
                    <label
                      key={product.id}
                      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#eee8dc] bg-[#fffefa] p-3 transition-colors hover:border-[var(--forest-green)]"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          if (!productPickerTarget) {
                            return;
                          }
                          setProductSelection(productPickerTarget, product.id, value === true);
                        }}
                        aria-label={`Select ${product.name}`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[var(--rich-soil)]">
                          {product.name}
                        </span>
                        <span className="mt-1 block text-xs text-gray-600">
                          {product.unit} • £{Number(product.price).toFixed(2)} • {Number(product.stock_quantity).toFixed(0)} available
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-[#eee8dc] px-6 py-4">
            <div className="mr-auto text-sm text-gray-600">
              {productPickerSelectedIds.length} selected
            </div>
            <Button type="button" onClick={() => setProductPickerTarget(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
