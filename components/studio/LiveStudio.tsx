'use client';

import { CSSProperties, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowCounterClockwise, ArrowDown, ArrowLeft, ArrowUpRight, CaretDown, Check, CircleNotch, DownloadSimple, FadersHorizontal, Headphones, Microphone, Pause, Play, Sparkle, SpeakerHigh, SpeakerSlash, X } from '@phosphor-icons/react';
import { Lexicon, RhymeAnalysis, RhymeMark, RhymeSession, StudioWord } from '@/lib/studio/rhyme-engine';
import { StableTranscript, TranscriptTrail, transcriptRows } from '@/lib/studio/transcript';
import { DEMO_LINES, PERFORMANCES } from '@/lib/studio/demo';
import { StudioBeat } from '@/lib/studio/audio';
import { LiveSpeech, speechCapabilities } from '@/lib/studio/speech';
import { alignPronunciation, pronunciationWords, HeardPhone, SpokenSound } from '@/lib/studio/pronunciation';
import PerformancePlayer, { PerformanceControl } from './PerformancePlayer';
import AudioWaveform from './AudioWaveform';
import SpeechParticles from './SpeechParticles';

type Source = 'demo' | 'microphone' | 'performance' | 'file';
type Phase = 'ready' | 'starting' | 'listening' | 'processing' | 'paused' | 'complete';
const EMPTY_ANALYSIS: RhymeAnalysis = { marks: {}, families: [] };
const COLORS = ['#5ce2c7', '#d0b7f4', '#f1d58e', '#f1b1c5', '#a6c9f2', '#efbe99', '#9bddd6', '#d7d69b', '#bebdf3', '#e2aca0', '#b3d3a4', '#ecb4dc'];
let dictionaryPromise: Promise<Lexicon> | null = null;

function getLexicon() {
  if (!dictionaryPromise) dictionaryPromise = fetch('/api/rhymes/lexicon').then(response => {
    if (!response.ok) throw new Error('The rhyme dictionary could not load. Reload the studio to try again.');
    return response.json() as Promise<Lexicon>;
  }).catch(error => { dictionaryPromise = null; throw error; });
  return dictionaryPromise;
}

function timeLabel(seconds: number) {
  return Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + Math.floor(seconds % 60).toString().padStart(2, '0');
}

const LyricWord = memo(function LyricWord({ word, mark, dimmed }: { word: StudioWord; mark?: RhymeMark; dimmed: boolean }) {
  return <span className={'studio-word' + (!word.settled ? ' is-provisional' : '') + (mark ? ' is-linked' : '') + (mark?.near ? ' is-near' : '') + (dimmed ? ' is-dimmed' : '')}
    style={{ '--rhyme-color': mark ? COLORS[mark.color] : 'transparent', '--formation-delay': (word.formationDelay || 0) + 'ms', '--highlight-delay': (word.formationDelay || 0) + 'ms' } as CSSProperties}
    onAnimationEnd={event => { if (event.animationName === 'studio-word-arrive') event.currentTarget.style.setProperty('--highlight-delay', '0ms'); }}
    data-word-id={word.id} data-word-phase={word.settled ? 'ink' : 'dust'} data-published-at={word.settled ? word.at.toFixed(3) : undefined} data-rhyme-family={mark?.familyId} data-pronunciation={word.spoken?.source} aria-hidden={!word.settled || undefined}>
    {mark && <span className="studio-marker" aria-hidden="true" />}
    <span className="studio-word-text">{word.text}</span>
  </span>;
}, (a, b) => a.word.id === b.word.id && a.word.text === b.word.text && a.word.settled === b.word.settled && a.word.spoken?.phones === b.word.spoken?.phones && a.mark?.familyId === b.mark?.familyId && a.mark?.color === b.mark?.color && a.mark?.near === b.mark?.near && a.dimmed === b.dimmed);

export default function LiveStudio() {
  const [source, setSource] = useState<Source>('demo');
  const [performanceId, setPerformanceId] = useState(PERFORMANCES[0].id);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const [words, setWords] = useState<StudioWord[]>([]);
  const [analysis, setAnalysis] = useState<RhymeAnalysis>(EMPTY_ANALYSIS);
  const [tempo, setTempo] = useState(92);
  const [volume, setVolume] = useState(0.45);
  const [nearRhymes, setNearRhymes] = useState(true);
  const [dictionaryReady, setDictionaryReady] = useState(false);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(0);
  const [beatPosition, setBeatPosition] = useState(0);
  const [following, setFollowing] = useState(true);
  const [pendingWords, setPendingWords] = useState(0);
  const [previewWords, setPreviewWords] = useState<StudioWord[]>([]);
  const [soundState, setSoundState] = useState<'loading' | 'ready' | 'unavailable' | ''>('');
  const [soundMb, setSoundMb] = useState(0);
  const [focusedFamily, setFocusedFamily] = useState<string | null>(null);
  const [micAvailable, setMicAvailable] = useState(true);
  const [tapCount, setTapCount] = useState(0);
  const [quality, setQuality] = useState<'moonshine-medium' | 'moonshine-small' | 'accurate' | 'fast'>('moonshine-small');
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [downloadMb, setDownloadMb] = useState(0);
  const [backend, setBackend] = useState('');
  const [inferenceMs, setInferenceMs] = useState(0);
  const [fileName, setFileName] = useState('');
  const [panel, setPanel] = useState<'source' | 'settings' | 'rhymes'>('source');
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDialogElement>(null);
  const audioFile = useRef<File | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  const trail = useRef(new TranscriptTrail());
  const published = useRef(new StableTranscript());
  const rhymeSession = useRef(new RhymeSession());
  const viewportRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const wordsRef = useRef<StudioWord[]>([]);
  const spoken = useRef(new Map<string, SpokenSound>());
  const lexicon = useRef<Lexicon | null>(null);
  const beat = useRef<StudioBeat | null>(null);
  const speech = useRef<LiveSpeech | null>(null);
  const player = useRef<PerformanceControl | null>(null);
  const playerPlaying = useRef(false);
  const externalPerformance = useRef(false);
  const clockRef = useRef(0);
  const beatRef = useRef(0);
  const runningRef = useRef(false);
  const sourceRef = useRef<Source>('demo');
  const tempoRef = useRef(92);
  const nearRef = useRef(true);
  const demoCursor = useRef(0);
  const previousSourceTime = useRef<number | null>(null);
  const lastResult = useRef(0);
  const linesRef = useRef<HTMLDivElement>(null);
  const taps = useRef<number[]>([]);
  const mounted = useRef(true);
  const sourceGeneration = useRef(0);
  const currentPerformance = PERFORMANCES.find(value => value.id === performanceId)!;

  const demoEvents = useMemo(() => DEMO_LINES.flatMap((line, lineIndex) => {
    const parts = line.split(' ');
    return parts.map((word, wordIndex) => ({
      beat: 4 + lineIndex * 4 + (wordIndex / parts.length) * 3.75,
      segment: 'demo-' + lineIndex,
      text: parts.slice(0, wordIndex + 1).join(' '),
      final: wordIndex === parts.length - 1
    }));
  }), []);

  const ingest = useCallback((id: string, text: string, final: boolean) => {
    const snapshot = trail.current.update(id, text, final, clockRef.current);
    const next = published.current.update(snapshot, clockRef.current, sourceRef.current === 'demo');
    setPendingWords(next.pending);
    setPreviewWords(next.preview.map(word=>({...word,settled:false})));
    if (next.words.length !== wordsRef.current.length) {
      const enriched = next.words.map(word=>spoken.current.has(word.id)?{...word,spoken:spoken.current.get(word.id)}:word);
      wordsRef.current = enriched;
      setWords(enriched);
      if (lexicon.current) setAnalysis(rhymeSession.current.update(enriched, lexicon.current, nearRef.current));
    }
    lastResult.current = performance.now();
  }, []);

  const hearPronunciation = useCallback((id: string, phones: HeardPhone[], text: string) => {
    if(!lexicon.current)return;
    const segment=wordsRef.current.filter(word=>word.segment===id);
    const full=pronunciationWords(segment,text,lexicon.current);
    const heard=alignPronunciation(full,phones,lexicon.current);
    for(const id of heard.keys())if(!segment.some(word=>word.id===id))heard.delete(id);
    if(!heard.size)return;
    heard.forEach((value,key)=>spoken.current.set(key,value));
    const enriched=wordsRef.current.map(word=>spoken.current.has(word.id)?{...word,spoken:spoken.current.get(word.id)}:word);
    wordsRef.current=enriched;setWords(enriched);
    setAnalysis(rhymeSession.current.update(enriched,lexicon.current,nearRef.current));
  },[]);

  const clearTrail = useCallback(() => {
    wordsRef.current = trail.current.clear();
    published.current.clear(); rhymeSession.current.clear();
    spoken.current.clear();setPreviewWords([]);
    setWords([]); setPendingWords(0); setAnalysis(EMPTY_ANALYSIS); setFocusedFamily(null);
    followingRef.current = true; setFollowing(true);
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
  }, []);

  const reviewTranscript = useCallback(() => {
    if (!wordsRef.current.length) return;
    followingRef.current = false; setFollowing(false);
  }, []);
  const backToLive = () => { followingRef.current = true; setFollowing(true); };

  const setActive = useCallback((active: boolean) => {
    runningRef.current = active;
    previousSourceTime.current = null;
    setRunning(active);
  }, []);

  const stop = useCallback(() => {
    sourceGeneration.current++;
    setActive(false);
    speech.current?.close();
    void beat.current?.pause();
    player.current?.pause();
    setAnalyser(null);
    setPhase('paused'); setPendingWords(0);setPreviewWords([]);
  }, [setActive]);

  const reset = useCallback(() => {
    stop();
    const oldBeat = beat.current;
    beat.current = null;
    void oldBeat?.close();
    clearTrail();
    clockRef.current = 0; beatRef.current = 0; demoCursor.current = 0;
    setClock(0); setBeatPosition(0); setPhase('ready'); setError('');
    setDownloadMb(0); setInferenceMs(0);
  }, [clearTrail, stop]);

  const chooseSource = (next: Source, id?: string) => {
    sourceGeneration.current++;
    reset();
    sourceRef.current = next;
    externalPerformance.current = false;
    setSource(next);
    if (id) setPerformanceId(id);
  };

  const openVoiceSample = async () => {
    try {
      const response = await fetch('/studio/voice-sample.wav', { cache: 'no-store' });
      if (!response.ok) throw new Error('The voice sample could not load.');
      const file = new File([await response.blob()], 'Voice sample.wav', { type: 'audio/wav' });
      chooseSource('file'); audioFile.current = file; setFileName('Voice sample');
    } catch { setError('The voice sample could not load. Try again.'); }
  };

  const start = async () => {
    if (phase === 'starting') { stop(); return; }
    if (runningRef.current) { stop(); return; }
    if (!lexicon.current) { setError('The rhyme dictionary is still loading. Try again in a moment.'); return; }
    setError('');
    if (phase === 'complete') reset();
    const generation = sourceGeneration.current;
    if (sourceRef.current === 'demo') {
      if (!beat.current) beat.current = new StudioBeat();
      beat.current.setVolume(volume);
      try {
        await beat.current.start(tempoRef.current);
        if (!mounted.current || generation !== sourceGeneration.current) return;
        setAnalyser(beat.current.analyser);
        setActive(true); setPhase('processing');
      } catch { setError('Audio could not start. Press play again to enable sound.'); }
      return;
    }
    const liveSource = sourceRef.current;
    if (liveSource === 'performance' && !playerPlaying.current) externalPerformance.current = true;
    speech.current?.close();
    const liveSpeech = new LiveSpeech({
      pronunciation: (id, phones, text) => { if (mounted.current && generation === sourceGeneration.current) hearPronunciation(id,phones,text); },
      soundState: (state, megabytes) => { if (mounted.current && generation === sourceGeneration.current) {setSoundState(state);setSoundMb(megabytes || 0);} },
      audio: value => { if (mounted.current && generation === sourceGeneration.current) setAnalyser(value); },
      progress: value => { if (mounted.current && generation === sourceGeneration.current) setDownloadMb(value); },
      backend: value => { if (mounted.current && generation === sourceGeneration.current) setBackend(value); },
      timing: value => { if (mounted.current && generation === sourceGeneration.current) setInferenceMs(value); },
      transcript: (id, text, final) => { if (mounted.current && generation === sourceGeneration.current) ingest(id, text, final); },
      state: state => {
        if (!mounted.current || generation !== sourceGeneration.current) return;
        if (state !== 'stopped') setPhase(state);
      },
      error: message => { if (mounted.current && generation === sourceGeneration.current) { setError(message); setActive(false); setPhase('paused'); } },
      ended: () => {
        if (!mounted.current || generation !== sourceGeneration.current) return;
        if (liveSource === 'file') {
          // Finish the current particle formation without holding back recognized words.
          const delay = 1100;
          setTimeout(() => { if (mounted.current && generation === sourceGeneration.current) { setActive(false); setPhase('complete'); } }, delay);
        } else { setActive(false); setPhase('paused'); }
      }
    });
    speech.current = liveSpeech;
    setPhase('starting');
    try {
      const started = await liveSpeech.start(liveSource === 'microphone' ? 'microphone' : liveSource === 'file' ? 'file' : 'tab', quality === 'fast' || quality === 'moonshine-small' ? 'fast' : 'accurate', audioFile.current, quality.startsWith('moonshine') ? 'moonshine' : 'whisper');
      if (!started || !mounted.current || generation !== sourceGeneration.current) return;
      setActive(true);
      if (liveSource === 'performance' && !externalPerformance.current) player.current?.play();
    } catch (failure) {
      liveSpeech.close();
      if (generation !== sourceGeneration.current) return;
      setError(failure instanceof Error ? failure.message : 'Audio access could not start.');
      setPhase('paused'); setActive(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    setMicAvailable(speechCapabilities().microphone);
    getLexicon().then(value => { if (mounted.current) { lexicon.current = value; setDictionaryReady(true); } })
      .catch(failure => { if (mounted.current) setError(failure.message); });
    return () => {
      mounted.current = false;
      speech.current?.close();
      void beat.current?.close();
    };
  }, []);

  useEffect(() => { tempoRef.current = tempo; beat.current?.setTempo(tempo); }, [tempo]);
  useEffect(() => {
    nearRef.current = nearRhymes;
    if (lexicon.current && wordsRef.current.length) setAnalysis(rhymeSession.current.update(wordsRef.current, lexicon.current, nearRhymes));
  }, [nearRhymes]);
  useEffect(() => {
    if (focusedFamily && !analysis.families.some(family => family.id === focusedFamily)) setFocusedFamily(null);
  }, [analysis.families, focusedFamily]);
  useEffect(() => { beat.current?.setVolume(volume); player.current?.volume(volume); }, [volume]);

  useEffect(() => {
    let frame = 0;
    let lastPaint = 0;
    const tick = (now: number) => {
      if (runningRef.current) {
        const mode = sourceRef.current;
        const followPlayer = mode === 'performance' && player.current && !externalPerformance.current;
        const sourceTime = mode === 'demo' ? (beat.current?.time || 0)
          : followPlayer ? player.current!.time() : now / 1000;
        let delta = previousSourceTime.current === null ? 0 : sourceTime - previousSourceTime.current;
        previousSourceTime.current = sourceTime;
        if (mode === 'performance' && (delta < -0.8 || delta > 1.5)) {
          clearTrail(); delta = 0;
        }
        if (followPlayer && !playerPlaying.current) delta = 0;
        delta = Math.max(0, Math.min(delta, 0.25));
        clockRef.current += delta;
        beatRef.current += delta * tempoRef.current / 60;
        if (mode === 'demo') {
          while (demoCursor.current < demoEvents.length && demoEvents[demoCursor.current].beat <= beatRef.current) {
            const event = demoEvents[demoCursor.current++];
            ingest(event.segment, event.text, event.final);
          }
          if (beatRef.current >= 4 + DEMO_LINES.length * 4 + 2) {
            runningRef.current = false; setRunning(false); setPhase('complete'); void beat.current?.pause();
          }
        }
      } else previousSourceTime.current = null;

      if (now - lastPaint >= 32) {
        const view = viewportRef.current;
        const nodes = Array.from(linesRef.current?.children || []) as HTMLElement[];
        const last = nodes[nodes.length - 1];
        if (view && last && followingRef.current) {
          const latest = wordsRef.current[wordsRef.current.length - 1];
          const drift = Math.min(40, Math.max(0, clockRef.current - (latest?.at || 0)) * tempoRef.current / 60 * 7);
          const target = Math.max(0, Math.min(view.scrollHeight - view.clientHeight, last.offsetTop + last.offsetHeight + 110 + drift - view.clientHeight));
          const distance = target - view.scrollTop;
          view.scrollTop = Math.abs(distance) < 1 ? target : view.scrollTop + distance * .18;
          for (const node of nodes.slice(-18)) {
            const age = Math.max(0, (view.scrollTop + view.clientHeight - 135 - node.offsetTop - node.offsetHeight) / 100);
            node.style.opacity = String(Math.max(.12, 1 - age * .11));
          }
        }
        setClock(clockRef.current); setBeatPosition(beatRef.current);
        lastPaint = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clearTrail, demoEvents, ingest]);

  const rows = useMemo(() => transcriptRows(words), [words]);
  const visibleRows = useMemo(() => transcriptRows([...words,...previewWords]), [words,previewWords]);
  const families = analysis.families.slice(-8);
  const onPlayerControl = useCallback((control: PerformanceControl | null) => { player.current = control; previousSourceTime.current = null; }, []);
  const onPlayerPlaying = useCallback((playing: boolean) => { playerPlaying.current = playing; }, []);
  const onExternalOpen = useCallback(() => { externalPerformance.current = true; previousSourceTime.current = null; }, []);
  const countIn = source === 'demo' && running && beatPosition < 4;
  const processing = running && (source === 'demo' || phase === 'processing' || performance.now() - lastResult.current < 900);
  const statusText = !dictionaryReady ? 'Preparing rhyme engine' : phase === 'starting' ? (quality.startsWith('moonshine') ? 'Preparing Moonshine streaming' : 'Preparing Whisper') + (downloadMb ? ' · ' + downloadMb + ' MB' : '') : countIn ? 'Count in…' : running ? phase === 'processing' && source !== 'demo' ? 'Transcribing on device' : processing ? 'Finding rhymes' : 'Listening' : phase === 'complete' ? 'Session complete' : words.length ? 'Paused' : 'Ready when you are';
  const sourceLabel = source === 'demo' ? 'Demo' : source === 'microphone' ? 'My mic' : source === 'file' ? 'Audio file' : 'Freestyles';
  const openPanel = (next: typeof panel) => {
    setPanel(next);
    setPanelOpen(true);
    panelRef.current?.showModal();
  };

  const tapTempo = () => {
    const now = performance.now();
    if (taps.current.length && now - taps.current[taps.current.length - 1] > 2000) taps.current = [];
    taps.current.push(now); taps.current = taps.current.slice(-6);
    setTapCount(taps.current.length);
    if (taps.current.length >= 3) {
      const intervals = taps.current.slice(1).map((value, index) => value - taps.current[index]);
      const average = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setTempo(Math.max(55, Math.min(180, Math.round(60000 / average))));
    }
  };

  const downloadTranscript = () => {
    const text = rows.map(row => row.words.map(word => word.text).join(' ')).join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'llmc-session.txt'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <main className="live-studio ph-no-capture">
    <input ref={fileInput} type="file" accept="audio/*" hidden onChange={event => {
      const file = event.target.files?.[0];
      if (file) { chooseSource('file'); audioFile.current = file; setFileName(file.name); }
      event.target.value = '';
    }} />
    <header className="studio-header">
      {/* Full navigation leaves the studio's isolated audio environment. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="studio-brand" aria-label="Back to LLMC writing game"><ArrowLeft size={15} /><strong>LLMC</strong><span>LIVE</span></a>
      <div className="studio-controls">
        <button className="studio-source-switch" onClick={() => openPanel('source')} aria-haspopup="dialog" aria-expanded={panelOpen && panel === 'source'} aria-label={'Audio source: ' + sourceLabel}>
          {source === 'microphone' ? <Microphone size={16} /> : source === 'demo' ? <Sparkle size={16} /> : <Headphones size={16} />}<span>{sourceLabel}</span><CaretDown size={12} />
        </button>
        <button className="studio-play-button" onClick={() => void start()} disabled={!dictionaryReady} aria-label={phase === 'starting' ? 'Cancel listening' : running ? 'Pause session' : source === 'demo' ? 'Play demo' : source === 'file' ? 'Play audio file' : 'Start listening'}>{running || phase === 'starting' ? <Pause weight="fill" size={16} /> : <Play weight="fill" size={16} />}</button>
      </div>
      <div className="studio-actions">
        <button className={'studio-rhymes-button' + (focusedFamily ? ' has-focus' : '')} onClick={() => openPanel('rhymes')} aria-haspopup="dialog" aria-expanded={panelOpen && panel === 'rhymes'} aria-label={'Rhyme relationships: ' + analysis.families.length + ' families'}><Sparkle size={17} /><span>Rhymes</span><small>{analysis.families.length}</small></button>
        <button className="studio-icon-button" onClick={() => openPanel('settings')} aria-haspopup="dialog" aria-expanded={panelOpen && panel === 'settings'} aria-label="Studio settings"><FadersHorizontal size={20} /></button>
      </div>
    </header>

    <section className="studio-main-panel" aria-label="Live rhyme transcript">
      <div className="studio-session-header"><span><span className={'studio-session-dot' + (running ? ' is-running' : '')} />{source === 'demo' ? 'DEMO SESSION' : source === 'microphone' ? 'YOUR FREESTYLE' : source === 'file' ? fileName : currentPerformance.artist.toUpperCase()}</span><span>{words.length} words</span></div>
      <div className={'studio-stage' + (running ? ' is-active' : '') + (!following ? ' is-reviewing' : '')} data-testid="rhyme-stage">
        <div ref={viewportRef} className="studio-trail" role="region" tabIndex={0} aria-label="Transcript" aria-live="off" onWheel={reviewTranscript} onTouchStart={reviewTranscript} onPointerDown={reviewTranscript} onKeyDown={event => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) reviewTranscript(); }}>
          <div ref={linesRef} className="studio-lines">
            {visibleRows.map(row => <div key={row.id} data-row-id={row.id} className="studio-line">
              {row.words.map(word => <LyricWord key={word.id} word={word} mark={analysis.marks[word.id]} dimmed={Boolean(focusedFamily && analysis.marks[word.id]?.familyId !== focusedFamily)} />)}
            </div>)}
          </div>
        </div>
        <SpeechParticles analyser={analyser} active={running || phase === 'starting'} busy={phase === 'processing' || phase === 'starting'} pending={pendingWords} following={following} wordRoot={linesRef} viewport={viewportRef} />
        {!following && <button className="studio-back-to-live" onClick={backToLive}><ArrowDown size={15} />Back to live</button>}
        {!words.length && !running && phase !== 'starting' && <div className="studio-empty-verse"><p>{source === 'demo' ? 'Press play. See the rhymes.' : 'Your next line starts here.'}</p></div>}
      </div>
      {error && <div className="studio-error" role="alert"><span>{error}</span><button className="studio-icon-button" aria-label="Dismiss message" onClick={() => setError('')}><X size={18} /></button></div>}
      <footer className="studio-feedback">
        <div className="studio-processing" role="status" aria-live="polite">{(!dictionaryReady || phase === 'starting') && <CircleNotch size={14} className="studio-spin" />}<span>{statusText}</span></div>
        <AudioWaveform analyser={analyser} active={running || phase === 'starting'} />
        <div className="studio-timing"><span>{tempo} BPM</span><time className="studio-time">{timeLabel(clock)}</time></div>
      </footer>
    </section>

    <dialog ref={panelRef} className="studio-drawer" aria-labelledby="studio-drawer-title" onClose={() => setPanelOpen(false)} onClick={event => { if (event.target === event.currentTarget) panelRef.current?.close(); }}>
      <div className="studio-drawer-heading"><h2 id="studio-drawer-title">{panel === 'source' ? 'Audio source' : panel === 'settings' ? 'Studio settings' : 'Rhyme relationships'}</h2><button className="studio-icon-button" aria-label="Close panel" onClick={() => panelRef.current?.close()}><X size={20} /></button></div>
      <div className="studio-drawer-content">
        <div hidden={panel !== 'source'}>
          <div className="studio-source-tabs" role="group" aria-label="Audio source">
            <button aria-pressed={source === 'demo'} onClick={() => chooseSource('demo')}><Sparkle size={17} />Demo</button>
            <button aria-pressed={source === 'microphone'} onClick={() => chooseSource('microphone')}><Microphone size={17} />My mic</button>
            <button aria-pressed={source === 'performance' || source === 'file'} onClick={() => chooseSource('performance')}><Headphones size={17} />Freestyles</button>
          </div>
          {source === 'demo' && <section className="studio-source-description"><h3>The midnight session</h3><p>An original beat and scripted verse to try the scrolling highlighter.</p><span className="studio-source-badge">Motion demo · {tempo} BPM</span></section>}
          {source === 'microphone' && <section className="studio-source-description"><h3>Your freestyle</h3><p>Speak into your microphone. The waveform follows your voice; words and rhymes follow as they are recognized.</p><span className="studio-source-badge">Free · On device · English</span><br /><button className="studio-file-button" onClick={() => void openVoiceSample()}>Try voice sample</button>{!micAvailable && <p className="studio-browser-note">Use a current desktop browser for live listening.</p>}</section>}
          {source === 'file' && <section className="studio-source-description"><h3>{fileName}</h3><p>Play and transcribe this clip on your device.</p><button className="studio-file-button" onClick={() => fileInput.current?.click()}>Choose another audio file</button></section>}
          {source === 'performance' && <section className="studio-performance-library">
            {PERFORMANCES.map(item => <button key={item.id} className={'studio-performance' + (item.id === performanceId ? ' is-selected' : '')} onClick={() => chooseSource('performance', item.id)}>
              <span className="studio-performance-art" style={{ backgroundImage: `url(https://i.ytimg.com/vi/${item.id}/hqdefault.jpg)` }} /><span><strong>{item.artist}</strong><small>{item.title} · {item.year}</small></span>{item.id === performanceId ? <Check size={16} /> : <Play size={15} />}
            </button>)}
            <PerformancePlayer performance={currentPerformance} onControl={onPlayerControl} onPlaying={onPlayerPlaying} onExternalOpen={onExternalOpen} />
            <p className="studio-tab-instruction">Close this panel, press play, and select the performance tab with <strong>Share tab audio</strong> enabled.</p>
            <a href={currentPerformance.url} className="studio-official-link" target="_blank" rel="noreferrer" onClick={onExternalOpen}>Open official performance<ArrowUpRight size={14} /></a>
          </section>}
          {source !== 'file' && <button className="studio-file-button" onClick={() => fileInput.current?.click()}>Open audio file</button>}
          <p className="studio-source-footnote"><span className={dictionaryReady ? 'studio-ready-dot' : 'studio-loading-dot'} />{dictionaryReady ? 'Rhyme engine ready' : 'Loading pronunciations'}</p>
        </div>

        <div hidden={panel !== 'settings'}>
          {source !== 'demo' && <div className="studio-voice-options"><label htmlFor="studio-quality">Voice engine</label><select id="studio-quality" value={quality} disabled={running || phase === 'starting'} onChange={event => setQuality(event.target.value as typeof quality)}><option value="moonshine-medium">Moonshine · Live accuracy</option><option value="moonshine-small">Moonshine · Live speed</option><option value="accurate">Whisper · Accuracy</option><option value="fast">Whisper · Speed</option></select><p>Free, local processing. First use downloads voice and sound models. Audio stays on your device. {backend && 'Running on ' + backend + '.'}</p>{inferenceMs > 0 && <small>Last recognition pass: {(inferenceMs / 1000).toFixed(1)}s</small>}<p role="status">{soundState === 'loading' ? 'Preparing pronunciation matching' + (soundMb ? ' · ' + soundMb + ' MB' : '') : soundState === 'ready' ? 'Matching your actual delivery · ' + words.filter(word=>word.spoken).length + ' words heard' : soundState === 'unavailable' ? 'Sound model unavailable. Using dictionary pronunciations for this session; restart to try again.' : 'Pronunciation matching starts with your audio.'}</p></div>}
          <div className="studio-tuning">
            <div className="studio-tuning-heading"><label htmlFor="studio-tempo">Scroll tempo</label><button onClick={tapTempo} className="studio-tap">{tapCount > 0 && tapCount < 3 ? 'Tap ' + (3 - tapCount) + ' more' : 'Tap to match'}</button></div>
            <div className="studio-tempo-row"><input id="studio-tempo" type="range" min="55" max="180" value={tempo} onChange={event => setTempo(Number(event.target.value))} /><span className="studio-tempo-value">{tempo}<small>BPM</small></span></div>
            <label className="studio-near-toggle"><input type="checkbox" checked={nearRhymes} onChange={event => setNearRhymes(event.target.checked)} /><span>Include possible rhymes</span></label>
          </div>
          <div className="studio-volume"><button className="studio-icon-button" aria-label={volume ? 'Mute' : 'Unmute'} onClick={() => setVolume(volume ? 0 : 0.45)}>{volume ? <SpeakerHigh size={20} /> : <SpeakerSlash size={20} />}</button><label htmlFor="studio-volume">Playback volume</label><input id="studio-volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={event => setVolume(Number(event.target.value))} /></div>
          <div className="studio-session-actions"><button disabled={!words.length} onClick={downloadTranscript}><DownloadSimple size={18} />Save transcript</button><button onClick={() => { reset(); panelRef.current?.close(); }}><ArrowCounterClockwise size={18} />New session</button></div>
        </div>

        <div hidden={panel !== 'rhymes'}>
          <p className="studio-rhyme-description">Matching sounds share a color. Tap a family to follow it through your verse.</p>
          {focusedFamily && <button className="studio-file-button" onClick={() => { setFocusedFamily(null); panelRef.current?.close(); }}>Show all words</button>}
          <div className="studio-family-list">
            {families.length ? families.map(family => <button key={family.id} className={'studio-family' + (focusedFamily === family.id ? ' is-focused' : '')} style={{ '--rhyme-color': COLORS[family.color] } as CSSProperties} aria-pressed={focusedFamily === family.id} onClick={() => { setFocusedFamily(focusedFamily === family.id ? null : family.id); panelRef.current?.close(); }}>
              <span className="studio-family-swatch" /><span><strong>{family.examples.join(' / ')}</strong><small>{family.kind === 'phrase' ? 'Across words' : family.kind === 'multisyllable' ? family.syllables + '-syllable rhyme' : family.kind === 'near' ? 'Possible rhyme' : 'Matching sound'}</small></span>
            </button>) : <p className="studio-no-families">Your rhyme connections will appear here.</p>}
          </div>
          <div className="studio-ink-key"><span className="studio-key-solid" />Rhyme<span className="studio-key-dashed" />Possible rhyme</div>
        </div>
      </div>
    </dialog>
  </main>;
}
