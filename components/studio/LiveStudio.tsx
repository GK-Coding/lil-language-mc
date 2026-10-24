'use client';

import Link from 'next/link';
import { CSSProperties, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, CircleNotch, DownloadSimple, Headphones, Microphone, Pause, Play, Sparkle, SpeakerHigh, SpeakerSlash, Waveform, X } from '@phosphor-icons/react';
import { analyzeRhymes, Lexicon, RhymeAnalysis, RhymeMark, StudioWord } from '@/lib/studio/rhyme-engine';
import { TranscriptTrail, transcriptRows } from '@/lib/studio/transcript';
import { DEMO_LINES, PERFORMANCES } from '@/lib/studio/demo';
import { StudioBeat } from '@/lib/studio/audio';
import { LiveSpeech, speechCapabilities } from '@/lib/studio/speech';
import PerformancePlayer, { PerformanceControl } from './PerformancePlayer';
import AudioWaveform from './AudioWaveform';

type Source = 'demo' | 'microphone' | 'performance' | 'file';
type Phase = 'ready' | 'starting' | 'listening' | 'processing' | 'paused' | 'complete';
const EMPTY_ANALYSIS: RhymeAnalysis = { marks: {}, families: [] };
const COLORS = ['#b6edb8', '#d0b7f4', '#f1d58e', '#f1b1c5', '#a6c9f2', '#efbe99', '#9bddd6', '#d7d69b', '#bebdf3', '#e2aca0', '#b3d3a4', '#ecb4dc'];
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
    style={{ '--rhyme-color': mark ? COLORS[mark.color] : 'transparent' } as CSSProperties} data-word-id={word.id} data-rhyme-family={mark?.familyId}>
    {mark && <span key={mark.familyId} className="studio-marker" aria-hidden="true" />}
    <span className="studio-word-text">{word.text}</span>
  </span>;
}, (a, b) => a.word.id === b.word.id && a.word.text === b.word.text && a.word.settled === b.word.settled && a.mark?.familyId === b.mark?.familyId && a.mark?.color === b.mark?.color && a.mark?.near === b.mark?.near && a.dimmed === b.dimmed);

export default function LiveStudio() {
  const [source, setSource] = useState<Source>('demo');
  const [performanceId, setPerformanceId] = useState(PERFORMANCES[0].id);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const [words, setWords] = useState<StudioWord[]>([]);
  const [analysis, setAnalysis] = useState<RhymeAnalysis>(EMPTY_ANALYSIS);
  const [tempo, setTempo] = useState(92);
  const [volume, setVolume] = useState(0.45);
  const [inkDelay, setInkDelay] = useState(250);
  const [nearRhymes, setNearRhymes] = useState(true);
  const [dictionaryReady, setDictionaryReady] = useState(false);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(0);
  const [beatPosition, setBeatPosition] = useState(0);
  const [scroll, setScroll] = useState(0);
  const [focusedFamily, setFocusedFamily] = useState<string | null>(null);
  const [micAvailable, setMicAvailable] = useState(true);
  const [tapCount, setTapCount] = useState(0);
  const [quality, setQuality] = useState<'accurate' | 'fast'>('accurate');
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [downloadMb, setDownloadMb] = useState(0);
  const [backend, setBackend] = useState('');
  const [inferenceMs, setInferenceMs] = useState(0);
  const [fileName, setFileName] = useState('');
  const audioFile = useRef<File | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  const trail = useRef(new TranscriptTrail());
  const wordsRef = useRef<StudioWord[]>([]);
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
  const inkDelayRef = useRef(250);
  const nearRef = useRef(true);
  const demoCursor = useRef(0);
  const previousSourceTime = useRef<number | null>(null);
  const lastResult = useRef(0);
  const scanVersion = useRef('');
  const familyColors = useRef(new Map<string, number>());
  const scrollRef = useRef(0);
  const linesRef = useRef<HTMLDivElement>(null);
  const previousOffsets = useRef(new Map<string, number>());
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
    const updated = trail.current.update(id, text, final, clockRef.current);
    wordsRef.current = updated;
    setWords(updated);
    lastResult.current = performance.now();
  }, []);

  const clearTrail = useCallback(() => {
    wordsRef.current = trail.current.clear();
    setWords([]);
    setAnalysis(EMPTY_ANALYSIS);
    setFocusedFamily(null);
    scanVersion.current = '';
    familyColors.current.clear();
    previousOffsets.current.clear();
    scrollRef.current = 0;
    setScroll(0);
  }, []);

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
    setPhase('paused');
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
          // Let the final words and their ink finish arriving after audio playback ends.
          const lastWord = wordsRef.current[wordsRef.current.length - 1];
          const delay = Math.max(0, (lastWord?.at || 0) - clockRef.current) * 1000 + inkDelayRef.current + 700;
          setTimeout(() => { if (mounted.current && generation === sourceGeneration.current) { setActive(false); setPhase('complete'); } }, delay);
        } else { setActive(false); setPhase('paused'); }
      }
    });
    speech.current = liveSpeech;
    setPhase('starting');
    try {
      const started = await liveSpeech.start(liveSource === 'microphone' ? 'microphone' : liveSource === 'file' ? 'file' : 'tab', quality, audioFile.current);
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
  useEffect(() => { inkDelayRef.current = inkDelay; scanVersion.current = ''; }, [inkDelay]);
  useEffect(() => { nearRef.current = nearRhymes; scanVersion.current = ''; }, [nearRhymes]);
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
        const rows = transcriptRows(wordsRef.current);
        if (rows.length) {
          const latest = rows[rows.length - 1].words[0];
          const drift = Math.min(66, Math.max(0, clockRef.current - latest.at) * tempoRef.current / 60 * 12);
          const nodes = Array.from(linesRef.current?.children || []) as HTMLElement[];
          const first = nodes[0];
          if (first && previousOffsets.current.has(first.dataset.rowId || '')) {
            scrollRef.current += first.offsetTop - previousOffsets.current.get(first.dataset.rowId || '')!;
          }
          const target = (nodes[nodes.length - 1]?.offsetTop || 0) + drift;
          scrollRef.current += (target - scrollRef.current) * 0.07;
          previousOffsets.current.clear();
          for (const node of nodes) {
            previousOffsets.current.set(node.dataset.rowId || '', node.offsetTop);
            const age = (scrollRef.current - node.offsetTop) / Math.max(80, node.offsetHeight + 28);
            node.style.opacity = String(Math.max(.025, 1 - Math.max(0, age - .25) * .3));
          }
          setScroll(scrollRef.current);
        }
        setClock(clockRef.current); setBeatPosition(beatRef.current);
        lastPaint = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clearTrail, demoEvents, ingest]);

  useEffect(() => {
    const scan = setInterval(() => {
      if (!lexicon.current || !wordsRef.current.length) return;
      const eligible = wordsRef.current.map(word => ({ ...word, settled: word.settled && clockRef.current - word.at >= inkDelayRef.current / 1000 }));
      // Delay is visual only: the speech service's arrival time is never treated as vocal timing.
      const version = eligible.map(word => word.id + ':' + word.text + (word.settled ? '1' : '0')).join('|');
      if (version === scanVersion.current) return;
      scanVersion.current = version;
      setAnalysis(analyzeRhymes(eligible, lexicon.current, nearRef.current, familyColors.current));
    }, 180);
    return () => clearInterval(scan);
  }, []);

  const rows = useMemo(() => transcriptRows(words), [words]);
  const visibleRows = rows.map((row, index) => ({ ...row, index })).slice(-12);
  const families = analysis.families.slice(-8);
  const onPlayerControl = useCallback((control: PerformanceControl | null) => { player.current = control; previousSourceTime.current = null; }, []);
  const onPlayerPlaying = useCallback((playing: boolean) => { playerPlaying.current = playing; }, []);
  const onExternalOpen = useCallback(() => { externalPerformance.current = true; previousSourceTime.current = null; }, []);
  const activeBeat = Math.floor(beatPosition) % 4;
  const countIn = source === 'demo' && running && beatPosition < 4;
  const processing = running && (source === 'demo' || phase === 'processing' || performance.now() - lastResult.current < 900);
  const statusText = !dictionaryReady ? 'Preparing the rhyme engine' : phase === 'starting' ? 'Preparing local voice engine' + (downloadMb ? ' · ' + downloadMb + ' MB loaded' : '') : countIn ? 'Find the pocket' : running ? phase === 'processing' && source !== 'demo' ? 'Transcribing audio locally' : processing ? 'Finding the rhyme' : 'Listening for your next line' : phase === 'complete' ? 'A verse, made visible' : words.length ? 'Your trail is paused' : 'A little sound. A little magic.';

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
      <Link href="/" className="studio-brand" aria-label="LLMC home">LLMC<span>alpha</span></Link>
      <nav className="studio-mode-nav" aria-label="Game modes"><Link href="/">Writing game</Link><span aria-current="page"><Waveform size={16} /> Live studio</span></nav>
      <Link href="/" className="studio-back"><ArrowLeft size={15} /><span>Back to writing</span></Link>
    </header>

    <div className="studio-workspace">
      <aside className="studio-source-panel">
        <p className="studio-eyebrow">THE LIVE RHYME STUDIO</p>
        <h1>Find your flow.<br /><span>See your sound.</span></h1>
        <p className="studio-intro">Speak freely. Watch your words turn into a living trail of rhymes.</p>

        <div className="studio-source-tabs" role="group" aria-label="Audio source">
          <button aria-pressed={source === 'demo'} onClick={() => chooseSource('demo')}><Sparkle size={17} />Demo</button>
          <button aria-pressed={source === 'microphone'} onClick={() => chooseSource('microphone')}><Microphone size={17} />My mic</button>
          <button aria-pressed={source === 'performance' || source === 'file'} onClick={() => chooseSource('performance')}><Headphones size={17} />Freestyles</button>
        </div>

        {source === 'demo' && <section className="studio-source-description">
          <div className="studio-source-icon"><Waveform size={26} weight="light" /></div>
          <h2>The midnight session</h2>
          <p>An original beat and a scripted verse. A small taste of words becoming patterns.</p>
          <span className="studio-source-badge">Motion demo · {tempo} BPM</span>
        </section>}

        {source === 'microphone' && <section className="studio-source-description">
          <div className="studio-source-icon"><Microphone size={26} weight="light" /></div>
          <h2>This one is yours.</h2>
          <p>Freestyle into your microphone. The waveform follows your input immediately; the words follow as they are recognized.</p>
          <span className="studio-source-badge">On-device recognition · English</span><br /><button className="studio-file-button" onClick={() => void openVoiceSample()}>Try voice sample</button>
          {!micAvailable && <p className="studio-browser-note">Open this studio in a current desktop browser for live listening.</p>}
        </section>}

        {source === 'file' && <section className="studio-source-description"><h2>{fileName}</h2><p>Play this clip through the local voice engine. Audio and recognition stay on your device.</p><button className="studio-file-button" onClick={() => fileInput.current?.click()}>Choose another audio file</button></section>}

        {source === 'performance' && <section className="studio-performance-library">
          <p className="studio-small-label">STUDY THE GREATS</p>
          {PERFORMANCES.map(item => <button key={item.id} className={'studio-performance' + (item.id === performanceId ? ' is-selected' : '')} onClick={() => chooseSource('performance', item.id)}>
            <span className="studio-performance-art" style={{ backgroundImage: `url(https://i.ytimg.com/vi/${item.id}/hqdefault.jpg)` }} />
            <span><strong>{item.artist}</strong><small>{item.title} · {item.year}</small></span>
            {item.id === performanceId ? <Check size={16} /> : <Play size={15} />}
          </button>)}
          <PerformancePlayer performance={currentPerformance} onControl={onPlayerControl} onPlaying={onPlayerPlaying} onExternalOpen={onExternalOpen} />
          <p className="studio-tab-instruction">Press Listen, choose the tab playing the performance, and enable <strong>Share tab audio</strong>.</p>
          <button className="studio-file-button" onClick={() => fileInput.current?.click()}>Open audio file</button>
        </section>}

        {source !== 'demo' && <div className="studio-voice-options"><label htmlFor="studio-quality">Voice engine</label><select id="studio-quality" value={quality} disabled={running || phase === 'starting'} onChange={event => setQuality(event.target.value as 'accurate' | 'fast')}><option value="accurate">Accuracy first</option><option value="fast">Speed first</option></select><p>Free, local processing. The first use downloads a voice model. {backend && 'Running on ' + backend + '.'}</p>{inferenceMs > 0 && <small>Last recognition pass: {(inferenceMs / 1000).toFixed(1)}s</small>}</div>}

        <div className="studio-tuning">
          <div className="studio-tuning-heading"><label htmlFor="studio-tempo">Scroll tempo</label><button onClick={tapTempo} className="studio-tap">{tapCount > 0 && tapCount < 3 ? 'Tap ' + (3 - tapCount) + ' more' : 'Tap to match'}</button></div>
          <div className="studio-tempo-row"><input id="studio-tempo" type="range" min="55" max="180" value={tempo} onChange={event => setTempo(Number(event.target.value))} /><span className="studio-tempo-value">{tempo}<small>BPM</small></span></div>
          <div className="studio-tuning-heading"><label htmlFor="studio-delay">Highlighter delay</label><span>{(inkDelay / 1000).toFixed(1)}s</span></div>
          <input id="studio-delay" type="range" min="200" max="1400" step="50" value={inkDelay} onChange={event => setInkDelay(Number(event.target.value))} />
          <label className="studio-near-toggle"><input type="checkbox" checked={nearRhymes} onChange={event => setNearRhymes(event.target.checked)} /><span>Include possible rhymes</span></label>
        </div>
        <p className="studio-source-footnote"><span className={dictionaryReady ? 'studio-ready-dot' : 'studio-loading-dot'} />{dictionaryReady ? 'Rhyme engine ready' : 'Loading pronunciations'}</p>
      </aside>

      <section className="studio-main-panel" aria-label="Live rhyme transcript">
        <div className="studio-session-header"><span><span className={'studio-session-dot' + (running ? ' is-running' : '')} />{source === 'demo' ? 'DEMO SESSION' : source === 'microphone' ? 'YOUR FREESTYLE' : source === 'file' ? 'AUDIO CLIP · LOCAL' : currentPerformance.artist.toUpperCase() + ' · LIVE LISTENING'}</span><span className="studio-time">{timeLabel(clock)}</span></div>

        <div className={'studio-stage' + (running ? ' is-active' : '')} data-testid="rhyme-stage">
          <div className="studio-trail" aria-label="Transcript" aria-live="off">
            <div ref={linesRef} className="studio-lines" style={{ transform: `translate3d(0, ${-scroll}px, 0)` }}>
              {visibleRows.map(row => <div key={row.id} data-row-id={row.id} className="studio-line">
                {row.words.filter(word => word.at <= clock + 0.05).map(word => <LyricWord key={word.id} word={word} mark={analysis.marks[word.id]} dimmed={Boolean(focusedFamily && analysis.marks[word.id]?.familyId !== focusedFamily)} />)}
              </div>)}
            </div>
          </div>
          {!words.length && <div className="studio-empty-verse"><p>Your next line<br /><span>starts something.</span></p></div>}
          <div className={'studio-processing' + (running ? ' is-listening' : '')} role="status" aria-live="polite">
            <AudioWaveform analyser={analyser} active={running || phase === 'starting'} />
            {(!dictionaryReady || phase === 'starting') && <CircleNotch size={18} className="studio-spin" />}
            <span>{statusText}</span>
          </div>
          <div className="studio-stage-caption">{source === 'demo' ? 'Scripted words · real phonetic rhyme matching' : 'Words arrive first. The rhyme follows.'}</div>
        </div>

        {error && <div className="studio-error" role="alert"><span>{error}</span><button aria-label="Dismiss message" onClick={() => setError('')}><X size={16} /></button></div>}

        <div className="studio-transport">
          <div className="studio-transport-primary">
            <button className="studio-play-button" onClick={() => void start()} disabled={!dictionaryReady} aria-label={phase === 'starting' ? 'Cancel listening' : running ? 'Pause session' : source === 'demo' ? 'Play demo' : source === 'file' ? 'Play audio file' : 'Start listening'}>{running || phase === 'starting' ? <Pause weight="fill" size={20} /> : <Play weight="fill" size={20} />}</button>
            <div><strong>{source === 'demo' ? 'The midnight session' : source === 'microphone' ? 'Your freestyle' : source === 'file' ? fileName : currentPerformance.artist + ' · ' + currentPerformance.title}</strong><small>{phase === 'starting' ? 'Preparing on-device recognition · press to cancel' : running ? source === 'demo' ? 'Original instrumental · scripted verse' : 'Listening locally · ' + (backend || 'loading') : phase === 'complete' ? 'Press play to start a fresh trail' : source === 'performance' ? 'Listen to tab audio' : source === 'microphone' ? 'Start listening to your microphone' : source === 'file' ? 'Play and transcribe this audio clip' : 'Press play and watch the rhymes unfold'}</small></div>
          </div>
          <div className="studio-beat-indicator" aria-label={'Tempo ' + tempo + ' beats per minute'}>{[0, 1, 2, 3].map(value => <span key={value} className={running && activeBeat === value ? 'is-current' : ''} />)}<small>{tempo} BPM</small></div>
          <div className="studio-volume"><button aria-label={volume ? 'Mute' : 'Unmute'} onClick={() => setVolume(volume ? 0 : 0.45)}>{volume ? <SpeakerHigh size={19} /> : <SpeakerSlash size={19} />}</button><input type="range" aria-label="Playback volume" min="0" max="1" step="0.01" value={volume} onChange={event => setVolume(Number(event.target.value))} /></div>
        </div>
        <div className="studio-session-footer"><span>{words.length} words <span>·</span> {analysis.families.length} rhyme families</span><div><button disabled={!words.length} onClick={downloadTranscript}><DownloadSimple size={14} />Save transcript</button><button onClick={reset}>New session</button></div></div>
      </section>

      <aside className="studio-rhyme-panel" aria-label="Rhyme relationships">
        <div className="studio-rhyme-heading"><p className="studio-eyebrow">THE CONNECTIONS</p><span>{analysis.families.length.toString().padStart(2, '0')}</span></div>
        <h2>Rhymes leave<br />a little color.</h2>
        <p className="studio-rhyme-description">The same sound gets the same ink. Follow it through your verse.</p>
        <div className="studio-family-list">
          {families.length ? families.map(family => <button key={family.id} className={'studio-family' + (focusedFamily === family.id ? ' is-focused' : '')} style={{ '--rhyme-color': COLORS[family.color] } as CSSProperties} aria-pressed={focusedFamily === family.id} onClick={() => setFocusedFamily(focusedFamily === family.id ? null : family.id)}>
            <span className="studio-family-swatch" />
            <span><strong>{family.examples.join(' / ')}</strong><small>{family.kind === 'phrase' ? 'Across words' : family.kind === 'multisyllable' ? family.syllables + '-syllable rhyme' : family.kind === 'near' ? 'Possible rhyme' : 'Matching sound'}</small></span>
          </button>) : <div className="studio-no-families"><Sparkle size={22} weight="light" /><p>Two sounds find each other.<br />A connection appears here.</p></div>}
        </div>
        <div className="studio-ink-key"><span className="studio-key-solid" />Rhyme<span className="studio-key-dashed" />Possible rhyme</div>
        <p className="studio-rhyme-footnote">A map of sounds, still unfolding.<br />Every delivery is a little different.</p>
        {source === 'performance' && <a href={currentPerformance.url} className="studio-official-link" target="_blank" rel="noreferrer" onClick={onExternalOpen}>Open official performance<ArrowUpRight size={14} /></a>}
      </aside>
    </div>
  </main>;
}
