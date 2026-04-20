const toTitleCase = (value: string): string =>
  value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const formatInterestLabel = (value: string): string => {
  const normalized = value.trim().replace(/[_-]+/g, ' ');
  if (!normalized) return '';
  return toTitleCase(normalized);
};

export const formatInterestList = (values?: string[]): string[] => {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const formatted: string[] = [];

  values.forEach((rawValue) => {
    const label = formatInterestLabel(rawValue);
    if (!label) return;
    const dedupeKey = label.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    formatted.push(label);
  });

  return formatted;
};
