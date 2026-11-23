import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { C } from '../../lib/theme';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ color, fontSize: 20 }}>{glyph}</Text>;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.ink,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800' },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.line },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Scan', tabBarIcon: icon('◎') }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: icon('⌕') }} />
      <Tabs.Screen name="binder" options={{ title: 'Binder', tabBarIcon: icon('▦') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('◉') }} />
    </Tabs>
  );
}
