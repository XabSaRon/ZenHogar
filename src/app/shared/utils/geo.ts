const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';

export function detectCountryByNavigator(): string | null {
  if (!isBrowser) return null;
  const langs = (navigator.languages?.length ? navigator.languages : [navigator.language]).filter(Boolean) as string[];
  for (const lang of langs) {
    const m = /^([a-z]{2,3})[-_](\w{2})/i.exec(lang);
    if (m) return m[2].toUpperCase();
  }
  return null;
}

