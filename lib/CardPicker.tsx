import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { C } from './theme';
import { CardImage, ErrorText, Muted, s } from './ui';
import { searchCards, type TcgCard } from './tcg';

// Lets you pick the official card when the automatic match missed or picked the wrong printing.
export function CardPicker({ initialQuery, onPick }: { initialQuery: string; onPick: (c: TcgCard) => void }) {
  const [q, setQ] = useState(initialQuery);
  const [list, setList] = useState<TcgCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) { setList([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true); setErr('');
      try { setList((await searchCards(text, ctl.signal)).slice(0, 18)); }
      catch (e) { if (!ctl.signal.aborted) setErr(e instanceof Error ? e.message : 'Search failed.'); }
      finally { if (!ctl.signal.aborted) setLoading(false); }
    }, 350);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  return (
    <View style={{ gap: 10 }}>
      <TextInput value={q} onChangeText={setQ} placeholder="Card name, e.g. Pikachu 58" placeholderTextColor={C.muted}
        style={s.input} autoCorrect={false} autoCapitalize="none" accessibilityLabel="Search for the matching card" />
      {loading ? <ActivityIndicator color={C.accent} /> : null}
      {err ? <ErrorText>{err}</ErrorText> : null}
      {!loading && !err && q.trim().length >= 2 && !list.length ? <Muted small>No cards found. Try just the name.</Muted> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {list.map(c => (
          <Pressable key={c.id} onPress={() => onPick(c)} style={{ width: '30%', flexGrow: 1, maxWidth: '32%', gap: 3 }}
            accessibilityRole="button" accessibilityLabel={`${c.name}, ${c.set.name}, number ${c.number}`}>
            <CardImage uri={c.images.small} />
            <Text numberOfLines={1} style={{ fontSize: 12, color: C.ink, fontWeight: '600' }}>{c.set.name}</Text>
            <Text numberOfLines={1} style={{ fontSize: 11, color: C.muted }}>{c.number}{c.set.printedTotal ? '/' + c.set.printedTotal : ''}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
