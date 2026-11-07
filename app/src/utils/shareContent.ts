import { Share } from 'react-native';

/** Shared native-Share helper used by the affirmation and inspiration browse
 * screens, so the Share.share() call pattern and its silent-cancel handling
 * live in exactly one place. Uses React Native's built-in Share API - no new
 * dependency needed. */
export async function shareText(message: string) {
  try {
    await Share.share({ message });
  } catch {
    // User cancelling the share sheet, or a platform share failure, is not
    // an app error - nothing to surface.
  }
}
