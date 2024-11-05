export function parseMultipleJsonObjects<T>(text: string): Array<{
  events: T[];
}> {
  const results = [];
  let startIndex = 0;

  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === '}' && text[i + 1] === '{') {
      try {
        const chunk = text.substring(startIndex, i + 1);

        JSON.parse(chunk);
        results.push(JSON.parse(chunk));
        startIndex = i + 1;
      } catch {
        continue;
      }
    }
  }

  if (startIndex < text.length) {
    const lastChunk = text.substring(startIndex);
    results.push(JSON.parse(lastChunk));
  }

  return results;
}
