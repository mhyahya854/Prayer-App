import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';

import type { ManualLocationInput } from '@/src/prayer/prayer-provider';
import { useAppPalette } from '@/src/theme/palette';

interface ManualLocationFormProps {
  helperText?: string;
  initialValues?: {
    label?: string;
    latitude?: string;
    longitude?: string;
    timeZoneOverride?: string;
  };
  isSubmitting?: boolean;
  onSubmit: (input: ManualLocationInput) => Promise<void>;
  submitLabel: string;
}

function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function ManualLocationForm({
  helperText,
  initialValues,
  isSubmitting = false,
  onSubmit,
  submitLabel,
}: ManualLocationFormProps) {
  const palette = useAppPalette();
  const [label, setLabel] = useState(initialValues?.label ?? '');
  const [latitude, setLatitude] = useState(initialValues?.latitude ?? '');
  const [longitude, setLongitude] = useState(initialValues?.longitude ?? '');
  const [timeZoneOverride, setTimeZoneOverride] = useState(initialValues?.timeZoneOverride ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setLabel(initialValues?.label ?? '');
    setLatitude(initialValues?.latitude ?? '');
    setLongitude(initialValues?.longitude ?? '');
    setTimeZoneOverride(initialValues?.timeZoneOverride ?? '');
  }, [initialValues?.label, initialValues?.latitude, initialValues?.longitude, initialValues?.timeZoneOverride]);

  async function handleSubmit() {
    setValidationError(null);

    const parsedLatitude = Number(latitude.trim());
    const parsedLongitude = Number(longitude.trim());

    if (!isValidLatitude(parsedLatitude)) {
      setValidationError('Latitude must be a number between -90 and 90.');
      return;
    }

    if (!isValidLongitude(parsedLongitude)) {
      setValidationError('Longitude must be a number between -180 and 180.');
      return;
    }

    await onSubmit({
      label,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      timeZoneOverride: timeZoneOverride.trim() || undefined,
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: palette.subtleText }]}>Label</Text>
        <TextInput
          accessibilityLabel="Manual location label"
          autoCapitalize="words"
          onChangeText={setLabel}
          placeholder="Kuala Lumpur home"
          placeholderTextColor={palette.subtleText}
          style={[
            styles.input,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              color: palette.text,
            },
          ]}
          value={label}
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, styles.rowItem]}>
          <Text style={[styles.label, { color: palette.subtleText }]}>Latitude</Text>
          <TextInput
            accessibilityLabel="Manual location latitude"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            onChangeText={setLatitude}
            placeholder="3.139"
            placeholderTextColor={palette.subtleText}
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            value={latitude}
          />
        </View>

        <View style={[styles.inputGroup, styles.rowItem]}>
          <Text style={[styles.label, { color: palette.subtleText }]}>Longitude</Text>
          <TextInput
            accessibilityLabel="Manual location longitude"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            onChangeText={setLongitude}
            placeholder="101.687"
            placeholderTextColor={palette.subtleText}
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            value={longitude}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: palette.subtleText }]}>Timezone override</Text>
        <TextInput
          accessibilityLabel="Manual timezone override"
          autoCapitalize="none"
          onChangeText={setTimeZoneOverride}
          placeholder="Optional, e.g. Asia/Kuala_Lumpur"
          placeholderTextColor={palette.subtleText}
          style={[
            styles.input,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              color: palette.text,
            },
          ]}
          value={timeZoneOverride}
        />
      </View>

      {helperText ? (
        <Text style={[styles.helperText, { color: palette.subtleText }]}>{helperText}</Text>
      ) : null}
      {validationError ? <Text style={[styles.errorText, { color: palette.text }]}>{validationError}</Text> : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => void handleSubmit()}
        style={[styles.submitButton, { backgroundColor: palette.accent }]}
      >
        <Text style={[styles.submitButtonLabel, { color: palette.surface }]}>
          {isSubmitting ? 'Saving location...' : submitLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  inputGroup: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowItem: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  submitButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
