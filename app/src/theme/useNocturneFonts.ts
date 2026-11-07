import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';

/**
 * Loads the Nocturne design system's Inter font weights. Returns `true` once
 * loaded (or once loading has failed/settled), so callers can render
 * immediately with the system font fallback and never block app startup on
 * a font that may fail to download.
 */
export function useNocturneFonts() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  return loaded || !!error;
}
