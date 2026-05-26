export function formatRelativeDate(input: string | Date) {
  const value = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}
