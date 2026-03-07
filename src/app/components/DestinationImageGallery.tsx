import { useEffect, useMemo, useState } from 'react';
import { Destination } from '@/app/types/destination';

interface DestinationImageGalleryProps {
  destination: Destination;
  className?: string;
}

export function DestinationImageGallery({ destination, className = '' }: DestinationImageGalleryProps) {
  const images = useMemo(() => {
    const candidates = [
      ...(Array.isArray(destination.images) ? destination.images : []),
      destination.image,
    ];
    const seen = new Set<string>();
    const normalized: string[] = [];
    candidates.forEach((candidate) => {
      if (typeof candidate !== 'string') return;
      const value = candidate.trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      normalized.push(value);
    });
    return normalized;
  }, [destination.image, destination.images]);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [destination.id, images.length]);

  const activeImage = images[activeIndex] ?? images[0] ?? '';

  if (!activeImage) {
    return (
      <div className={`w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 ${className}`}>
        No image available
      </div>
    );
  }

  return (
    <div className={className}>
      <img
        src={activeImage}
        alt={`${destination.name} image ${activeIndex + 1}`}
        className="w-full h-56 sm:h-72 object-cover rounded-lg"
      />
      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={`${destination.id}-gallery-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-14 w-20 flex-shrink-0 overflow-hidden rounded-md border transition ${
                index === activeIndex ? 'border-blue-500 ring-1 ring-blue-200' : 'border-slate-200'
              }`}
              aria-label={`View image ${index + 1}`}
            >
              <img src={image} alt={`${destination.name} thumbnail ${index + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
