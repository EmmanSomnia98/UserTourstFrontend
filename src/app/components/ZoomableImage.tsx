import { useState } from 'react';
import { Dialog, DialogContent } from '@/app/components/ui/dialog';
import { cn } from '@/app/components/ui/utils';

interface ZoomableImageProps {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  modalImageClassName?: string;
}

export function ZoomableImage({
  src,
  alt,
  className,
  imageClassName,
  modalImageClassName,
}: ZoomableImageProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
        className={cn('block w-full cursor-zoom-in overflow-hidden text-left', className)}
        aria-label={`Zoom image: ${alt}`}
      >
        <img src={src} alt={alt} className={imageClassName} />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] border-0 bg-transparent p-0 shadow-none sm:max-w-5xl">
          <img
            src={src}
            alt={alt}
            className={cn(
              'max-h-[calc(100dvh-5rem)] w-full rounded-lg object-contain',
              modalImageClassName
            )}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
