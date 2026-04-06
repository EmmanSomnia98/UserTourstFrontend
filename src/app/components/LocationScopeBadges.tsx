import { Badge } from '@/app/components/ui/badge';

type LocationScope = 'IN_BULUSAN' | 'NEAR_BULUSAN' | 'SORSOGON' | undefined;

interface LocationScopeBadgesProps {
  locationScope?: LocationScope;
  className?: string;
}

export function LocationScopeBadges({ locationScope, className }: LocationScopeBadgesProps) {
  const showBadges =
    locationScope === 'NEAR_BULUSAN' || locationScope === 'SORSOGON';

  if (!showBadges) return null;

  return (
    <div className={`inline-flex flex-wrap items-center gap-1 ${className ?? ''}`}>
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
      >
        [Outside Bulusan]
      </Badge>
      <Badge
        variant="outline"
        className="border-sky-200 bg-sky-50 text-[10px] font-semibold uppercase tracking-wide text-sky-800"
      >
        [Nearest Match]
      </Badge>
    </div>
  );
}
