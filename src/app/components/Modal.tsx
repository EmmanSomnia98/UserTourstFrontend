import { type ReactNode, useEffect } from 'react';
import { motion } from 'motion/react';

import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';

export type ModalAction = {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  className?: string;
};

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  content: ReactNode;
  actions?: ModalAction[];
};

export function Modal({ open, onClose, title, description, content, actions = [] }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="w-[95vw] max-w-3xl overflow-hidden border border-slate-200 p-0 sm:w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="max-h-[85vh] overflow-y-auto"
        >
          <div className="border-b border-slate-100 px-6 pb-4 pt-6">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl text-slate-900">{title}</DialogTitle>
              {description ? <DialogDescription className="text-sm text-slate-600">{description}</DialogDescription> : null}
            </DialogHeader>
          </div>

          <div className="space-y-5 px-6 py-5">{content}</div>

          {actions.length > 0 ? (
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
              {actions.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant={action.variant ?? 'default'}
                  className={action.className}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
