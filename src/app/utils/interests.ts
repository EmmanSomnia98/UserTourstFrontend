const toTitleCase = (value: string): string =>
  value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const getCanonicalInterestKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, '');

export const formatInterestLabel = (value: string): string => {
  const normalized = value.trim().replace(/[_-]+/g, ' ');
  if (!normalized) return '';
  return toTitleCase(normalized);
};

const scoreInterestLabelReadability = (value: string): number => {
  const trimmed = value.trim();
  if (!trimmed) return -1;
  let score = 0;
  if (/\s/.test(trimmed)) score += 2;
  if (/_|-/.test(trimmed)) score += 1;
  if (/[A-Z]/.test(trimmed)) score += 1;
  return score;
};

export const formatInterestList = (values?: string[]): string[] => {
  if (!Array.isArray(values)) return [];
  const entries = new Map<string, { label: string; score: number }>();

  values.forEach((rawValue) => {
    const canonicalKey = getCanonicalInterestKey(rawValue);
    if (!canonicalKey) return;
    const label = formatInterestLabel(rawValue);
    if (!label) return;
    const score = scoreInterestLabelReadability(rawValue);
    const existing = entries.get(canonicalKey);
    if (!existing || score > existing.score) {
      entries.set(canonicalKey, { label, score });
    }
  });

  return Array.from(entries.values()).map((entry) => entry.label);
};
