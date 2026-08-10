export function truncateMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = Math.floor((max - 1) / 2);
  const tail = max - 1 - head;
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
}
