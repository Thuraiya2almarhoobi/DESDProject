import type { LucideIcon } from 'lucide-react';

import { cn } from './ui/utils';

type MarketingImageCardProps = {
  image: string;
  alt: string;
  label: string;
  title: string;
  body: string;
  icon: LucideIcon;
  className?: string;
  imagePosition?: string;
  minHeightClassName?: string;
  bodyClassName?: string;
};

export function MarketingImageCard({
  image,
  alt,
  label,
  title,
  body,
  icon: Icon,
  className,
  imagePosition = 'object-center',
  minHeightClassName = 'min-h-[20rem]',
  bodyClassName,
}: MarketingImageCardProps) {
  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-[1.35rem] border border-white/20 bg-[oklch(0.21_0.028_124)] shadow-[0_18px_38px_rgba(18,28,20,0.12)]',
        minHeightClassName,
        className,
      )}
    >
      <img src={image} alt={alt} className={cn('absolute inset-0 h-full w-full object-cover', imagePosition)} />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,31,20,0.24)_0%,rgba(15,31,20,0.48)_45%,rgba(15,31,20,0.88)_100%)]" />
      <div className="relative z-10 flex h-full flex-col justify-between p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full bg-white/14 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/92 backdrop-blur-sm">
            {label}
          </span>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[rgba(9,29,17,0.58)] text-white backdrop-blur-sm">
            <Icon className="size-4.5" />
          </span>
        </div>

        <div className="space-y-3">
          <h3 className="text-2xl font-semibold tracking-tight text-white">{title}</h3>
          <p className={cn('max-w-md text-sm leading-7 text-white/82', bodyClassName)}>{body}</p>
        </div>
      </div>
    </article>
  );
}
