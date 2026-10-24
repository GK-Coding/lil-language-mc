'use client';

import { memo, RefObject, useEffect, useRef } from 'react';

type Dot = { x: number; y: number; seed: number };
type Formation = { element: HTMLElement; dots: Dot[]; text: string; started: number; landed: number | null; from: { x: number; y: number } };
const noise = (seed: number) => { const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };

/** Voice ripples persist through inference, become tentative glyphs, then crossfade into permanent ink. */
export default memo(function SpeechParticles({ analyser, active, busy, pending, following, wordRoot, viewport }: {
  analyser: AnalyserNode | null; active: boolean; busy: boolean; pending: number; following: boolean;
  wordRoot: RefObject<HTMLDivElement>; viewport: RefObject<HTMLDivElement>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ active, busy, pending, following });
  state.current = { active, busy, pending, following };

  useEffect(() => {
    const surface = canvas.current, root = wordRoot.current, view = viewport.current;
    const context = surface?.getContext('2d');
    if (!surface || !root || !view || !context) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const values = new Float32Array(analyser?.fftSize || 1024);
    const seen = new Set<string>();
    const formations = new Map<string, Formation>();
    const glyphCache = new Map<string, Dot[]>();
    let width = 0, height = 0, frame = 0, lastPaint = 0, lastVoice = -10000, level = 0, envelope = 0, cloudOpacity = 0;
    let frontier = { x: 80, y: 200 };
    const resize = () => {
      const rect = surface.getBoundingClientRect(); width = rect.width; height = rect.height;
      const density = Math.min(2, window.devicePixelRatio || 1);
      surface.width = Math.round(width * density); surface.height = Math.round(height * density);
      context.setTransform(density, 0, 0, density, 0, 0); glyphCache.clear();
    };
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(surface); resize();
    const glyphs = (element: HTMLElement): Dot[] => {
      const text = element.querySelector('.studio-word-text')?.textContent || '';
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const key = text + ':' + font;
      const cached = glyphCache.get(key); if (cached) return cached;
      const glyph = document.createElement('canvas');
      glyph.width = Math.ceil(rect.width); glyph.height = Math.ceil(rect.height);
      const ink = glyph.getContext('2d', { willReadFrequently: true });
      if (!ink || !glyph.width || !glyph.height) return [];
      ink.font = font; ink.textBaseline = 'middle'; ink.fillStyle = '#fff';
      ink.fillText(text, 2, glyph.height * .5);
      const pixels = ink.getImageData(0, 0, glyph.width, glyph.height).data, dots: Dot[] = [];
      const step = Math.max(2, Math.round(parseFloat(style.fontSize) / 15));
      for (let y = 1; y < glyph.height; y += step) for (let x = 1; x < glyph.width; x += step) {
        if (pixels[(y * glyph.width + x) * 4 + 3] > 100) dots.push({ x, y, seed: x * 13 + y * 7 });
      }
      const sampled = dots.filter((_, index) => index % Math.max(1, Math.ceil(dots.length / 180)) === 0);
      if(glyphCache.size>180)glyphCache.clear();glyphCache.set(key, sampled);return sampled;
    };
    const collect = () => {
      const elements = Array.from(root.querySelectorAll<HTMLElement>('.studio-word')).slice(-32);
      if (!elements.length) { seen.clear(); formations.clear(); return; }
      const now = performance.now();let previewIndex=0;
      for (const element of elements) {
        const id = element.dataset.wordId!, text = element.textContent || '', dust = element.dataset.wordPhase === 'dust';
        const known = formations.get(id);
        if (known) {
          known.element=element;
          if(known.text!==text){known.text=text;known.dots=glyphs(element);}
          if(!dust && known.landed===null)known.landed=now+parseFloat(element.style.getPropertyValue('--formation-delay')||'0');
          continue;
        }
        if(seen.has(id))continue;seen.add(id);
        if (!state.current.following || reduced.matches) continue;
        const delay=dust?previewIndex++*35:parseFloat(element.style.getPropertyValue('--formation-delay')||'0');
        formations.set(id,{ element,dots:glyphs(element),text,started:now+delay,landed:dust?null:now+delay,from:{...frontier} });
      }
    };
    root.querySelectorAll<HTMLElement>('.studio-word').forEach(element=>seen.add(element.dataset.wordId!));
    const observer = new MutationObserver(collect);
    observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-word-phase']});
    const draw = (now: number) => {
      frame=requestAnimationFrame(draw);if(now-lastPaint<1000/30)return;lastPaint=now;
      context.clearRect(0,0,width,height);
      if(reduced.matches||!state.current.following)return;
      if(analyser&&state.current.active)analyser.getFloatTimeDomainData(values);else values.fill(0);
      let power=0;for(const value of values)power+=value*value;
      const rms=Math.sqrt(power/values.length);
      level+=(Math.min(1,rms*16)-level)*.45;
      envelope=Math.max(level,envelope*.975);if(rms>.004)lastVoice=now;
      const bounds=surface.getBoundingClientRect();
      const dust=root.querySelector<HTMLElement>('.studio-word[data-word-phase="dust"]');
      const committed=root.querySelectorAll<HTMLElement>('.studio-word[data-word-phase="ink"]');
      const latest=committed[committed.length-1]?.getBoundingClientRect();
      if(dust){const rect=dust.getBoundingClientRect();frontier={x:rect.left-bounds.left+20,y:rect.top-bounds.top+rect.height*.5};}
      else if(latest){frontier={x:latest.right-bounds.left+64,y:latest.top-bounds.top+latest.height*.5};if(frontier.x>width-85)frontier={x:65,y:latest.bottom-bounds.top+28};}
      else frontier={x:Math.min(130,width*.4),y:height-160};
      frontier.y=Math.min(height-35,Math.max(30,frontier.y));
      for(const [id,batch] of formations)if(!batch.element.isConnected||(batch.landed!==null&&now-batch.landed>950))formations.delete(id);
      const waiting=state.current.active&&(now-lastVoice<1500||state.current.busy||state.current.pending>0||formations.size>0);
      cloudOpacity+=((waiting?.8:0)-cloudOpacity)*.08;
      // Each ring continues to travel during recognition; the last measured voice energy decays smoothly.
      if(cloudOpacity>.01)for(let ring=0;ring<3;ring++){
        const phase=((now*.0007+ring/3)%1),radius=14+phase*(54+envelope*25);
        for(let index=0;index<42;index++){
          const seed=index+ring*42+1,angle=noise(seed)*Math.PI*2;
          const wobble=Math.sin(now*.014+seed)*(1+level*14);
          const x=frontier.x+Math.cos(angle)*radius*1.8+wobble;
          const y=frontier.y+Math.sin(angle)*radius*.4+wobble*.6;
          context.globalAlpha=cloudOpacity*(1-phase)*(.25+noise(seed+50)*.7);
          context.fillStyle=index%4?'#5ce2c7':'#d0b7f4';
          context.beginPath();context.arc(x,y,.65+noise(seed+10)*.9,0,Math.PI*2);context.fill();
        }
      }
      let forming=0;
      for(const batch of formations.values()){
        if(now<batch.started)continue;forming++;
        const rect=batch.element.getBoundingClientRect();
        const settled=batch.landed===null?0:Math.max(0,Math.min(1,(now-batch.landed)/720));
        const preview=Math.min(.76,Math.max(0,(now-batch.started)/1200));
        const progress=batch.landed===null?preview:Math.max(preview,1-Math.pow(1-settled,2));
        const color=getComputedStyle(batch.element).getPropertyValue('--rhyme-color').trim();
        for(const dot of batch.dots){
          const fromX=batch.from.x+(noise(dot.seed)-.5)*155,fromY=batch.from.y+(noise(dot.seed+2)-.5)*55;
          const targetX=rect.left-bounds.left+dot.x,targetY=rect.top-bounds.top+dot.y;
          const ripple=Math.sin(now*.012-dot.x*.06+dot.seed*.01)*(1-progress)*(4+envelope*10);
          const x=fromX+(targetX-fromX)*progress+ripple;
          const y=fromY+(targetY-fromY)*progress+Math.cos(now*.014+dot.seed)*(1-progress)*(2+level*12);
          context.globalAlpha=(batch.landed===null?.28:.85)*(1-Math.pow(settled,2));
          context.fillStyle=settled>.45?'#f1f2f3':color&&color!=='transparent'?color:'#5ce2c7';
          context.fillRect(x,y,1.4+(1-progress)*.6,1.4+(1-progress)*.6);
        }
      }
      context.globalAlpha=1;surface.dataset.audioLevel=level.toFixed(3);surface.dataset.formingWords=String(forming);surface.dataset.frontierVisible=String(cloudOpacity>.05);
    };
    frame=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();resizeObserver.disconnect();context.clearRect(0,0,width,height);};
  },[analyser,viewport,wordRoot]);
  return <canvas ref={canvas} className="studio-speech-particles" data-testid="speech-particles" aria-hidden="true" />;
});
