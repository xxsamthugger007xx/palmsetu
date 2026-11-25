import { Platform, Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

/**
 * Turns an off-screen <ShareCard> into a PNG and opens the phone's share sheet. If anything goes wrong (web, no sharing
 * available, capture failure) it falls back to sharing the plain text, so the Share button never does nothing.
 */
export async function shareCardImage(ref: React.RefObject<unknown>, fallbackText: string): Promise<void> {
  try {
    if (Platform.OS !== 'web' && ref.current && (await Sharing.isAvailableAsync())) {
      const uri = await captureRef(ref as React.RefObject<never>, { format: 'png', quality: 1, width: 1080, height: 1350, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Palm Setu' });
      return;
    }
  } catch {
    // fall through to text sharing
  }
  await Share.share({ message: fallbackText });
}
