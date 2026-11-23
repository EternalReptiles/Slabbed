import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { C } from '../../lib/theme';
import { Button, CardImage, ErrorText, Link, Muted, Panel, Prices, s } from '../../lib/ui';
import { ebaySold, getCard, rawPriceAud, variantLabel, type RawPrice, type TcgCard } from '../../lib/tcg';
import { estimateGraded, type GradedPrices } from '../../lib/ai';
import { newId, upsert } from '../../lib/binder';

// A card from search: official image, live raw price in AUD, optional graded estimate, add to binder.
export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [card, setCard] = useState<TcgCard | null>(null);
  const [variant, setVariant] = useState<string | null>(null);
  const [raw, setRaw] = useState<RawPrice | null>(null);
  const [graded, setGraded] = useState<GradedPrices | null>(null);
  const [gradedNote, setGradedNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    getCard(String(id)).then(setCard, e => setErr(e instanceof Error ? e.message : 'Could not load this card.'));
  }, [id]);
  useEffect(() => {
    if (card) rawPriceAud(card, variant).then(r => { setRaw(r); if (!variant && r?.variant) setVariant(r.variant); }, () => setRaw(null));
  }, [card, variant]);

  if (err && !card) return <View style={s.screen}><ErrorText>{err}</ErrorText></View>;
  if (!card) return <View style={s.screen}><ActivityIndicator color={C.accent} /></View>;

  const variants = Object.keys(card.tcgplayer?.prices ?? {});
  const numberText = `${card.number}${card.set.printedTotal ? '/' + card.set.printedTotal : ''}`;

  async function estimate() {
    if (!card) return;
    setBusy(true); setErr('');
    try {
      const r = await estimateGraded({ name: card.name, set_name: card.set.name, number: numberText, variant: variant ? variantLabel(variant) : undefined, raw_mid_aud: raw?.mid ?? null });
      setGraded({ ...r.graded_aud, source: 'estimate', at: Date.now() }); setGradedNote(r.notes);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not estimate.'); }
    finally { setBusy(false); }
  }

  async function add() {
    if (!card) return;
    const now = Date.now();
    const it = await upsert({
      id: newId(), cardId: card.id, name: card.name, setName: card.set.name, number: numberText,
      rarity: card.rarity ?? '', variant: variant ? variantLabel(variant) : '', image: card.images.small, qty: 1,
      raw, rawEstimate: null, graded, grade: null, notes: gradedNote, addedAt: now, pricedAt: now, updatedAt: now,
    });
    setSavedId(it.id);
  }

  return (
    <ScrollView contentContainerStyle={s.screen}>
      <Stack.Screen options={{ title: card.name }} />
      <View style={{ alignItems: 'center' }}><CardImage uri={card.images.large} width={240} /></View>
      <Panel>
        <View style={{ gap: 4 }}>
          <Text style={s.h1}>{card.name}</Text>
          <Text style={s.body}>{card.set.name}{card.set.releaseDate ? ` · ${card.set.releaseDate.slice(0, 4)}` : ''}</Text>
          <Muted small>{numberText}{card.rarity ? ` · ${card.rarity}` : ''}</Muted>
        </View>
        {variants.length > 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {variants.map(v => (
              <Pressable key={v} onPress={() => setVariant(v)} accessibilityRole="button" accessibilityState={{ selected: v === variant }}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: v === variant ? C.accent : C.line, backgroundColor: v === variant ? C.accent : C.surface }}>
                <Text style={{ color: v === variant ? C.accentInk : C.ink, fontWeight: '600', fontSize: 13 }}>{variantLabel(v)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Prices
          raw={raw}
          rawLabel={raw ? `Live ${raw.source}${raw.updatedAt ? ' · ' + raw.updatedAt : ''}` : 'No live price for this card'}
          graded={graded}
          gradedLabel={graded ? `Claude's estimate${gradedNote ? ' · ' + gradedNote : ''}` : undefined}
        />
        {!graded ? <Button title="Estimate PSA 8 / 9 / 10 prices" onPress={estimate} busy={busy} /> : null}
        {err ? <ErrorText>{err}</ErrorText> : null}
        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          <Link title="eBay AU sold (raw)" url={ebaySold(`${card.name} ${numberText}`)} />
          <Link title="eBay AU sold (PSA 10)" url={ebaySold(`${card.name} ${numberText} PSA 10`)} />
          {card.tcgplayer?.url ? <Link title="TCGplayer" url={card.tcgplayer.url} /> : null}
        </View>
        {savedId
          ? <Button title="Added · view in binder" onPress={() => router.push(`/item/${savedId}`)} />
          : <Button title="Add to binder" kind="primary" onPress={add} />}
      </Panel>
    </ScrollView>
  );
}
