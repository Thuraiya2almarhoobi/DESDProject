import { useEffect, useMemo, useRef, useState } from 'react';

import { AddressAutocompleteInput, type AddressSelection } from './AddressAutocompleteInput';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface AddressLookupFieldsProps {
  idPrefix: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  onChange: (field: 'line1' | 'line2' | 'city' | 'postcode', value: string) => void;
  required?: boolean;
  hideCity?: boolean;
  lookupLabel?: string;
}

export function formatAddressLines(line1: string, line2: string): string {
  return [line1, line2]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(', ');
}

function formatLookupDisplay(line1: string, line2: string, city: string, postcode: string): string {
  return [line1, line2, city, postcode]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(', ');
}

export function AddressLookupFields({
  idPrefix,
  line1,
  line2,
  city,
  postcode,
  onChange,
  required = false,
  hideCity = false,
  lookupLabel = 'Find address or postcode',
}: AddressLookupFieldsProps) {
  const derivedLookupValue = useMemo(() => formatLookupDisplay(line1, line2, city, postcode), [city, line1, line2, postcode]);
  const [lookupQuery, setLookupQuery] = useState(derivedLookupValue);
  const syncFromAddressRef = useRef(true);

  useEffect(() => {
    if (syncFromAddressRef.current) {
      setLookupQuery(derivedLookupValue);
    }
  }, [derivedLookupValue]);

  const applySelection = (selection: AddressSelection) => {
    syncFromAddressRef.current = false;
    onChange('line1', selection.line1 || '');
    onChange('line2', selection.line2 || '');
    onChange('city', selection.city || '');
    onChange('postcode', selection.postcode || '');
    setLookupQuery(selection.formattedAddress || formatLookupDisplay(selection.line1, selection.line2, selection.city, selection.postcode));
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor={`${idPrefix}-lookup`}>{lookupLabel}</Label>
        <AddressAutocompleteInput
          id={`${idPrefix}-lookup`}
          value={lookupQuery}
          onChange={(nextValue) => {
            syncFromAddressRef.current = false;
            setLookupQuery(nextValue);
          }}
          onAddressSelect={applySelection}
          placeholder="Search by street, area, or postcode"
          required={required && !line1.trim()}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${idPrefix}-line1`}>Address Line 1</Label>
        <Input
          id={`${idPrefix}-line1`}
          value={line1}
          onChange={(event) => {
            syncFromAddressRef.current = false;
            setLookupQuery('');
            onChange('line1', event.target.value);
          }}
          required={required}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${idPrefix}-line2`}>Address Line 2 (Optional)</Label>
        <Input
          id={`${idPrefix}-line2`}
          value={line2}
          onChange={(event) => {
            syncFromAddressRef.current = false;
            setLookupQuery('');
            onChange('line2', event.target.value);
          }}
        />
      </div>
      {!hideCity ? (
        <div>
          <Label htmlFor={`${idPrefix}-city`}>City</Label>
          <Input
            id={`${idPrefix}-city`}
            value={city}
            onChange={(event) => {
              syncFromAddressRef.current = false;
              setLookupQuery('');
              onChange('city', event.target.value);
            }}
          />
        </div>
      ) : null}
      <div className={hideCity ? 'sm:col-span-2' : ''}>
        <Label htmlFor={`${idPrefix}-postcode`}>Postcode</Label>
        <Input
          id={`${idPrefix}-postcode`}
          value={postcode}
          onChange={(event) => {
            syncFromAddressRef.current = false;
            setLookupQuery(event.target.value);
            onChange('postcode', event.target.value);
          }}
          required={required}
        />
      </div>
    </div>
  );
}
