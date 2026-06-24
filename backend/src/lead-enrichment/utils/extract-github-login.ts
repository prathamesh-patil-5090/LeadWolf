export function extractGithubLogin(url?: string | null): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'github.com') {
      return undefined;
    }

    const [login] = parsed.pathname.split('/').filter(Boolean);
    return login;
  } catch {
    return undefined;
  }
}
