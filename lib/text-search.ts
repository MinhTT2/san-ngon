export function normalizeSearch(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

export function matchesSearch(text: string, query: string) {
  const normalized = normalizeSearch(text);
  return normalizeSearch(query.trim()).split(/\s+/).filter(Boolean).every(word => normalized.includes(word));
}
