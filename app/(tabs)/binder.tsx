import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { C } from '../../lib/theme';
import { Button, CardImage, Eyebrow, Muted, s } from '../../lib/ui';
import { aud } from '../../lib/money';
import { gradeRange } from '../../lib/ai';
import { unitValue, useBinder, type SyncState } from '../../lib/binder';

const SORTS = [
  { key: 'value', label: 'Value' },
  { key: 'recent', label: 'Newest' },
  { key: 'name', label: 'Name' },
  { key: 'set', label: 'Set' },
] as const;
type SortKey = (typeof SORTS)[number]['key'];

const SYNC_LABEL: Record<SyncState, string> = {
  device: 'Saved on this phone · sign in to back up',
  syncing: 'Syncing…',
  synced: 'Synced to your account',
  offline: 'Saved on this phone · will sync when online',
};

// The digital binder: a 3-pocket-wide page of your cards, with totals.
export default function Binder() {
  const { items, state } = useBinder();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('value');

  const count = items.reduce((n, i) => n + (i.qty || 1), 0);
  const total = items.reduce((n, i) => n + unitValue(i) * (i.qty || 1), 0);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const out = items.filter(i => !t || `${i.name} ${i.setName} ${i.number}`.toLowerCase().includes(t));
    const by: Record<SortKey, (a: typeof out[0], b: typeof out[0]) => number> = {
      value: (a, b) => unitValue(b) - unitValue(a),
      recent: (a, b) => b.addedAt - a.addedAt,
      name: (a, b) => a.name.localeCompare(b.name),
      set: (a, b) => a.setName.localeCompare(b.setName) || a.number.localeCompare(b.number, undefined, { numeric: true }),
    };
    return out.sort(by[sort]);
  }, [items, q, sort]);

  const header = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={[s.panel, { flex: 1, padding: 12, gap: 2 }]}><Eyebrow>Cards</Eyebrow><Text style={[s.money, { color: C.ink, fontSize: 20 }]}>{count}</Text></View>
        <View style={[s.panel, { flex: 2, padding: 12, gap: 2 }]}><Eyebrow>Binder value (raw)</Eyebrow><Text style={[s.money, { fontSize: 20 }]}>{aud(total)}</Text></View>
      </View>
      <Muted small>{SYNC_LABEL[state]}</Muted>
      {items.length ? (
        <>
          <TextInput value={q} onChangeText={setQ} placeholder="Search your binder" placeholderTextColor={C.muted} style={s.input} accessibilityLabel="Search your binder" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SORTS.map(o => (
              <Pressable key={o.key} onPress={() => setSort(o.key)} accessibilityRole="button" accessibilityState={{ selected: sort === o.key }}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: sort === o.key ? C.accent : C.line, backgroundColor: sort === o.key ? C.accent : C.surface }}>
                <Text style={{ color: sort === o.key ? C.accentInk : C.ink, fontWeight: '600', fontSize: 13 }}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={list}
      keyExtractor={i => i.id}
      numColumns={3}
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      columnWrapperStyle={{ gap: 10, marginBottom: 12 }}
      ListEmptyComponent={items.length ? <Muted>No cards match “{q}”.</Muted> : (
        <View style={[s.panel, { alignItems: 'center' }]}>
          <Text style={s.h2}>Your binder is empty</Text>
          <Muted>Scan a card or find one in Search, then tap Add to binder.</Muted>
          <Button title="Scan your first card" kind="primary" onPress={() => router.navigate('/')} />
        </View>
      )}
      renderItem={({ item }) => (
        <Pressable style={{ flex: 1 / 3, gap: 4 }} onPress={() => router.push(`/item/${item.id}`)} accessibilityLabel={`${item.name}, ${aud(unitValue(item))}`}>
          <View>
            <CardImage uri={item.image} />
            {(item.qty || 1) > 1 ? <Text style={{ position: 'absolute', top: 6, right: 6, backgroundColor: C.ink, color: C.bg, fontWeight: '700', fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' }}>×{item.qty}</Text> : null}
            {item.grade ? <Text style={{ position: 'absolute', left: 6, bottom: 6, backgroundColor: C.surface, color: C.ink, fontWeight: '700', fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' }}>PSA {gradeRange(item.grade)}</Text> : null}
            {!item.image ? <Text style={{ position: 'absolute', top: 8, left: 8, right: 8, color: C.muted, fontSize: 12 }}>{item.name}</Text> : null}
          </View>
          <Text numberOfLines={2} style={{ fontWeight: '600', color: C.ink, fontSize: 13 }}>{item.name}</Text>
          <Text style={[s.money, { fontSize: 13 }]}>{aud(unitValue(item))}</Text>
        </Pressable>
      )}
    />
  );
}
