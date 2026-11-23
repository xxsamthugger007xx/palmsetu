import React from 'react';
import { Hash } from 'lucide-react-native';
import { ComingSoonScreen } from '../../components/ComingSoonScreen';
import { useTranslation } from 'react-i18next';

/**
 * Numerology (Moolaank / Bhagyank). Confirmed absent from both the server
 * and app codebases (grepped for "moolaank"/"numerology"/"bhagyank" with no
 * hits). Never computed client-side here - this is an honest placeholder
 * until a real backend calculation exists.
 */
export function NumerologyScreen() {
  const { t } = useTranslation();
  return (
    <ComingSoonScreen
      icon={Hash}
      title={t('ui.NumerologyScreen.numerology')}
      description={t('ui.NumerologyScreen.yourMoolaankBirthNumberAnd')}
      note="Numerology readings are planned but not built yet."
    />
  );
}
