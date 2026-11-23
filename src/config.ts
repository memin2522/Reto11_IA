// Único lugar donde se leen las claves. Expo incrusta las variables EXPO_PUBLIC_* al compilar,
// por eso deben escribirse literalmente (process.env.EXPO_PUBLIC_X), sin acceso dinámico.
export type Provider = 'claude' | 'openai';

export const API_KEYS: Record<Provider, string> = {
  claude: (process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '').trim(),
  openai: (process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '').trim(),
};

export const PROVIDER_NAMES: Record<Provider, string> = {
  claude: 'Claude',
  openai: 'ChatGPT',
};

export function isAvailable(provider: Provider): boolean {
  return API_KEYS[provider].length > 0;
}
