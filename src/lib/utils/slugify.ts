export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function slugifyWithSuffix(text: string, suffix: number): string {
  return `${slugify(text)}-${suffix}`;
}
