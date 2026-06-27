export function resolveXaiApiKey(
  xaiApiKey?: string | null,
): string | undefined {
  const key = xaiApiKey?.trim();
  if (!key?.startsWith('xai-')) {
    return undefined;
  }

  return key;
}

export function resolveGroqApiKey(
  groqApiKey?: string | null,
  xaiApiKey?: string | null,
): string | undefined {
  const groq = groqApiKey?.trim();
  if (groq?.startsWith('gsk_')) {
    return groq;
  }

  const xai = xaiApiKey?.trim();
  if (xai?.startsWith('gsk_')) {
    return xai;
  }

  return undefined;
}

export function isInstructModel(model: string): boolean {
  const normalized = model.toLowerCase();
  return !normalized.includes('content-safety') && !normalized.includes('moderation');
}
