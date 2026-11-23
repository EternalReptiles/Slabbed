import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { C, CARD_RATIO, FOIL } from './theme';
import { aud } from './money';
import { gradeRange, type Grade } from './ai';

export function Button({ title, onPress, kind = 'plain', disabled, busy, style }: {
  title: string; onPress: () => void; kind?: 'primary' | 'plain' | 'danger'; disabled?: boolean; busy?: boolean; style?: ViewStyle;
}) {
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [s.btn, primary && s.btnPrimary, (disabled || busy) && { opacity: 0.5 }, pressed && { opacity: 0.8 }, style]}
    >
      {busy ? <ActivityIndicator color={primary ? C.accentInk : C.accent} /> :
        <Text style={[s.btnText, primary && { color: C.accentInk }, kind === 'danger' && { color: C.bad }]}>{title}</Text>}
    </Pressable>
  );
}

export const Panel = ({ children, style }: { children: ReactNode; style?: ViewStyle }) => <View style={[s.panel, style]}>{children}</View>;
export const Eyebrow = ({ children }: { children: ReactNode }) => <Text style={s.eyebrow}>{children}</Text>;
export const Muted = ({ children, small }: { children: ReactNode; small?: boolean }) => <Text style={[s.muted, small && { fontSize: 13 }]}>{children}</Text>;
export const ErrorText = ({ children }: { children: ReactNode }) => <Text style={{ color: C.bad, fontSize: 14 }}>{children}</Text>;
export const Tag = ({ children, gold }: { children: ReactNode; gold?: boolean }) => (
  <View style={[s.tag, gold && { backgroundColor: C.gold, borderColor: C.gold }]}><Text style={[s.tagText, gold && { color: '#fff' }]}>{children}</Text></View>
);
export const Link = ({ title, url }: { title: string; url: string }) => (
  <Text style={s.link} onPress={() => Linking.openURL(url)} accessibilityRole="link">{title}</Text>
);

// Fixed width, or fills its column when no width is given.
export function CardImage({ uri, width }: { uri?: string | null; width?: number }) {
  return (
    <View style={[s.cardImg, width ? { width, height: width / CARD_RATIO } : { width: '100%', aspectRatio: CARD_RATIO }]}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
    </View>
  );
}

// Ungraded price on top, PSA 8 / 9 / 10 underneath.
export function Prices({ raw, rawLabel, graded, gradedLabel }: {
  raw: { low: number | null; mid: number | null; high: number | null } | null;
  rawLabel: string;
  graded: { psa8: number | null; psa9: number | null; psa10: number | null } | null;
  gradedLabel?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View style={[s.price, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 6 }]}>
        <View>
          <Eyebrow>Ungraded · near mint</Eyebrow>
          <Text style={[s.money, { fontSize: 26 }]}>{aud(raw?.mid)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {raw?.low != null || raw?.high != null ? <Text style={s.mono}>{aud(raw?.low)} – {aud(raw?.high)}</Text> : null}
          <Muted small>{rawLabel}</Muted>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['psa8', 'psa9', 'psa10'] as const).map(k => (
          <View key={k} style={[s.price, { flex: 1 }]}>
            <Eyebrow>{k.replace('psa', 'PSA ')}</Eyebrow>
            <Text style={s.money}>{aud(graded?.[k])}</Text>
          </View>
        ))}
      </View>
      {gradedLabel ? <Muted small>{gradedLabel}</Muted> : null}
    </View>
  );
}

function SubScore({ label, score, note, extra }: { label: string; score: number; note: string; extra?: string }) {
  const pct = Math.max(0, Math.min(10, score || 0)) * 10;
  return (
    <View style={{ gap: 4, flexBasis: '46%', flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '600', color: C.ink }}>{label}</Text>
        <Text style={[s.mono, { color: C.ink }]}>{score ? `${score}/10` : '–'}</Text>
      </View>
      <View style={s.bar}><View style={[s.barFill, { width: `${pct}%` }]} /></View>
      {extra ? <Text style={[s.mono, { fontSize: 12 }]}>{extra}</Text> : null}
      {note ? <Muted small>{note}</Muted> : null}
    </View>
  );
}

// Looks like a grading-company label: foil frame, big grade, four sub-scores.
export function GradeSlab({ g }: { g: Grade }) {
  return (
    <View style={s.slabOuter}>
      <View style={{ flexDirection: 'row', height: 4 }}>{FOIL.map(c => <View key={c} style={{ flex: 1, backgroundColor: c }} />)}</View>
      <View style={s.slab}>
        <View style={s.slabHead}>
          <View style={{ flex: 1 }}>
            <Eyebrow>Estimated PSA grade</Eyebrow>
            <Muted small>Most likely {g.most_likely} · photo {g.photo_quality}</Muted>
          </View>
          <Text style={s.gradeBig}>{gradeRange(g)}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          <SubScore label="Centering" score={g.centering?.score} note={g.centering?.note} extra={g.centering?.front} />
          <SubScore label="Corners" score={g.corners?.score} note={g.corners?.note} />
          <SubScore label="Edges" score={g.edges?.score} note={g.edges?.note} />
          <SubScore label="Surface" score={g.surface?.score} note={g.surface?.note} />
        </View>
        <Text style={{ fontWeight: '700', color: g.worth_grading ? C.good : C.warn }}>
          {g.worth_grading ? 'Worth grading' : 'Probably not worth grading'}
        </Text>
        {g.advice ? <Text style={{ color: C.ink }}>{g.advice}</Text> : null}
      </View>
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { padding: 16, gap: 16, paddingBottom: 40 },
  h1: { fontSize: 24, fontWeight: '800', color: C.ink },
  h2: { fontSize: 19, fontWeight: '800', color: C.ink },
  body: { fontSize: 15, color: C.ink },
  muted: { fontSize: 14, color: C.muted },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: C.muted },
  mono: { fontFamily: 'Menlo', fontSize: 13, color: C.muted, fontVariant: ['tabular-nums'] },
  money: { fontFamily: 'Menlo', fontWeight: '700', fontSize: 16, color: C.gold, fontVariant: ['tabular-nums'] },
  panel: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 16, gap: 14 },
  btn: { minHeight: 46, borderRadius: 11, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: C.accent, borderColor: C.accent },
  btnText: { fontSize: 15, fontWeight: '600', color: C.ink },
  tag: { borderWidth: 1, borderColor: C.line, backgroundColor: C.sunk, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  tagText: { fontSize: 12, fontWeight: '600', color: C.muted },
  link: { color: C.accent, fontWeight: '600', fontSize: 14 },
  cardImg: { borderRadius: 7, overflow: 'hidden', backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line },
  price: { backgroundColor: C.sunk, borderRadius: 10, padding: 10, gap: 2 },
  bar: { height: 6, backgroundColor: C.sunk, borderRadius: 99, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.accent, borderRadius: 99 },
  slabOuter: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  slab: { padding: 14, gap: 14 },
  slabHead: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 10 },
  gradeBig: { fontSize: 38, fontWeight: '800', color: C.ink, fontFamily: 'Menlo' },
  input: { minHeight: 46, borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: C.surface, paddingHorizontal: 12, fontSize: 15, color: C.ink },
});
