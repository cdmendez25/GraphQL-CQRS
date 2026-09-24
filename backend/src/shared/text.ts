/** Minúsculas y sin tildes: "Acetaminofén" → "acetaminofen". */
export const normalizeText = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const slugify = (value: string): string =>
  normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
