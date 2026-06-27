export function resolveGroqApiKey(
  groqApiKey?: string | null,
): string | undefined {
  const groq = groqApiKey?.trim();
  if (groq?.startsWith('gsk_')) {
    return groq;
  }

  return undefined;
}

export function isInstructModel(model: string): boolean {
  const normalized = model.toLowerCase();
  return !normalized.includes('content-safety') && !normalized.includes('moderation');
}
