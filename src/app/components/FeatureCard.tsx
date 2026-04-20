import { type ReactNode } from 'react';
import { motion } from 'motion/react';

export type FeatureCardTone = 'blue' | 'emerald' | 'violet';

type FeatureCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  tone: FeatureCardTone;
  onClick: () => void;
};

const toneStyles: Record<FeatureCardTone, { border: string; iconBg: string }> = {
  blue: {
    border: 'hover:border-blue-200',
    iconBg: 'bg-blue-100 text-blue-600',
  },
  emerald: {
    border: 'hover:border-emerald-200',
    iconBg: 'bg-emerald-100 text-emerald-600',
  },
  violet: {
    border: 'hover:border-violet-200',
    iconBg: 'bg-violet-100 text-violet-600',
  },
};

export function FeatureCard({ title, description, icon, tone, onClick }: FeatureCardProps) {
  const styles = toneStyles[tone];

  return (
    <motion.button
      type="button"
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`group min-w-[85%] snap-start rounded-lg border border-white/70 bg-white p-6 text-left shadow-md transition-all duration-300 ease-out hover:shadow-xl sm:min-w-0 ${styles.border}`}
    >
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 ${styles.iconBg}`}>
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </motion.button>
  );
}
