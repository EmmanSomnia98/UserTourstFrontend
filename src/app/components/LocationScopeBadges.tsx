import { Badge } from '@/app/components/ui/badge';

type LocationScope =
  | 'IN_BULUSAN'
  | 'NEAR_BULUSAN'
  | 'SORSOGON'
  | 'BICOL_REGION'
  | 'OUTSIDE_BICOL'
  | undefined;

interface LocationScopeBadgesProps {
  locationScope?: LocationScope;
  hiddenScopes?: Array<Exclude<LocationScope, undefined>>;
  showNearestMatchBadge?: boolean;
  nearestMatchScopes?: Array<Exclude<LocationScope, undefined>>;
  className?: string;
}

export function LocationScopeBadges({
  locationScope,
  hiddenScopes = [],
  showNearestMatchBadge = false,
  nearestMatchScopes = ['NEAR_BULUSAN', 'SORSOGON', 'BICOL_REGION', 'OUTSIDE_BICOL'],
  className,
}: LocationScopeBadgesProps) {
  const config: Record<
    Exclude<LocationScope, undefined>,
    { label?: string; className: string }
  > = {
    IN_BULUSAN: { className: '' },
    NEAR_BULUSAN: {
      label: 'Near Bulusan',
      className: 'border-amber-200 bg-amber-50 text-[10px] font-semibold uppercase tracking-wide text-amber-800',
    },
    SORSOGON: {
      label: 'Around Sorsogon',
      className: 'border-sky-200 bg-sky-50 text-[10px] font-semibold uppercase tracking-wide text-sky-800',
    },
    BICOL_REGION: {
      label: 'Across Bicol',
      className: 'border-emerald-200 bg-emerald-50 text-[10px] font-semibold uppercase tracking-wide text-emerald-800',
    },
    OUTSIDE_BICOL: {
      label: 'Beyond Bicol',
      className: 'border-rose-200 bg-rose-50 text-[10px] font-semibold uppercase tracking-wide text-rose-800',
    },
  };

  if (!locationScope) return null;
  if (hiddenScopes.includes(locationScope)) return null;
  const badge = config[locationScope];
  if (!badge?.label) return null;
  const shouldShowNearestMatch =
    showNearestMatchBadge && nearestMatchScopes.includes(locationScope);

  return (
    <div className={`inline-flex flex-wrap items-center gap-1 ${className ?? ''}`}>
      <Badge variant="outline" className={badge.className}>
        [{badge.label}]
      </Badge>
      {shouldShowNearestMatch && (
        <Badge
          variant="outline"
          className="border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-700"
        >
          [Nearest Match]
        </Badge>
      )}
    </div>
  );
}
