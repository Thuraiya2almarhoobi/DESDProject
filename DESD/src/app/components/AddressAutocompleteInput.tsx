import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';

import { loadGoogleMapsJavaScriptApi } from '../lib/googleMaps';
import { Input } from './ui/input';

export interface AddressSelection {
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  formattedAddress: string;
}

interface AddressPrediction {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
}

interface AddressAutocompleteInputProps extends Omit<ComponentProps<typeof Input>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (selection: AddressSelection) => void;
}

function readAddressComponent(place: any, type: string, format: 'long_name' | 'short_name' = 'long_name'): string {
  const component = place?.address_components?.find((item: any) => Array.isArray(item?.types) && item.types.includes(type));
  return typeof component?.[format] === 'string' ? component[format] : '';
}

function canonicalizeAddressPart(value: string): string {
  const aliases: Record<string, string> = {
    street: 'st',
    st: 'st',
    road: 'rd',
    rd: 'rd',
    lane: 'ln',
    ln: 'ln',
    avenue: 'ave',
    ave: 'ave',
    boulevard: 'blvd',
    blvd: 'blvd',
    south: 's',
    s: 's',
    north: 'n',
    n: 'n',
    east: 'e',
    e: 'e',
    west: 'w',
    w: 'w',
    apartment: 'apt',
    apt: 'apt',
    flat: 'flat',
    suite: 'ste',
    ste: 'ste',
    building: 'bldg',
    bldg: 'bldg',
  };

  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => aliases[token] || token)
    .join(' ');
}

function uniqueAddressParts(parts: string[]): string[] {
  const seen = new Set<string>();
  return parts.filter((part) => {
    const normalized = part.trim();
    if (!normalized) {
      return false;
    }
    const key = canonicalizeAddressPart(normalized);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isEquivalentAddressPart(left: string, right: string): boolean {
  return canonicalizeAddressPart(left) === canonicalizeAddressPart(right);
}

function includesEquivalentPart(parts: string[], candidate: string): boolean {
  return parts.some((part) => isEquivalentAddressPart(part, candidate));
}

function extractUkPostcode(value: string): string {
  const match = value.match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i);
  if (!match) {
    return '';
  }
  return `${match[1].toUpperCase()} ${match[2].toUpperCase()}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function deriveCityFromFormattedAddress(formattedAddress: string, postcode: string): string {
  const segments = formattedAddress
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!segments.length) {
    return '';
  }

  const withoutCountry = segments.filter((segment) => !/^uk$/i.test(segment) && !/^united kingdom$/i.test(segment));
  const postcodeMatch = postcode || extractUkPostcode(formattedAddress);
  const localitySegment = withoutCountry.find((segment) => postcodeMatch && segment.toLowerCase().includes(postcodeMatch.toLowerCase()));
  if (!localitySegment) {
    return '';
  }

  return localitySegment.replace(postcodeMatch, '').trim();
}

function formattedAddressSegments(formattedAddress: string, city: string, postcode: string): string[] {
  if (!formattedAddress) {
    return [];
  }

  const segments = formattedAddress
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => !/^uk$/i.test(segment) && !/^united kingdom$/i.test(segment));

  const cityIndex = city
    ? segments.findIndex((segment) => canonicalizeAddressPart(segment).includes(canonicalizeAddressPart(city)))
    : -1;
  const postcodeIndex =
    cityIndex >= 0
      ? cityIndex
      : postcode
        ? segments.findIndex((segment) => canonicalizeAddressPart(segment).includes(canonicalizeAddressPart(postcode)))
        : -1;
  const cutoffIndex = cityIndex >= 0 ? cityIndex : postcodeIndex >= 0 ? postcodeIndex : segments.length;

  return uniqueAddressParts(
    segments.slice(0, cutoffIndex).map((segment) => {
      let cleaned = segment;
      if (postcode) {
        cleaned = cleaned.replace(new RegExp(escapeRegExp(postcode).replace(/\s+/g, '\\s+'), 'i'), '').trim();
      }
      if (city) {
        cleaned = cleaned.replace(new RegExp(escapeRegExp(city), 'i'), '').trim();
      }
      return cleaned.replace(/\s{2,}/g, ' ').replace(/^,+|,+$/g, '').trim();
    }),
  );
}

function selectionFromPlace(place: any): AddressSelection | null {
  const placeName = typeof place?.name === 'string' ? place.name.trim() : '';
  const streetNumber = readAddressComponent(place, 'street_number');
  const route = readAddressComponent(place, 'route');
  const subpremise = readAddressComponent(place, 'subpremise');
  const premise = readAddressComponent(place, 'premise');
  const establishment = readAddressComponent(place, 'establishment');
  const neighborhood = readAddressComponent(place, 'neighborhood');
  const formattedAddress = typeof place?.formatted_address === 'string' ? place.formatted_address.trim() : '';
  const postcode = readAddressComponent(place, 'postal_code');
  const postcodeSuffix = readAddressComponent(place, 'postal_code_suffix');
  const normalizedPostcode =
    [postcode, postcodeSuffix].filter(Boolean).join(' ').trim() || extractUkPostcode(formattedAddress);
  const locality =
    readAddressComponent(place, 'postal_town') ||
    readAddressComponent(place, 'locality') ||
    readAddressComponent(place, 'administrative_area_level_2') ||
    deriveCityFromFormattedAddress(formattedAddress, normalizedPostcode);
  const sublocality =
    readAddressComponent(place, 'sublocality_level_1') ||
    readAddressComponent(place, 'sublocality') ||
    readAddressComponent(place, 'administrative_area_level_3');
  const streetLine = [streetNumber, route].filter(Boolean).join(' ').trim();
  const venueParts = uniqueAddressParts([placeName, premise, establishment]);
  const formattedParts = formattedAddressSegments(formattedAddress, locality, normalizedPostcode);
  const line1Parts = uniqueAddressParts([...venueParts, streetLine]).filter(Boolean);
  const fallbackLine1Parts = formattedParts.slice(0, Math.min(2, formattedParts.length));
  const line1 = (line1Parts.length ? line1Parts : fallbackLine1Parts).join(', ') || formattedParts[0] || '';

  const line1SourceParts = line1Parts.length ? line1Parts : fallbackLine1Parts;
  const line2 = uniqueAddressParts([
    subpremise,
    ...formattedParts.filter((part) => !includesEquivalentPart(line1SourceParts, part)),
    sublocality,
    neighborhood,
  ])
    .filter((part) => !isEquivalentAddressPart(part, locality))
    .join(', ');

  return {
    line1,
    line2,
    city: locality,
    postcode: normalizedPostcode,
    formattedAddress: formattedAddress || line1,
  };
}

export function AddressAutocompleteInput({
  value,
  onChange,
  onAddressSelect,
  className,
  ...props
}: AddressAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const mapsRef = useRef<any>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const suppressPredictionRef = useRef(false);
  const selectedValueRef = useRef('');

  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    let cancelled = false;

    const initializeServices = async () => {
      const maps = await loadGoogleMapsJavaScriptApi().catch(() => null);
      if (cancelled || !maps?.places) {
        return;
      }
      mapsRef.current = maps;
      autocompleteServiceRef.current = new maps.places.AutocompleteService();
      placesServiceRef.current = new maps.places.PlacesService(document.createElement('div'));
      sessionTokenRef.current = new maps.places.AutocompleteSessionToken();
    };

    void initializeServices();

    return () => {
      cancelled = true;
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (suppressPredictionRef.current) {
      suppressPredictionRef.current = false;
      setPredictions([]);
      setIsOpen(false);
      setIsLoading(false);
      setActiveIndex(-1);
      return;
    }

    const query = value.trim();
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    if (!query || query.length < 2 || !autocompleteServiceRef.current) {
      setPredictions([]);
      setIsOpen(false);
      setIsLoading(false);
      setActiveIndex(-1);
      return;
    }

    debounceTimerRef.current = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await autocompleteServiceRef.current.getPlacePredictions({
          input: query,
          componentRestrictions: { country: 'gb' },
          sessionToken: sessionTokenRef.current,
        });

        const nextPredictions: AddressPrediction[] = (response?.predictions || []).slice(0, 6).map((prediction: any) => ({
          placeId: prediction.place_id,
          primaryText:
            prediction.structured_formatting?.main_text ||
            prediction.description?.split(',')[0] ||
            prediction.description ||
            '',
          secondaryText:
            prediction.structured_formatting?.secondary_text ||
            prediction.description?.split(',').slice(1).join(',').trim() ||
            '',
          fullText: prediction.description || '',
        }));

        setPredictions(nextPredictions);
        setIsOpen(nextPredictions.length > 0);
        setActiveIndex(nextPredictions.length > 0 ? 0 : -1);
      } catch {
        setPredictions([]);
        setIsOpen(false);
        setActiveIndex(-1);
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value]);

  const selectPrediction = (prediction: AddressPrediction) => {
    if (!placesServiceRef.current) {
      onChange(prediction.fullText);
      setIsOpen(false);
      return;
    }

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.placeId,
        fields: ['address_components', 'formatted_address', 'name'],
        sessionToken: sessionTokenRef.current,
      },
      (place: any, status: any) => {
        const okStatus = mapsRef.current?.places?.PlacesServiceStatus?.OK;
        const selection = okStatus && status === okStatus ? selectionFromPlace(place) : null;
        const nextValue = selection?.formattedAddress || prediction.fullText;
        selectedValueRef.current = nextValue;
        suppressPredictionRef.current = true;
        if (selection) {
          onChange(nextValue);
          onAddressSelect?.(selection);
        } else {
          onChange(nextValue);
        }

        if (mapsRef.current?.places?.AutocompleteSessionToken) {
          sessionTokenRef.current = new mapsRef.current.places.AutocompleteSessionToken();
        }
        setPredictions([]);
        setIsOpen(false);
        setActiveIndex(-1);
      },
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || predictions.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % predictions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? predictions.length - 1 : current - 1));
      return;
    }

    if (event.key === 'Enter') {
      if (activeIndex >= 0 && predictions[activeIndex]) {
        event.preventDefault();
        selectPrediction(predictions[activeIndex]);
      }
      return;
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (selectedValueRef.current && nextValue.trim() !== selectedValueRef.current.trim()) {
            selectedValueRef.current = '';
          }
          suppressPredictionRef.current = false;
          onChange(nextValue);
          setIsOpen(Boolean(nextValue.trim()));
        }}
        onFocus={() => {
          if (predictions.length > 0) {
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        className={className}
        {...props}
      />
      {isLoading ? (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--forest-green)]">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : null}
      {isOpen && predictions.length > 0 ? (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-[#d8d0c0] bg-[#fffefa] p-1.5 shadow-lg">
          {predictions.map((prediction, index) => (
            <button
              key={prediction.placeId}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectPrediction(prediction)}
              className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                index === activeIndex ? 'bg-[color-mix(in_srgb,var(--forest-green)_10%,white)]' : 'hover:bg-[#f5f0e8]'
              }`}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--forest-green)]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--rich-soil)]">{prediction.primaryText}</p>
                {prediction.secondaryText ? (
                  <p className="mt-0.5 text-xs text-[var(--warm-earth)]">{prediction.secondaryText}</p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
