import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { C } from '../../lib/theme';
import { CardImage, ErrorText, Muted, s } from '../../lib/ui';
import { searchCards, type TcgCard } from '../../lib/tcg';

// Find any card by name, optionally with its number ("charizard 4/102").
export default function Search() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<TcgCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) { setResults([]); setErr(''); return; }
    const t = setTimeout(async () => {
      ctl.current?.abort();
      const c = new AbortController(); ctl.current = c;
      setLoading(true); setErr('');
      try { setResults(await searchCards(text, c.signal)); }
      catch (e) { if (!c.signal.aborted) setErr(e instanceof Error ? e.message : 'Search failed.'); }
      finally { if (!c.signal.aborted) setLoading(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, gap: 8 }}>
        <TextInput
          value={q} onChangeText={setQ} placeholder="Card name, e.g. Pikachu or Charizard 4/102"
          placeholderTextColor={C.muted} style={s.input} autoCorrect={false} autoCapitalize="none" returnKeyType="search"
          accessibilityLabel="Search cards"
        />
        {loading ? <ActivityIndicator color={C.accent} /> : null}
        {err ? <ErrorText>{err}</ErrorText> : null}
        {!loading && !err && q.trim().length >= 2 && !results.length ? <Muted>No cards found. Check the spelling, or try just the name.</Muted> : null}
        {q.trim().length < 2 ? <Muted>Search every English Pokémon card for live prices in AUD, then add it to your binder.</Muted> : null}
      </View>
      <FlatList
        data={results}
        keyExtractor={c => c.id}
        numColumns={3}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 12 }}
        columnWrapperStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <Pressable style={{ flex: 1 / 3, gap: 4 }} onPress={() => router.push(`/card/${item.id}`)} accessibilityLabel={`${item.name}, ${item.set.name}`}>
            <CardImage uri={item.images.small} />
            <Text numberOfLines={1} style={{ fontWeight: '600', color: C.ink, fontSize: 13 }}>{item.name}</Text>
            <Text numberOfLines={1} style={{ color: C.muted, fontSize: 12 }}>{item.set.name} · {item.number}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
