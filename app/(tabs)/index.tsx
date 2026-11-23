import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { C, CARD_RATIO } from '../../lib/theme';
import { Button, CardImage, ErrorText, Eyebrow, GradeSlab, Link, Muted, Panel, Prices, Tag, s } from '../../lib/ui';
import { gradeCard, identify, prepPhoto, type Grade, type Identified } from '../../lib/ai';
import { ebaySold, matchCard, rawPriceAud, variantKey, variantLabel, type RawPrice, type TcgCard } from '../../lib/tcg';
import { getItem, newId, upsert } from '../../lib/binder';

type Photo = { uri: string; b64: string };

export default function Scan() {
  const [front, setFront] = useState<Photo | null>(null);
  const [back, setBack] = useState<Photo | null>(null);
  const [ident, setIdent] = useState<Identified | null>(null);
  const [match, setMatch] = useState<TcgCard | null>(null);
  const [raw, setRaw] = useState<RawPrice | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [busy, setBusy] = useState<'identify' | 'grade' | 'photo' | null>(null);
  const [err, setErr] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);

  async function pick(side: 'front' | 'back', camera: boolean) {
    setErr('');
    try {
      if (camera) {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) { setErr('Camera access is off. Turn it on in Settings, or choose a photo instead.'); return; }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      setBusy('photo');
      const b64 = await prepPhoto(a.uri, a.width, a.height);
      const photo = { uri: a.uri, b64 };
      if (side === 'front') { setFront(photo); setIdent(null); setMatch(null); setRaw(null); setGrade(null); setSavedId(null); }
      else { setBack(photo); setGrade(null); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open that photo.');
    } finally { setBusy(null); }
  }

  async function runIdentify() {
    if (!front) return;
    setBusy('identify'); setErr(''); setSavedId(null);
    try {
      const r = await identify(front.b64, back?.b64);
      setIdent(r); setMatch(null); setRaw(null);
      if (r.found) {
        const m = await matchCard(r.name, r.number, r.set_name).catch(() => null);
        setMatch(m);
        if (m) setRaw(await rawPriceAud(m, variantKey(r.variant)).catch(() => null));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.');
    } finally { setBusy(null); }
  }

  async function runGrade() {
    if (!front) return;
    setBusy('grade'); setErr('');
    try {
      const ctx = ident?.found ? {
        name: ident.name, set_name: ident.set_name, number: ident.number, variant: ident.variant,
        raw_mid_aud: raw?.mid ?? ident.raw_aud.mid, graded: ident.graded_aud,
      } : null;
      const g = { ...(await gradeCard(front.b64, back?.b64 ?? null, ctx)), at: Date.now() };
      setGrade(g);
      // Already in the binder? Keep the new grade with it.
      const saved = savedId ? getItem(savedId) : undefined;
      if (saved) await upsert({ ...saved, grade: g });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.');
    } finally { setBusy(null); }
  }

  async function save() {
    if (!ident?.found) return;
    const now = Date.now();
    const it = await upsert({
      id: newId(), cardId: match?.id ?? null,
      name: match?.name ?? ident.name, setName: match?.set.name ?? ident.set_name,
      number: match ? `${match.number}/${match.set.printedTotal ?? ''}`.replace(/\/$/, '') : ident.number,
      rarity: match?.rarity ?? ident.rarity, variant: ident.variant,
      image: match?.images.small ?? null, qty: 1,
      raw, rawEstimate: raw ? null : ident.raw_aud,
      graded: { ...ident.graded_aud, source: 'estimate', at: now },
      grade, notes: ident.notes, addedAt: now, pricedAt: now, updatedAt: now,
    });
    setSavedId(it.id);
  }

  const found = ident?.found;
  const rawForDisplay = raw ?? (ident ? ident.raw_aud : null);
  const rawLabel = raw
    ? `Live ${raw.source}${raw.variant ? ' · ' + variantLabel(raw.variant) : ''}`
    : 'Estimate · no live price found';

  return (
    <ScrollView contentContainerStyle={s.screen}>
      <Panel>
        <View style={{ gap: 4 }}>
          <Text style={s.h2}>Scan a card</Text>
          <Muted>Lay the card flat on a plain background in good light. Fill the frame and tilt away any glare on holo cards.</Muted>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {(['front', 'back'] as const).map(side => {
            const p = side === 'front' ? front : back;
            return (
              <View key={side} style={{ flex: 1, gap: 8 }}>
                <Eyebrow>{side === 'front' ? 'Front · required' : 'Back · for grading'}</Eyebrow>
                <Pressable onPress={() => pick(side, true)} accessibilityLabel={`Photograph the ${side}`}
                  style={{ aspectRatio: CARD_RATIO, borderRadius: 10, borderWidth: 2, borderStyle: p ? 'solid' : 'dashed', borderColor: C.line, backgroundColor: C.sunk, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  {p ? <Image source={{ uri: p.uri }} style={{ width: '100%', height: '100%' }} /> :
                    <Muted small>{side === 'front' ? 'Tap to photograph' : 'Optional'}</Muted>}
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Button title="Camera" onPress={() => pick(side, true)} kind={side === 'front' ? 'primary' : 'plain'} style={{ flex: 1, minHeight: 40, paddingHorizontal: 6 }} />
                  <Button title="Photos" onPress={() => pick(side, false)} style={{ flex: 1, minHeight: 40, paddingHorizontal: 6 }} />
                </View>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Identify & value" kind="primary" onPress={runIdentify} disabled={!front || !!busy} busy={busy === 'identify'} style={{ flex: 1 }} />
          <Button title="Check PSA grade" onPress={runGrade} disabled={!front || !!busy} busy={busy === 'grade'} style={{ flex: 1 }} />
        </View>
        {busy === 'grade' ? <Muted small>Checking centering, corners, edges and surface. This can take up to a minute.</Muted> : null}
        {err ? <ErrorText>{err}</ErrorText> : null}
      </Panel>

      {ident && !found ? (
        <Panel>
          <Text style={s.h2}>Couldn't identify this card</Text>
          <Muted>{ident.notes || 'Try a sharper, well-lit photo of the front.'}</Muted>
        </Panel>
      ) : null}

      {ident && found ? (
        <Panel>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <CardImage uri={match?.images.small ?? front?.uri} width={96} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <Tag>{ident.confidence} confidence</Tag>
                {match ? <Tag>Matched</Tag> : null}
              </View>
              <Text style={s.h2}>{match?.name ?? ident.name}</Text>
              <Text style={s.body}>{match?.set.name ?? ident.set_name}{ident.year ? ` · ${ident.year}` : ''}</Text>
              <Muted small>{ident.number}{ident.rarity ? ` · ${ident.rarity}` : ''}{ident.variant ? ` · ${ident.variant}` : ''}</Muted>
            </View>
          </View>
          <Prices raw={rawForDisplay} rawLabel={rawLabel} graded={ident.graded_aud} gradedLabel="Graded prices are Claude's estimates from recent sales, not live data." />
          {ident.notes ? <Muted small>{ident.notes}</Muted> : null}
          <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
            <Link title="eBay AU sold (raw)" url={ebaySold(`${ident.name} ${ident.number}`)} />
            <Link title="eBay AU sold (PSA 10)" url={ebaySold(`${ident.name} ${ident.number} PSA 10`)} />
            {match ? <Text style={s.link} onPress={() => router.push(`/card/${match.id}`)}>Full card details</Text> : null}
          </View>
          {savedId ? (
            <Button title="Added · view in binder" onPress={() => router.push(`/item/${savedId}`)} />
          ) : (
            <Button title="Add to binder" kind="primary" onPress={save} />
          )}
        </Panel>
      ) : null}

      {grade ? (
        <View style={{ gap: 8 }}>
          <GradeSlab g={grade} />
          <Muted small>A photo can hide small scratches and edge wear, so treat this as a pre-screen. Only PSA can give the actual grade.</Muted>
          {savedId ? null : ident?.found ? <Muted small>Tap Add to binder to keep this grade with the card.</Muted> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
