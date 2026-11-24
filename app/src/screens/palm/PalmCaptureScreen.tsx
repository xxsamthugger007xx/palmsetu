import { tr } from '../../utils/tr';
import React, { useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  Camera, ImagePlus, X, ChevronLeft, AlertTriangle, Lock,
  Crop, ZoomIn, RotateCw, Gem, Check,
} from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { assessImageQuality } from '../../services/palmAnalysis';
import { CornerBrackets } from '../../components/CornerBrackets';
import { useTranslation } from 'react-i18next';

type Hand = 'left' | 'right';

const avoidExamples = [
  { id: 'incomplete', icon: Crop, label: 'Incomplete' },
  { id: 'tooClose', icon: ZoomIn, label: 'Too close' },
  { id: 'bending', icon: RotateCw, label: 'Bending' },
  { id: 'jewelry', icon: Gem, label: 'Jewellery' },
];

// AI-made example of a well-framed palm photo (flat, open, filling the frame, even light).
const GOOD_EXAMPLE_HAND = require('../../../assets/palm/good-example-hand.webp');

export function PalmCaptureScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PalmCapture'>>();
  const allowRescan = route.params?.allowRescan;
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);
  const [hand, setHand] = useState<Hand>('right');

  const handlePick = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(t('ui.PalmCaptureScreen.permissionNeeded'), `Please allow ${useCamera ? 'camera' : 'photo library'} access to continue.`);
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.9 });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];

    // Real speed fix: a modern phone photo at quality:0.9 with no resize can
    // be several MB, which then gets base64-encoded (~33% larger) and
    // uploaded, and a larger image also costs the vision model more time to
    // process - none of that size is actually needed for line-level palm
    // analysis. Resizing to a sane max dimension before upload cuts upload
    // time and vision-processing time together, with no loss of analysis
    // quality (palm lines are coarse, macro-scale features, not something
    // that needs 4000px resolution to assess).
    let optimizedUri = asset.uri;
    try {
      const resized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      optimizedUri = resized.uri;
    } catch {
      // If resizing fails for any reason, fall back to the original capture
      // rather than blocking the flow - slower upload beats a broken one.
    }

    setImageUri(optimizedUri);
    const quality = await assessImageQuality(asset);
    setQualityWarning(quality.ok ? null : quality.message);
  };

  const handleRemove = () => {
    setImageUri(null);
    setQualityWarning(null);
  };

  const handleContinue = () => {
    if (!imageUri) return;
    navigation.navigate('PalmAnalyzing', { imageUri, hand, allowRescan });
  };

  return (
    <PageContainer onRefresh={async () => {}}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">{t('ui.PalmCaptureScreen.capture')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>{t('ui.PalmCaptureScreen.analyzeYourPalm')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: 4, marginBottom: spacing.lg }}>
        {t('ui.PalmCaptureScreen.useNaturalLightHoldYour')}
      </Text>

      <View style={styles.handSelector}>
        {(['left', 'right'] as Hand[]).map((h) => (
          <Button
            key={h}
            label={h === 'left' ? 'Left hand' : 'Right hand'}
            variant={hand === h ? 'primary' : 'secondary'}
            size="sm"
            onPress={() => setHand(h)}
            style={{ flex: 1 }}
          />
        ))}
      </View>

      {imageUri ? (
        <View style={{ marginTop: spacing.md }}>
          <View style={styles.previewWrap}>
            <Image source={{ uri: imageUri }} accessibilityLabel={tr('a11y.palmPreview')} style={styles.preview} />
            <CornerBrackets />
            <View style={styles.removeBtn}>
              <IconButton icon={X} onPress={handleRemove} tone={color.textPrimary} />
            </View>
          </View>

          {qualityWarning && (
            <Card style={styles.warningCard}>
              <AlertTriangle size={16} color={color.warning} strokeWidth={1.75} />
              <Text variant="caption" tone="secondary" style={{ marginLeft: spacing.sm, flex: 1 }}>
                {qualityWarning}
              </Text>
            </Card>
          )}

          <View style={styles.row}>
            <Button label={t('ui.PalmCaptureScreen.retake')} variant="secondary" style={{ flex: 1 }} onPress={() => handlePick(true)} />
          </View>
          <Button
            label={t('ui.OnboardingAstrologySystemScreen.continue')}
            fullWidth
            disabled={!!qualityWarning}
            style={{ marginTop: spacing.sm }}
            onPress={handleContinue}
          />
        </View>
      ) : (
        <View style={{ marginTop: spacing.md }}>
          <Card style={styles.placeholder}>
            <CornerBrackets size={20} />
            <Camera size={24} color={color.textMuted} strokeWidth={1.5} />
            <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>{t('ui.PalmCaptureScreen.noPhotoYet')}</Text>
          </Card>
          <Button label={t('ui.PalmCaptureScreen.takePhoto')} icon={Camera} fullWidth style={{ marginTop: spacing.md }} onPress={() => handlePick(true)} />
          <Button label={t('ui.PalmCaptureScreen.uploadFromLibrary')} icon={ImagePlus} variant="secondary" fullWidth style={{ marginTop: spacing.sm }} onPress={() => handlePick(false)} />

          <View style={{ marginTop: spacing.xl }}>
            <Text variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>{t('ui.PalmCaptureScreen.photoGuidelines')}</Text>

            <Card elevated style={styles.goodExampleCard}>
              <Image source={GOOD_EXAMPLE_HAND} accessibilityLabel={t('ui.PalmCaptureScreen.goodExample')} style={{ width: 96, height: 96, borderRadius: radius.md }} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={styles.goodBadge}>
                  <Check size={12} color={color.bg} strokeWidth={2.5} />
                  <Text variant="caption" weight="semibold" tone="inverted" style={{ marginLeft: 4 }}>{t('ui.PalmCaptureScreen.goodExample')}</Text>
                </View>
                <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
                  {t('ui.PalmCaptureScreen.flatOpenPalmFillingThe')}
                </Text>
              </View>
            </Card>

            <Text variant="caption" tone="muted" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
              {t('ui.PalmCaptureScreen.avoidPhotosLikeTheseThey')}
            </Text>
            <View style={styles.avoidGrid}>
              {avoidExamples.map((ex) => (
                <View key={ex.id} style={styles.avoidItem}>
                  <View style={styles.avoidIconWrap}>
                    <ex.icon size={20} color={color.danger} strokeWidth={1.75} />
                    <View style={styles.avoidBadge}>
                      <X size={9} color={color.bg} strokeWidth={3} />
                    </View>
                  </View>
                  <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs, textAlign: 'center' }}>{ex.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      <Card style={styles.privacyCard}>
        <Lock size={14} color={color.textMuted} strokeWidth={1.75} />
        <Text variant="caption" tone="muted" style={{ marginLeft: spacing.sm, flex: 1 }}>
          {t('ui.PalmCaptureScreen.yourPhotoIsUploadedSecurely')}
        </Text>
      </Card>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  handSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  placeholder: {
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  previewWrap: {
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: 300,
    borderRadius: radius.lg,
    backgroundColor: color.surfaceElevated,
  },
  removeBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: color.overlay,
    borderRadius: radius.pill,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.lg,
  },
  goodExampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: color.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  avoidGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  avoidItem: {
    alignItems: 'center',
    flex: 1,
  },
  avoidIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: color.dangerMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avoidBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: color.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: color.bg,
  },
});
