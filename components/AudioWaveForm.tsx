import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface Props {
  isRecording: boolean;
  metering?: number;
}

const BAR_COUNT = 24;

export default function AudioWaveform({ isRecording, metering }: Props) {
  const bars = useRef<Animated.Value[]>(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(4))
  ).current;

  const animationsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    animationsRef.current.forEach((a) => a.stop());

    if (!isRecording) {
      bars.forEach((bar) =>
        Animated.spring(bar, {
          toValue: 4,
          useNativeDriver: false,
        }).start()
      );
      return;
    }

    const animations = bars.map((bar, i) => {
      const level = metering !== undefined ? Math.max(0, metering + 60) : 0;
      const baseHeight = (level / 60) * 40;
      const randomOffset = Math.random() * 20 - 10;
      const targetHeight = Math.max(4, Math.min(48, baseHeight + randomOffset));

      return Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: targetHeight,
            duration: 180 + i * 10,
            useNativeDriver: false,
          }),
          Animated.timing(bar, {
            toValue: Math.max(4, targetHeight * 0.4),
            duration: 180 + i * 10,
            useNativeDriver: false,
          }),
        ])
      );
    });

    animationsRef.current = animations;
    animations.forEach((a) => a.start());

    return () => animations.forEach((a) => a.stop());
  }, [isRecording, metering]);

  return (
    <View style={styles.container}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              height: bar,
              opacity: isRecording ? 1 : 0.3,
              backgroundColor: isRecording ? '#7F77DD' : '#B4B2A9',
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 56,
    paddingHorizontal: 8,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    minHeight: 4,
  },
});