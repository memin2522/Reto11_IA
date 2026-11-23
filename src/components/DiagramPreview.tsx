// Vista previa del diagrama dentro de la conversación; al tocarla se abre a pantalla completa.
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { MermaidView } from './MermaidView';

export function DiagramPreview({ source }: { source: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.caption, { color: theme.muted }]}>Tu modelo</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Ver el diagrama de tu modelo en pantalla completa"
      >
        {/* La WebView no recibe toques en la vista previa: el toque abre la pantalla completa */}
        <View pointerEvents="none">
          <MermaidView source={source} />
        </View>
        <Text style={[styles.hint, { color: theme.primary }]}>Toca para ampliar</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[styles.full, { backgroundColor: theme.background }]}>
          <View style={[styles.header, { borderColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">Tu modelo</Text>
            <Pressable
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar el diagrama"
              hitSlop={12}
            >
              <Text style={[styles.close, { color: theme.primary }]}>Cerrar</Text>
            </Pressable>
          </View>
          <Text style={[styles.zoomHint, { color: theme.muted }]}>Pellizca para hacer zoom y arrastra para moverte.</Text>
          <MermaidView source={source} full />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 10, marginTop: 6, alignSelf: 'stretch' },
  caption: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  hint: { fontSize: 13, textAlign: 'right', marginTop: 4 },
  full: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: '700' },
  close: { fontSize: 16, fontWeight: '600' },
  zoomHint: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 6 },
});
