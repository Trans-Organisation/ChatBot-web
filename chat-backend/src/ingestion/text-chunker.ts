export function splitTextIntoChunks(
  text: string,
  maxChunkSize = 1500,
  overlap = 200,
): string[] {
  if (maxChunkSize <= overlap) {
    throw new Error('maxChunkSize doit être supérieur à overlap.');
  }

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  const addSentence = (sentence: string) => {
    if (!sentence) return;
    if (`${current ? `${current} ` : ''}${sentence}`.length <= maxChunkSize) {
      current += `${current ? ' ' : ''}${sentence}`;
      return;
    }

    if (current) chunks.push(current.trim());
    const previousOverlap = current.slice(-overlap).trim();
    current = `${previousOverlap}${previousOverlap ? ' ' : ''}${sentence}`;
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChunkSize) {
      const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
      if (candidate.length <= maxChunkSize) {
        current = candidate;
      } else {
        if (current) chunks.push(current.trim());
        current = `${current.slice(-overlap).trim()}${current ? '\n\n' : ''}${paragraph}`;
      }
      continue;
    }

    for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
      if (sentence.length <= maxChunkSize) {
        addSentence(sentence.trim());
        continue;
      }

      for (let offset = 0; offset < sentence.length; offset += maxChunkSize - overlap) {
        const part = sentence.slice(offset, offset + maxChunkSize).trim();
        if (part) {
          if (current) chunks.push(current.trim());
          current = part;
        }
      }
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
