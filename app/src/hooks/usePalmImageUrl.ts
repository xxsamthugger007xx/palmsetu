import { useEffect, useState } from 'react';
import { palmApi } from '../services/palmApi';

/** Fetches a short-lived signed URL for a stored palm photo. Returns null while loading or if it can't be minted. */
export function usePalmImageUrl(readingId: string | undefined, enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (readingId && enabled) {
      palmApi.getImageUrl(readingId).then((u) => active && setUrl(u)).catch(() => active && setUrl(null));
    }
    return () => { active = false; };
  }, [readingId, enabled]);
  return url;
}
