'use client';

import { useMemo, useState } from 'react';
import { Crown, Dices, Plus, RotateCcw, ShieldCheck, Sparkles, Swords, Trophy, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Player = { id: string; name: string; wins: number; byes: number; eliminatedRound?: number; champion?: boolean };
type Pod = { id: string; playerIds: string[]; winnerId?: string };
type Round = { number: number; pods: Pod[]; byeIds: string[]; complete: boolean };
const starterNames = ['Maya Chen', 'Theo Grant', 'Jules Carter', 'Iris Monroe', 'Dante Reed', 'Nia Brooks', 'Owen Park', 'Sam Rivera'];

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function Home() {
  const [names, setNames] = useState<string[]>(starterNames);
  const [newName, setNewName] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [manualBye, setManualBye] = useState('');
  const currentRound = rounds.at(-1);
  const tournamentStarted = players.length > 0;
  const champion = players.find((player) => player.champion);
  const standings = useMemo(() => [...players].sort((a, b) => {
    if (a.champion !== b.champion) return a.champion ? -1 : 1;
    const aDepth = a.eliminatedRound ?? rounds.length + 1;
    const bDepth = b.eliminatedRound ?? rounds.length + 1;
    return bDepth - aDepth || b.wins - a.wins || b.byes - a.byes || a.name.localeCompare(b.name);
  }), [players, rounds.length]);

  function addPlayer() {
    const name = newName.trim();
    if (!name || names.some((entry) => entry.toLowerCase() === name.toLowerCase())) return;
    setNames([...names, name]); setNewName('');
  }
  function createRound(activeIds: string[], roundNumber: number, preferredBye = '') {
    if (activeIds.length === 1) {
      setPlayers((current) => current.map((player) => player.id === activeIds[0] ? { ...player, champion: true } : player));
      return;
    }
    let ordered = shuffle(activeIds);
    // Once four or fewer players remain, they play a single final pod.
    const byeCount = ordered.length <= 4 ? 0 : ordered.length % 4;
    const byeIds: string[] = [];
    if (preferredBye && ordered.includes(preferredBye) && byeCount > 0) { byeIds.push(preferredBye); ordered = ordered.filter((id) => id !== preferredBye); }
    while (byeIds.length < byeCount) byeIds.push(ordered.pop()!);
    const pods: Pod[] = [];
    for (let i = 0; i < ordered.length; i += 4) pods.push({ id: `r${roundNumber}-p${pods.length + 1}`, playerIds: ordered.slice(i, i + 4) });
    setPlayers((current) => current.map((player) => byeIds.includes(player.id) ? { ...player, byes: player.byes + 1 } : player));
    setRounds((current) => [...current, { number: roundNumber, pods, byeIds, complete: pods.length === 0 }]);
  }
  function startTournament() {
    if (names.length < 4) return;
    const roster = names.map((name, index) => ({ id: `p-${Date.now()}-${index}`, name, wins: 0, byes: 0 }));
    setPlayers(roster); setRounds([]);
    createRound(roster.map((player) => player.id), 1, manualBye ? roster[names.indexOf(manualBye)]?.id : '');
  }
  function pickWinner(podId: string, winnerId: string) {
    if (!currentRound || currentRound.complete) return;
    setRounds((current) => current.map((round, index) => index === current.length - 1 ? { ...round, pods: round.pods.map((pod) => pod.id === podId ? { ...pod, winnerId } : pod) } : round));
  }
  function finishRound() {
    if (!currentRound || currentRound.pods.some((pod) => !pod.winnerId)) return;
    const advancing = [...currentRound.byeIds, ...currentRound.pods.map((pod) => pod.winnerId!)];
    const podPlayerIds = currentRound.pods.flatMap((pod) => pod.playerIds);
    setPlayers((current) => current.map((player) => {
      if (currentRound.pods.some((pod) => pod.winnerId === player.id)) return { ...player, wins: player.wins + 1 };
      if (podPlayerIds.includes(player.id)) return { ...player, eliminatedRound: currentRound.number };
      return player;
    }));
    setRounds((current) => current.map((round, index) => index === current.length - 1 ? { ...round, complete: true } : round));
    createRound(advancing, currentRound.number + 1);
  }
  function resetTournament() { setPlayers([]); setRounds([]); setManualBye(''); }
  const canAdvance = currentRound && currentRound.pods.length > 0 && currentRound.pods.every((pod) => pod.winnerId);

  return <main className="min-h-screen bg-background text-foreground">
    <header className="border-b border-white/8 bg-[#101914]/92 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
      <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-300"><Crown className="size-5" /></div><div><p className="font-heading text-lg font-bold tracking-tight text-white">The Command Zone</p><p className="text-xs text-white/45">cEDH tournament director</p></div></div>
      <Badge className="border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">{champion ? 'Tournament complete' : tournamentStarted ? `Round ${currentRound?.number ?? rounds.length}` : 'Setup'}</Badge>
    </div></header>
    <div className="mx-auto grid max-w-7xl gap-6 px-5 py-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
      <section className="min-w-0">
        {!tournamentStarted ? <div className="panel overflow-hidden">
          <div className="border-b border-border px-6 py-6 sm:px-8"><div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary"><Users className="size-6" /></div><h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">Seat the table. Start the battle.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Add your competitors, optionally nominate a first-round bye, then generate randomized four-player pods.</p></div>
          <div className="p-6 sm:p-8"><div className="flex gap-2"><Input aria-label="Player name" className="h-11 bg-white" placeholder="Enter player name" value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addPlayer()} /><Button className="h-11 px-4" onClick={addPlayer}><Plus /> Add player</Button></div>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">{names.map((name, index) => <div key={name} className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-3"><span className="grid size-8 place-items-center rounded-lg bg-muted font-mono text-xs font-bold text-muted-foreground">{String(index + 1).padStart(2, '0')}</span><span className="flex-1 text-sm font-semibold">{name}</span><button aria-label={`Remove ${name}`} onClick={() => { setNames(names.filter((entry) => entry !== name)); if (manualBye === name) setManualBye(''); }} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">Remove</button></div>)}</div>
            <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-end sm:justify-between"><label className="block flex-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Optional first-round bye<select value={manualBye} onChange={(event) => setManualBye(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-input bg-white px-3 text-sm font-medium normal-case tracking-normal outline-none focus:ring-2 focus:ring-primary/30"><option value="">Assign automatically</option>{names.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><Button disabled={names.length < 4} onClick={startTournament} className="h-11 bg-[#182d22] px-5 text-white hover:bg-[#244532]"><Dices /> Generate pairings</Button></div>
          </div></div>
        : champion ? <div className="panel overflow-hidden"><div className="champion-glow px-6 py-12 text-center sm:px-10"><div className="mx-auto grid size-20 place-items-center rounded-full border border-amber-300/40 bg-amber-300/15 text-amber-500"><Trophy className="size-10" /></div><p className="mt-6 text-xs font-bold uppercase tracking-[.24em] text-amber-600">Tournament champion</p><h1 className="mt-2 font-heading text-4xl font-black tracking-tight sm:text-6xl">{champion.name}</h1><p className="mt-3 text-muted-foreground">{champion.wins} pod {champion.wins === 1 ? 'win' : 'wins'} · {champion.byes} {champion.byes === 1 ? 'bye' : 'byes'}</p><Button className="mt-8" variant="outline" onClick={resetTournament}><RotateCcw /> Run another tournament</Button></div></div>
        : currentRound ? <div><div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Live pairings</p><h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">Round {currentRound.number}</h1><p className="mt-1 text-sm text-muted-foreground">Tap one player in each pod to record the winner.</p></div><Button disabled={!canAdvance} onClick={finishRound} className="h-11 px-5"><Sparkles /> Complete round</Button></div>
          {currentRound.byeIds.length > 0 && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-sky-300/35 bg-sky-50 px-4 py-3 text-sm text-sky-900"><ShieldCheck className="size-4" /><strong>Advancing by bye:</strong>{currentRound.byeIds.map((id) => <Badge key={id} className="bg-sky-100 text-sky-800">{players.find((player) => player.id === id)?.name}</Badge>)}</div>}
          <div className="grid gap-4 xl:grid-cols-2">{currentRound.pods.map((pod, podIndex) => <article key={pod.id} className="panel p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><Swords className="size-4 text-primary" /><h2 className="font-heading font-bold">Pod {podIndex + 1}</h2></div><Badge variant={pod.winnerId ? 'default' : 'outline'}>{pod.winnerId ? 'Winner locked' : 'Awaiting result'}</Badge></div><div className="space-y-2">{pod.playerIds.map((id, seatIndex) => { const player = players.find((entry) => entry.id === id)!; const selected = pod.winnerId === id; return <button key={id} onClick={() => pickWinner(pod.id, id)} className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${selected ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_var(--primary)]' : 'border-border bg-white hover:border-primary/35 hover:bg-primary/5'}`}><span className={`grid size-8 place-items-center rounded-lg font-mono text-xs font-bold ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{seatIndex + 1}</span><span className="flex-1 text-sm font-semibold">{player.name}</span>{selected && <Crown className="size-4 text-primary" />}</button>; })}</div></article>)}</div>
        </div> : null}
      </section>
      <aside className="space-y-4"><div className="panel p-5"><div className="flex items-center justify-between"><div><p className="eyebrow">Leaderboard</p><h2 className="font-heading text-xl font-bold">Standings</h2></div><Trophy className="size-5 text-amber-500" /></div>{!tournamentStarted ? <p className="mt-6 rounded-xl bg-muted p-4 text-sm leading-6 text-muted-foreground">Rankings appear here once pairings begin.</p> : <ol className="mt-4 space-y-1">{standings.map((player, index) => <li key={player.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${index === 0 ? 'bg-amber-50' : ''}`}><span className={`grid size-7 place-items-center rounded-lg font-mono text-xs font-bold ${index === 0 ? 'bg-amber-400 text-amber-950' : 'bg-muted text-muted-foreground'}`}>{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.name}</span><span className="text-right text-[11px] leading-4 text-muted-foreground"><strong className="block text-sm text-foreground">{player.wins}W</strong>{player.byes} bye</span></li>)}</ol>}</div>
        {tournamentStarted && <Button variant="ghost" className="w-full text-muted-foreground" onClick={resetTournament}><RotateCcw /> Reset tournament</Button>}
        <div className="rounded-2xl border border-white/8 bg-[#15231b] p-5 text-white"><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">How it works</p><p className="mt-2 text-sm leading-6 text-white/60">Players are shuffled into pods of four. Each pod winner advances; leftover players receive a bye. Rankings favor the champion, then deepest finish, pod wins, and byes.</p></div>
      </aside>
    </div>
  </main>;
}
