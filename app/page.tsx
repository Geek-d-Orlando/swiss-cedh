'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Crown, Dices, FileInput, Plus, RotateCcw, Scissors, Sparkles, Swords, Trophy, UserMinus, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

type Player = { id: string; name: string; dropped: boolean };
type Pod = { id: string; playerIds: string[]; winnerId?: string };
type Round = { number: number; phase: 'swiss' | 'final'; pods: Pod[]; byeIds: string[]; complete: boolean };
type Stats = { points: number; wins: number; byes: number; played: number; omw: number };

const SWISS_ROUNDS = 4;
const STORAGE_KEY = 'command-zone-tournament-v1';
const sampleNames = ['Maya Chen', 'Theo Grant', 'Jules Carter', 'Iris Monroe', 'Dante Reed', 'Nia Brooks', 'Owen Park', 'Sam Rivera'];

function makePlayers(names: string[]): Player[] {
  return names.map((name, index) => ({ id: `p-${Date.now()}-${index}`, name, dropped: false }));
}

function calculateStats(players: Player[], rounds: Round[]): Record<string, Stats> {
  const completeSwiss = rounds.filter((round) => round.phase === 'swiss' && round.complete);
  const base = Object.fromEntries(players.map((player) => [player.id, { points: 0, wins: 0, byes: 0, played: 0, omw: 0 }]));
  const opponents: Record<string, string[]> = Object.fromEntries(players.map((player) => [player.id, []]));
  for (const round of completeSwiss) {
    for (const id of round.byeIds) { base[id].points += 3; base[id].byes += 1; base[id].played += 1; }
    for (const pod of round.pods) {
      for (const id of pod.playerIds) {
        base[id].played += 1;
        opponents[id].push(...pod.playerIds.filter((other) => other !== id));
      }
      if (pod.winnerId) { base[pod.winnerId].points += 3; base[pod.winnerId].wins += 1; }
    }
  }
  const mwp = (id: string) => base[id].played ? Math.max(1 / 3, base[id].points / (base[id].played * 3)) : 1 / 3;
  for (const player of players) {
    const faced = opponents[player.id];
    base[player.id].omw = faced.length ? faced.reduce((sum, id) => sum + mwp(id), 0) / faced.length : 0;
  }
  return base;
}

function pairPlayers(ids: string[], stats: Record<string, Stats>, history: Set<string>, roundNumber: number) {
  const ordered = [...ids].sort((a, b) => stats[b].points - stats[a].points || stats[b].omw - stats[a].omw || Math.random() - .5);
  const byeCount = ordered.length % 4;
  const byeIds = ordered.splice(Math.max(0, ordered.length - byeCount), byeCount);
  const pods: Pod[] = [];
  while (ordered.length) {
    const pod = [ordered.shift()!];
    while (pod.length < 4 && ordered.length) {
      let bestIndex = 0;
      let bestCost = Infinity;
      ordered.forEach((candidate, index) => {
        const repeats = pod.reduce((sum, seated) => sum + (history.has([candidate, seated].sort().join('|')) ? 1 : 0), 0);
        const cost = repeats * 100 + Math.abs(stats[candidate].points - stats[pod[0]].points) * 5 + index;
        if (cost < bestCost) { bestCost = cost; bestIndex = index; }
      });
      pod.push(ordered.splice(bestIndex, 1)[0]);
    }
    pods.push({ id: `r${roundNumber}-p${pods.length + 1}`, playerIds: pod });
  }
  return { pods, byeIds };
}

function initialPods(ids: string[]) {
  const byeCount = ids.length % 4;
  const seated = byeCount ? ids.slice(0, -byeCount) : ids;
  const byeIds = byeCount ? ids.slice(-byeCount) : [];
  const pods: Pod[] = [];
  for (let i = 0; i < seated.length; i += 4) pods.push({ id: `r1-p${pods.length + 1}`, playerIds: seated.slice(i, i + 4) });
  return { pods, byeIds };
}

function opponentHistory(rounds: Round[]) {
  const pairs = new Set<string>();
  rounds.filter((round) => round.complete && round.phase === 'swiss').forEach((round) => round.pods.forEach((pod) => pod.playerIds.forEach((id, i) => pod.playerIds.slice(i + 1).forEach((other) => pairs.add([id, other].sort().join('|'))))));
  return pairs;
}

export default function Home() {
  const [names, setNames] = useState(sampleNames);
  const [newName, setNewName] = useState('');
  const [importText, setImportText] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [swapA, setSwapA] = useState('');
  const [swapB, setSwapB] = useState('');
  const [manualDraft, setManualDraft] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved) as { names?: string[]; players?: Player[]; rounds?: Round[]; manualDraft?: boolean };
        if (Array.isArray(state.names)) setNames(state.names);
        if (Array.isArray(state.players)) setPlayers(state.players);
        if (Array.isArray(state.rounds)) setRounds(state.rounds);
        if (typeof state.manualDraft === 'boolean') setManualDraft(state.manualDraft);
      }
    } catch {
      // A corrupt or unavailable browser store should never block the tournament.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ names, players, rounds, manualDraft }));
    } catch {
      // Continue in-memory if the browser declines local storage.
    }
  }, [hydrated, names, players, rounds, manualDraft]);

  const currentRound = rounds.at(-1);
  const stats = useMemo(() => calculateStats(players, rounds), [players, rounds]);
  const standings = useMemo(() => [...players].sort((a, b) => stats[b.id].points - stats[a.id].points || stats[b.id].omw - stats[a.id].omw || stats[b.id].wins - stats[a.id].wins || a.name.localeCompare(b.name)), [players, stats]);
  const championId = rounds.find((round) => round.phase === 'final' && round.complete)?.pods[0]?.winnerId;
  const started = players.length > 0;
  const history = useMemo(() => opponentHistory(rounds), [rounds]);

  function addName() {
    const name = newName.trim();
    if (name && !names.some((entry) => entry.toLowerCase() === name.toLowerCase())) setNames([...names, name]);
    setNewName('');
  }
  function importNames() {
    const incoming = importText.split(/[,\n]+/).map((name) => name.trim()).filter(Boolean);
    const unique = [...names];
    incoming.forEach((name) => { if (!unique.some((entry) => entry.toLowerCase() === name.toLowerCase())) unique.push(name); });
    setNames(unique); setImportText('');
  }
  function start(mode: 'auto' | 'manual') {
    if (names.length < 4) return;
    const roster = makePlayers(names);
    const ids = roster.map((player) => player.id);
    const pairing = mode === 'manual' ? initialPods(ids) : pairPlayers(ids, calculateStats(roster, []), new Set(), 1);
    setPlayers(roster); setRounds([{ number: 1, phase: 'swiss', ...pairing, complete: false }]); setManualDraft(mode === 'manual');
  }
  function setWinner(podId: string, playerId: string) {
    if (!currentRound || currentRound.complete) return;
    setRounds((all) => all.map((round, index) => index === all.length - 1 ? { ...round, pods: round.pods.map((pod) => pod.id === podId ? { ...pod, winnerId: playerId } : pod) } : round));
  }
  function finishRound() {
    if (!currentRound || currentRound.pods.some((pod) => !pod.winnerId)) return;
    const completed = { ...currentRound, complete: true };
    if (currentRound.phase === 'final') { setRounds([...rounds.slice(0, -1), completed]); return; }
    const completedRounds = [...rounds.slice(0, -1), completed];
    if (currentRound.number === SWISS_ROUNDS) {
      const finalStats = calculateStats(players, completedRounds);
      const topFour = [...players].filter((player) => !player.dropped).sort((a, b) => finalStats[b.id].points - finalStats[a.id].points || finalStats[b.id].omw - finalStats[a.id].omw || finalStats[b.id].wins - finalStats[a.id].wins).slice(0, 4).map((player) => player.id);
      setRounds([...completedRounds, { number: 5, phase: 'final', pods: [{ id: 'top-4', playerIds: topFour }], byeIds: [], complete: false }]);
    } else {
      const nextNumber = currentRound.number + 1;
      const active = players.filter((player) => !player.dropped).map((player) => player.id);
      setRounds([...completedRounds, { number: nextNumber, phase: 'swiss', ...pairPlayers(active, calculateStats(players, completedRounds), opponentHistory(completedRounds), nextNumber), complete: false }]);
    }
    setManualDraft(false); setSwapA(''); setSwapB('');
  }
  function discardPairings() {
    if (!currentRound || currentRound.complete || currentRound.phase === 'final') return;
    const active = players.filter((player) => !player.dropped).map((player) => player.id);
    const pairing = pairPlayers(active, stats, history, currentRound.number);
    setRounds((all) => [...all.slice(0, -1), { ...currentRound, ...pairing }]); setSwapA(''); setSwapB(''); setManualDraft(false);
  }
  function swapPlayers() {
    if (!swapA || !swapB || swapA === swapB || !currentRound || currentRound.complete) return;
    const replace = (id: string) => id === swapA ? swapB : id === swapB ? swapA : id;
    setRounds((all) => [...all.slice(0, -1), { ...currentRound, pods: currentRound.pods.map((pod) => ({ ...pod, playerIds: pod.playerIds.map(replace), winnerId: undefined })), byeIds: currentRound.byeIds.map(replace) }]);
    setSwapA(''); setSwapB('');
  }
  function dropPlayer(id: string) {
    setPlayers((all) => all.map((player) => player.id === id ? { ...player, dropped: !player.dropped } : player));
    if (currentRound && !currentRound.complete && currentRound.phase === 'swiss') {
      setRounds((all) => [...all.slice(0, -1), { ...currentRound, pods: currentRound.pods.map((pod) => ({ ...pod, playerIds: pod.playerIds.filter((playerId) => playerId !== id), winnerId: pod.winnerId === id ? undefined : pod.winnerId })).filter((pod) => pod.playerIds.length), byeIds: currentRound.byeIds.filter((playerId) => playerId !== id) }]);
    }
  }
  const canFinish = currentRound?.pods.every((pod) => pod.winnerId) && !currentRound.complete;
  const availableToSwap = currentRound ? [...currentRound.pods.flatMap((pod) => pod.playerIds), ...currentRound.byeIds] : [];

  return <main className="min-h-screen bg-background text-foreground">
    <header className="border-b border-white/8 bg-[#101914]/95"><div className="mx-auto flex max-w-[1450px] items-center justify-between px-5 py-4 lg:px-8"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-300"><Crown className="size-5" /></div><div><p className="font-heading text-lg font-bold text-white">The Command Zone</p><p className="text-xs text-white/45">4-round Swiss · Top 4 cut</p></div></div><div className="flex items-center gap-2"><span className="hidden text-[11px] font-medium text-white/40 sm:inline">{hydrated ? 'Saved on this device' : 'Restoring…'}</span><Badge className="border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">{championId ? 'Complete' : currentRound?.phase === 'final' ? 'Top 4 final' : started ? `Swiss ${currentRound?.number} / 4` : 'Setup'}</Badge></div></div></header>
    <div className="mx-auto grid max-w-[1450px] gap-6 px-5 py-7 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-8">
      <section className="min-w-0">
        {!started ? <div className="panel overflow-hidden"><div className="border-b border-border px-6 py-6 sm:px-8"><div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary"><Users className="size-6" /></div><h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">Build the Swiss field.</h1><p className="mt-2 text-sm text-muted-foreground">Four Swiss rounds, standings paired by points and OMW%, then a Top 4 final pod.</p></div><div className="grid gap-7 p-6 sm:p-8 xl:grid-cols-[1fr_1fr]">
          <div><p className="eyebrow">Add individually</p><div className="flex gap-2"><Input className="h-11 bg-white" placeholder="Player name" value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addName()} /><Button className="h-11" onClick={addName}><Plus /> Add</Button></div>
            <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">{names.map((name, index) => <div key={name} className="flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5"><span className="grid size-7 place-items-center rounded-lg bg-muted font-mono text-xs font-bold">{index + 1}</span><span className="flex-1 text-sm font-semibold">{name}</span><button aria-label={`Remove ${name}`} className="text-muted-foreground hover:text-destructive" onClick={() => setNames(names.filter((entry) => entry !== name))}><X className="size-4" /></button></div>)}</div></div>
          <div><p className="eyebrow">Quick import</p><Textarea className="min-h-28 bg-white" placeholder="Paste names separated by commas or new lines…" value={importText} onChange={(event) => setImportText(event.target.value)} /><Button variant="outline" className="mt-2" onClick={importNames}><FileInput /> Import names</Button>
            <div className="mt-7 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5"><h2 className="font-heading text-lg font-bold">Create Round 1</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Auto-pair the field, or start in roster order and use the seat swapper to build every pod manually.</p><div className="mt-4 flex flex-wrap gap-2"><Button disabled={names.length < 4} onClick={() => start('auto')}><Dices /> Auto pair</Button><Button disabled={names.length < 4} variant="outline" onClick={() => start('manual')}><ArrowRightLeft /> Manual pairings</Button></div></div></div>
        </div></div>
        : championId ? <div className="panel champion-glow px-6 py-12 text-center"><div className="mx-auto grid size-20 place-items-center rounded-full bg-amber-300/20 text-amber-600"><Trophy className="size-10" /></div><p className="mt-6 text-xs font-bold uppercase tracking-[.24em] text-amber-600">Tournament champion</p><h1 className="mt-2 font-heading text-5xl font-black">{players.find((player) => player.id === championId)?.name}</h1><Button className="mt-8" variant="outline" onClick={() => { setPlayers([]); setRounds([]); }}><RotateCcw /> New tournament</Button></div>
        : currentRound ? <div><div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">{currentRound.phase === 'final' ? 'Top 4 cut' : manualDraft ? 'Manual pairing draft' : 'Live pairings'}</p><h1 className="font-heading text-3xl font-black">{currentRound.phase === 'final' ? 'Championship pod' : `Swiss Round ${currentRound.number}`}</h1><p className="mt-1 text-sm text-muted-foreground">{manualDraft ? 'Use the seat swapper to create the exact opening pods you want.' : 'Select one winner for every pod, then complete the round.'}</p></div><Button disabled={!canFinish} className="h-11 px-5" onClick={finishRound}><Sparkles /> {currentRound.phase === 'final' ? 'Crown champion' : currentRound.number === 4 ? 'Complete Swiss & cut' : 'Complete round'}</Button></div>
          {currentRound.phase === 'swiss' && <div className="panel mb-4 flex flex-col gap-3 p-4 xl:flex-row xl:items-end"><div className="flex-1"><p className="eyebrow">Repair pairings</p><div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><NativeSelect className="w-full" value={swapA} onChange={(e) => setSwapA(e.target.value)}><NativeSelectOption value="">First player</NativeSelectOption>{availableToSwap.map((id) => <NativeSelectOption key={id} value={id}>{players.find((p) => p.id === id)?.name}</NativeSelectOption>)}</NativeSelect><NativeSelect className="w-full" value={swapB} onChange={(e) => setSwapB(e.target.value)}><NativeSelectOption value="">Second player</NativeSelectOption>{availableToSwap.map((id) => <NativeSelectOption key={id} value={id}>{players.find((p) => p.id === id)?.name}</NativeSelectOption>)}</NativeSelect><Button variant="outline" onClick={swapPlayers}><ArrowRightLeft /> Swap seats</Button></div></div><Button variant="destructive" onClick={discardPairings}><Scissors /> Discard & re-pair</Button></div>}
          {currentRound.byeIds.length > 0 && <div className="mb-4 rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900"><strong>Byes:</strong> {currentRound.byeIds.map((id) => players.find((player) => player.id === id)?.name).join(', ')}</div>}
          <div className="grid gap-4 xl:grid-cols-2">{currentRound.pods.map((pod, podIndex) => <article key={pod.id} className="panel p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><Swords className="size-4 text-primary" /><h2 className="font-heading font-bold">{currentRound.phase === 'final' ? 'Final table' : `Pod ${podIndex + 1}`}</h2></div><Badge variant={pod.winnerId ? 'default' : 'outline'}>{pod.winnerId ? 'Winner selected' : `${pod.playerIds.length} players`}</Badge></div><div className="space-y-2">{pod.playerIds.map((id, seat) => { const player = players.find((entry) => entry.id === id)!; const selected = pod.winnerId === id; return <button key={id} onClick={() => setWinner(pod.id, id)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${selected ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_var(--primary)]' : 'bg-white hover:border-primary/40'}`}><span className={`grid size-8 place-items-center rounded-lg font-mono text-xs font-bold ${selected ? 'bg-primary text-white' : 'bg-muted'}`}>{seat + 1}</span><span className="flex-1 text-sm font-semibold">{player.name}</span>{selected && <Crown className="size-4 text-primary" />}</button>; })}</div></article>)}</div>
        </div> : null}
      </section>
      <aside className="space-y-4"><div className="panel p-5"><div className="flex items-center justify-between"><div><p className="eyebrow">Live table</p><h2 className="font-heading text-xl font-bold">Standings</h2></div><Trophy className="size-5 text-amber-500" /></div>{!started ? <p className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">Standings appear after the tournament begins.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-[10px] uppercase tracking-widest text-muted-foreground"><th className="pb-2 text-left"># Player</th><th className="pb-2 text-right">Pts</th><th className="pb-2 text-right">OMW%</th><th /></tr></thead><tbody>{standings.map((player, index) => <tr key={player.id} className={`border-b border-border/60 ${index < 4 ? 'bg-amber-50/70' : ''}`}><td className="py-2.5"><span className="mr-2 font-mono text-xs text-muted-foreground">{index + 1}</span><span className={player.dropped ? 'text-muted-foreground line-through' : 'font-semibold'}>{player.name}</span>{index < 4 && !player.dropped && <span className="ml-1 text-[9px] font-bold text-amber-700">CUT</span>}</td><td className="py-2.5 text-right font-bold">{stats[player.id].points}</td><td className="py-2.5 text-right font-mono text-xs">{(stats[player.id].omw * 100).toFixed(1)}</td><td className="py-2.5 pl-2 text-right"><button title={player.dropped ? 'Restore player' : 'Drop player'} onClick={() => dropPlayer(player.id)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"><UserMinus className="size-3.5" /></button></td></tr>)}</tbody></table></div>}</div>
        {started && <div className="rounded-2xl bg-[#15231b] p-5 text-white"><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Pairing logic</p><p className="mt-2 text-sm leading-6 text-white/60">Players are grouped by match points, then OMW%. The engine avoids repeat opponents where possible. A win or bye is 3 points; OMW% uses each opponent’s match-win rate with a 33.3% floor.</p></div>}
        {started && <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => { setPlayers([]); setRounds([]); }}><RotateCcw /> Reset tournament</Button>}
      </aside>
    </div>
  </main>;
}
