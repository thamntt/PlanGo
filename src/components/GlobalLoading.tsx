import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Modal, useColorScheme } from 'react-native';
import { subscribeToLoading } from '@/lib/api/query-client';
import Colors from '@/constants/colors';

const GlobalLoading: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  useEffect(() => {
    // Subscribe to global loading state from API client
    const unsubscribe = subscribeToLoading((loading) => {
      setIsLoading(loading);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  if (!isLoading) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={isLoading}
      onRequestClose={() => {}}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.text, { color: colors.text }]}>Đang tải...</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  text: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 8,
  },
});

export default GlobalLoading;
