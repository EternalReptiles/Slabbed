import { Image, Text, View } from 'react-native';
import { C } from './theme';

const logo = require('../assets/logo.png');

// Logo + wordmark, used in the Scan screen's header and on the Account screen.
export function Brand({ size = 30, tagline }: { size?: number; tagline?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="header" accessibilityLabel="Slabbed">
      <Image source={logo} style={{ width: size, height: size, borderRadius: size * 0.22 }} />
      <View>
        <Text style={{ fontSize: size * 0.72, fontWeight: '900', color: C.ink, letterSpacing: -0.5 }}>Slabbed</Text>
        {tagline ? <Text style={{ fontSize: 13, color: C.muted }}>Scan, value and grade your cards</Text> : null}
      </View>
    </View>
  );
}
