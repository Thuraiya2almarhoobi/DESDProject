/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides the reusable ImageSourceField component used by pages or layout shells.
 *
 * Frontend context:
 *   Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useRef, useState } from 'react';
import { ImagePlus, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';

import { uploadImageFile } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface ImageSourceFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  uploadScope?: 'general' | 'products' | 'recipes' | 'stories';
  placeholder?: string;
  helpText?: string;
}

/**
 * ImageSourceField boundary.
 *
 * This exported unit supports the file role: Provides the reusable ImageSourceField component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function ImageSourceField({
  id,
  label,
  value,
  onChange,
  uploadScope = 'general',
  placeholder = 'https://...',
  helpText = 'Paste an image URL or upload an image from your computer.',
}: ImageSourceFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setUploading(true);
    try {
      const payload = await uploadImageFile(file, uploadScope);
      onChange(payload.url);
      toast.success('Image uploaded successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to upload image.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {uploading ? 'Uploading image...' : 'Upload from computer'}
        </Button>
        {value && <span className="text-xs text-gray-500">Image ready</span>}
      </div>
      <p className="text-xs text-gray-500">{helpText}</p>
      {value && (
        <div className="overflow-hidden rounded-lg border bg-gray-50 p-2">
          <img src={value} alt="Selected preview" className="h-40 w-full rounded-md object-cover" />
        </div>
      )}
    </div>
  );
}
