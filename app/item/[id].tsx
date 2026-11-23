import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { C } from '../../lib/theme';
import { Button, CardImage, ErrorText, GradeSlab, Link, Muted, Panel, Prices, s } from '../../lib/ui';
import { getItem, remove, upsert, useBinder } from '../../lib/binder';
import { ebaySold, getCard, rawPriceAud, variantKey, variantLabel } from '../../lib/tcg';
import { estimateGraded } from '../../lib/ai';

const day = (ms?: number | null) => (ms ? new Date(ms).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// One card in your binder: prices, grade, copies, refresh and remove.
export default function Item() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useBinder(); // re-render when the binder changes
  const it = getItem(String(id));
  const [busy, setBusy] = useState<'price' | 'graded' | null>(null);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);

  if (!it || it.deleted) return <View style={s.screen}><Muted>This card isn't in your binder.</Muted></View>;
  const item = it;

  async function refresh() {
    setBusy('price'); setErr('');
    try {
      let raw = item.raw;
      if (item.cardId) raw = await rawPriceAud(await getCard(item.cardId), item.raw?.variant ?? variantKey(item.variant));
      const g = await estimateGraded({ name: item.name, set_name: item.setName, number: item.number, variant: item.variant, raw_mid_aud: raw?.mid ?? item.rawEstimate?.mid ?? null });
      await upsert({ ...item, raw, graded: { ...g.graded_aud, source: 'estimate', at: Date.now() }, pricedAt: Date.now() });
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not refresh prices.'); }
    finally { setBusy(null); }
  }

  const rawShown = item.raw ?? item.rawEstimate;
  const rawLabel = item.raw
    ? `Live ${item.raw.source}${item.raw.variant ? ' · ' + variantLabel(item.raw.variant) : ''}`
    : item.rawEstimate ? "Claude's estimate · no live price" : 'No price yet';

  return (
    <ScrollView contentContainerStyle={s.screen}>
      <Stack.Screen options={{ title: item.name }} />
      <View style={{ alignItems: 'center' }}><CardImage uri={item.image} width={200} /></View>
      <Panel>
        <View style={{ gap: 4 }}>
          <Text style={s.h1}>{item.name}</Text>
          <Text style={s.body}>{item.setName}</Text>
          <Muted small>{item.number}{item.rarity ? ` · ${item.rarity}` : ''}{item.variant ? ` · ${item.variant}` : ''}</Muted>
        </View>
        <Prices raw={rawShown} rawLabel={rawLabel} graded={item.graded} gradedLabel={item.graded ? "Graded prices are Claude's estimates" : undefined} />
        <Muted small>Priced {day(item.pricedAt)}{item.notes ? ` · ${item.notes}` : ''}</Muted>
        <Button title="Refresh prices" onPress={refresh} busy={busy === 'price'} />
        {err ? <ErrorText>{err}</ErrorText> : null}
        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          <Link title="eBay AU sold (raw)" url={ebaySold(`${item.name} ${item.number}`)} />
          <Link title="eBay AU sold (PSA 10)" url={ebaySold(`${item.name} ${item.number} PSA 10`)} />
          {item.cardId ? <Text style={s.link} onPress={() => router.push(`/card/${item.cardId}`)}>Card details</Text> : null}
        </View>
      </Panel>

      {item.grade ? <GradeSlab g={item.grade} /> : (
        <Panel><Muted>No grade check yet. Photograph this card on the Scan tab and tap Check PSA grade.</Muted></Panel>
      )}

      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Button title="−" onPress={() => upsert({ ...item, qty: Math.max(1, (item.qty || 1) - 1) })} style={{ width: 46 }} />
          <Text style={[s.money, { color: C.ink, fontSize: 18, minWidth: 28, textAlign: 'center' }]}>{item.qty || 1}</Text>
          <Button title="+" onPress={() => upsert({ ...item, qty: (item.qty || 1) + 1 })} style={{ width: 46 }} />
          <Muted>{(item.qty || 1) === 1 ? 'copy' : 'copies'}</Muted>
        </View>
        {confirm ? (
          <View style={{ gap: 10, borderWidth: 1, borderColor: C.bad, borderRadius: 12, padding: 12 }}>
            <Text style={s.body}>Remove {item.name} from your binder? This can't be undone.</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Remove card" kind="danger" onPress={async () => { await remove(item.id); router.back(); }} style={{ flex: 1 }} />
              <Button title="Keep it" onPress={() => setConfirm(false)} style={{ flex: 1 }} />
            </View>
          </View>
        ) : <Button title="Remove from binder" kind="danger" onPress={() => setConfirm(true)} />}
        <Muted small>Added {day(item.addedAt)}</Muted>
      </Panel>
    </ScrollView>
  );
}
