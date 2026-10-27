import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Sparkles, Wind, Droplets } from 'lucide-react';
import { SimulationInputs, SimulationOutputs } from '../model/photosynthesisModel';

interface BotanicalStageProps {
  inputs: SimulationInputs;
  outputs: SimulationOutputs;
  isPlaying: boolean;
  simSpeed: number;
  theme: 'dark' | 'light';
}

interface OxygenBubble {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  phase: number;
  age: number;
  maxAge: number;
}

interface Co2Particle {
  active: boolean;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  driftPhase: number;
}

interface XylemPulse {
  progress: number;
  branchIndex: number;
  speed: number;
}

const STAGE_W = 580;
const STAGE_H = 310;

const LEAF_NODES = [
  // Left & Right lower leaves
  { id: 'L1', baseX: 255, baseY: 238, side: -1, scale: 0.96, angle: -22, phase: 0.2 },
  { id: 'R1', baseX: 255, baseY: 236, side: 1, scale: 0.96, angle: 20, phase: 1.1 },
  // Mid leaves
  { id: 'L2', baseX: 255, baseY: 194, side: -1, scale: 0.88, angle: -28, phase: 2.0 },
  { id: 'R2', baseX: 255, baseY: 192, side: 1, scale: 0.88, angle: 26, phase: 2.9 },
  // Upper-mid leaves
  { id: 'L3', baseX: 255, baseY: 152, side: -1, scale: 0.76, angle: -34, phase: 3.7 },
  { id: 'R3', baseX: 255, baseY: 152, side: 1, scale: 0.76, angle: 33, phase: 4.5 },
  // Apical crown leaf
  { id: 'TOP', baseX: 255, baseY: 126, side: 0, scale: 0.72, angle: 0, phase: 5.2 },
];

const SPAWN_ORIGINS = [
  { x: 204, y: 224 },
  { x: 306, y: 222 },
  { x: 208, y: 180 },
  { x: 302, y: 178 },
  { x: 220, y: 140 },
  { x: 290, y: 138 },
  { x: 255, y: 105 },
];

export const BotanicalStage: React.FC<BotanicalStageProps> = ({
  inputs,
  outputs,
  isPlaying,
  simSpeed,
  theme,
}) => {
  const [showCo2Particles, setShowCo2Particles] = useState<boolean>(true);
  const [showXylemFlow, setShowXylemFlow] = useState<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const leafGroupRefs = useRef<Array<SVGGElement | null>>([]);
  const sunRayGroupRef = useRef<SVGGElement | null>(null);

  const simStateRef = useRef({
    inputs,
    outputs,
    isPlaying,
    simSpeed,
    showCo2Particles,
    showXylemFlow,
    theme,
  });

  useEffect(() => {
    simStateRef.current = {
      inputs,
      outputs,
      isPlaying,
      simSpeed,
      showCo2Particles,
      showXylemFlow,
      theme,
    };
  }, [inputs, outputs, isPlaying, simSpeed, showCo2Particles, showXylemFlow, theme]);

  const interpRef = useRef({
    lightKlux: inputs.lightKlux,
    bubbleRate: outputs.bubbleEmissionRate,
    activeRate: outputs.activeRate,
    waterPct: inputs.waterPct,
    elapsedTime: 0,
    spawnAccumulator: 0,
    co2Accumulator: 0,
  });

  useEffect(() => {
    const MAX_BUBBLES = 90;
    const MAX_CO2 = 45;

    const bubbles: OxygenBubble[] = Array.from({ length: MAX_BUBBLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 3,
      maxRadius: 5,
      alpha: 0,
      phase: 0,
      age: 0,
      maxAge: 2.8,
    }));

    const co2Pool: Co2Particle[] = Array.from({ length: MAX_CO2 }, () => ({
      active: false,
      x: 0,
      y: 0,
      targetX: 255,
      targetY: 190,
      progress: 0,
      speed: 0.45,
      driftPhase: 0,
    }));

    const xylemPulses: XylemPulse[] = Array.from({ length: 8 }, (_, i) => ({
      progress: (i / 8) % 1,
      branchIndex: i % 4,
      speed: 0.25 + (i % 3) * 0.06,
    }));

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId = 0;
    let lastTimestamp = performance.now();

    const spawnBubble = () => {
      const slot = bubbles.find((b) => !b.active);
      if (!slot) return;
      const origin = SPAWN_ORIGINS[Math.floor(Math.random() * SPAWN_ORIGINS.length)];
      slot.active = true;
      slot.x = origin.x + (Math.random() - 0.5) * 24;
      slot.y = origin.y + (Math.random() - 0.5) * 12;
      slot.vx = (Math.random() - 0.5) * 8;
      slot.vy = -(20 + Math.random() * 18);
      slot.radius = 2.0;
      slot.maxRadius = 4.0 + Math.random() * 3.5;
      slot.alpha = 0.08;
      slot.phase = Math.random() * Math.PI * 2;
      slot.age = 0;
      slot.maxAge = 2.3 + Math.random() * 1.5;
    };

    const spawnCo2 = () => {
      const slot = co2Pool.find((c) => !c.active);
      if (!slot) return;
      const origin = SPAWN_ORIGINS[Math.floor(Math.random() * SPAWN_ORIGINS.length)];
      const angle = Math.random() * Math.PI * 2;
      const dist = 75 + Math.random() * 50;
      slot.active = true;
      slot.x = origin.x + Math.cos(angle) * dist;
      slot.y = Math.min(245, Math.max(40, origin.y + Math.sin(angle) * dist * 0.65));
      slot.targetX = origin.x + (Math.random() - 0.5) * 14;
      slot.targetY = origin.y + (Math.random() - 0.5) * 10;
      slot.progress = 0;
      slot.speed = 0.38 + Math.random() * 0.25;
      slot.driftPhase = Math.random() * Math.PI * 2;
    };

    const renderLoop = (now: number) => {
      animationFrameId = requestAnimationFrame(renderLoop);
      if (typeof document !== 'undefined' && document.hidden) {
        lastTimestamp = now;
        return;
      }

      const rawDt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));

      const state = simStateRef.current;
      const interp = interpRef.current;

      const lerpFactor = 1 - Math.exp(-dt * 10);
      interp.lightKlux += (state.inputs.lightKlux - interp.lightKlux) * lerpFactor;
      interp.bubbleRate += (state.outputs.bubbleEmissionRate - interp.bubbleRate) * lerpFactor;
      interp.activeRate += (state.outputs.activeRate - interp.activeRate) * lerpFactor;
      interp.waterPct += (state.inputs.waterPct - interp.waterPct) * lerpFactor;

      const effectiveSpeed = state.isPlaying && !prefersReducedMotion ? state.simSpeed : 0;
      interp.elapsedTime += dt * effectiveSpeed;

      const t = interp.elapsedTime;
      const waterDroop =
        state.inputs.mode === 'extended'
          ? Math.max(0, (60 - interp.waterPct) / 60) * 10
          : 0;

      LEAF_NODES.forEach((leaf, idx) => {
        const el = leafGroupRefs.current[idx];
        if (!el) return;
        const swayDeg = prefersReducedMotion
          ? 0
          : Math.sin(t * 1.35 + leaf.phase) * 2.3 + Math.cos(t * 0.7 + leaf.phase) * 0.8;
        const droop = leaf.side * waterDroop;
        const totalAngle = leaf.angle + swayDeg + droop;
        el.setAttribute(
          'transform',
          `translate(${leaf.baseX}, ${leaf.baseY}) rotate(${totalAngle.toFixed(2)}) scale(${leaf.scale})`
        );
      });

      if (sunRayGroupRef.current && !prefersReducedMotion) {
        const rot = (t * 8) % 360;
        sunRayGroupRef.current.setAttribute('transform', `translate(465, 68) rotate(${rot.toFixed(2)})`);
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, STAGE_W, STAGE_H);

      if (effectiveSpeed > 0 && interp.bubbleRate > 0.02) {
        const visualParticlesPerSec = Math.min(24, interp.bubbleRate * 1.45);
        interp.spawnAccumulator += visualParticlesPerSec * dt * effectiveSpeed;
        while (interp.spawnAccumulator >= 1) {
          interp.spawnAccumulator -= 1;
          spawnBubble();
        }
      }

      if (effectiveSpeed > 0 && state.showCo2Particles && interp.activeRate > 0.1) {
        const co2PerSec = Math.min(12, (interp.activeRate / 20) * 9);
        interp.co2Accumulator += co2PerSec * dt * effectiveSpeed;
        while (interp.co2Accumulator >= 1) {
          interp.co2Accumulator -= 1;
          spawnCo2();
        }
      }

      if (state.showXylemFlow && interp.waterPct > 2) {
        const rootPaths = [
          [
            { x: 190, y: 298 },
            { x: 225, y: 280 },
            { x: 255, y: 264 },
          ],
          [
            { x: 320, y: 298 },
            { x: 285, y: 280 },
            { x: 255, y: 264 },
          ],
          [
            { x: 230, y: 304 },
            { x: 244, y: 284 },
            { x: 255, y: 264 },
          ],
          [
            { x: 282, y: 304 },
            { x: 267, y: 284 },
            { x: 255, y: 264 },
          ],
        ];

        xylemPulses.forEach((pulse) => {
          pulse.progress =
            (pulse.progress + dt * effectiveSpeed * pulse.speed * (interp.waterPct / 100)) % 1;
          const p = pulse.progress;
          let px = 255;
          let py = 264;
          if (p < 0.45) {
            const localT = p / 0.45;
            const path = rootPaths[pulse.branchIndex];
            const p0 = path[0];
            const p1 = path[1];
            const p2 = path[2];
            const inv = 1 - localT;
            px = inv * inv * p0.x + 2 * inv * localT * p1.x + localT * localT * p2.x;
            py = inv * inv * p0.y + 2 * inv * localT * p1.y + localT * localT * p2.y;
          } else {
            const stemT = (p - 0.45) / 0.55;
            px = 255;
            py = 264 - stemT * 135;
          }

          ctx.save();
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.78)';
          ctx.fill();
          ctx.restore();
        });
      }

      if (state.showCo2Particles) {
        for (let i = 0; i < co2Pool.length; i++) {
          const c = co2Pool[i];
          if (!c.active) continue;
          c.progress += dt * effectiveSpeed * c.speed;
          if (c.progress >= 1) {
            c.active = false;
            continue;
          }
          const ease = c.progress * c.progress * (3 - 2 * c.progress);
          const cx =
            c.x + (c.targetX - c.x) * ease + Math.sin(c.progress * 6 + c.driftPhase) * 4;
          const cy =
            c.y + (c.targetY - c.y) * ease + Math.cos(c.progress * 5 + c.driftPhase) * 3;
          const alpha =
            c.progress < 0.2
              ? (c.progress / 0.2) * 0.75
              : c.progress > 0.8
              ? ((1 - c.progress) / 0.2) * 0.75
              : 0.75;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#fb923c';
          ctx.beginPath();
          ctx.arc(cx - 3.2, cy, 1.5, 0, Math.PI * 2);
          ctx.arc(cx + 3.2, cy, 1.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(cx, cy, 2.0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        if (!b.active) continue;
        b.age += dt * (effectiveSpeed > 0 ? effectiveSpeed : 0.2);
        if (b.age >= b.maxAge || b.y < 14) {
          b.active = false;
          continue;
        }

        const lifeRatio = b.age / b.maxAge;
        b.x += (b.vx + Math.sin(b.age * 2.6 + b.phase) * 14) * dt * (effectiveSpeed || 0.2);
        b.y += b.vy * dt * (effectiveSpeed || 0.2);
        b.radius = b.maxRadius * (0.45 + 0.55 * Math.min(1, lifeRatio * 2.5));

        if (lifeRatio < 0.18) {
          b.alpha = (lifeRatio / 0.18) * 0.88;
        } else if (lifeRatio > 0.72) {
          b.alpha = ((1 - lifeRatio) / 0.28) * 0.88;
        } else {
          b.alpha = 0.88;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, b.alpha));
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(224, 242, 254, 0.75)';
        ctx.beginPath();
        ctx.arc(
          b.x - b.radius * 0.32,
          b.y - b.radius * 0.32,
          Math.max(0.8, b.radius * 0.24),
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const lightNorm = Math.max(0, Math.min(1, inputs.lightKlux / 100));
  const rayOpacity = Math.min(0.68, Math.pow(lightNorm, 0.75) * 0.65);
  const sunCoreOpacity = 0.2 + lightNorm * 0.8;
  const sunGlowScale = 0.65 + lightNorm * 0.65;

  const skyTopColor =
    inputs.lightKlux <= 2
      ? '#060d18'
      : inputs.lightKlux <= 15
      ? '#091929'
      : inputs.lightKlux <= 35
      ? '#0c2238'
      : '#0f2d4a';
  const skyBottomColor =
    inputs.lightKlux <= 2
      ? '#0b1622'
      : inputs.lightKlux <= 15
      ? '#0f2334'
      : inputs.lightKlux <= 35
      ? '#132d42'
      : '#183b56';

  const isStressed =
    inputs.mode === 'extended' &&
    (inputs.waterPct < 35 || inputs.temperatureC > 37 || inputs.temperatureC < 6);
  const leafPrimary = isStressed ? '#4d9e56' : '#38b261';
  const leafSecondary = isStressed ? '#3b8244' : '#28924d';
  const leafVein = isStressed ? '#7ec479' : '#6ee798';

  return (
    <div
      className={`relative flex flex-col justify-between h-full rounded-xl border overflow-hidden select-none ${
        theme === 'dark'
          ? 'bg-[#0d1b15] border-emerald-900/50'
          : 'bg-white border-slate-200 shadow-xs'
      }`}
    >
      {/* Stage Top Status Bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b text-xs ${
          theme === 'dark'
            ? 'bg-[#0a1510]/90 border-emerald-900/40 text-slate-300'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-tight">Botanical Mesocosm Stage</span>
          <span aria-hidden="true" className="text-slate-500">
            ·
          </span>
          <span className="font-mono text-[11px] text-amber-400">
            {inputs.lightKlux.toFixed(0)} klux
          </span>
          <span aria-hidden="true" className="text-slate-500">
            ·
          </span>
          <span className="font-mono text-[11px] text-sky-400">
            {outputs.bubbleEmissionRate.toFixed(1)} bubbles/s
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowCo2Particles((v) => !v)}
            aria-pressed={showCo2Particles}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showCo2Particles
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : theme === 'dark'
                ? 'bg-slate-800/70 text-slate-400 border border-slate-700'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {showCo2Particles ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>CO₂ Flux</span>
          </button>
          <button
            type="button"
            onClick={() => setShowXylemFlow((v) => !v)}
            aria-pressed={showXylemFlow}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showXylemFlow
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : theme === 'dark'
                ? 'bg-slate-800/70 text-slate-400 border border-slate-700'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            <Droplets className="w-3 h-3" />
            <span>Xylem H₂O</span>
          </button>
        </div>
      </div>

      {/* Main Interactive SVG + Canvas Stage — Edge-to-Edge Fill */}
      <div
        className="relative flex-1 w-full min-h-[260px] overflow-hidden bg-[#081523]"
        data-testid="botanical-stage-viewport"
      >
        <svg
          viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full block"
          role="img"
          aria-label={`Animated plant photosynthesis visualization at ${inputs.lightKlux} klux sunlight intensity`}
        >
          <defs>
            <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={skyTopColor} style={{ transition: 'stop-color 300ms ease' }} />
              <stop offset="100%" stopColor={skyBottomColor} style={{ transition: 'stop-color 300ms ease' }} />
            </linearGradient>

            <radialGradient id="sunHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fde047" stopOpacity={0.75 * lightNorm} />
              <stop offset="45%" stopColor="#f59e0b" stopOpacity={0.35 * lightNorm} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="beamGrad1" x1="82%" y1="18%" x2="35%" y2="80%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity={rayOpacity * 0.72} />
              <stop offset="55%" stopColor="#facc15" stopOpacity={rayOpacity * 0.28} />
              <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="beamGrad2" x1="78%" y1="22%" x2="42%" y2="75%">
              <stop offset="0%" stopColor="#fde047" stopOpacity={rayOpacity * 0.55} />
              <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="leafSurfaceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={leafVein} />
              <stop offset="35%" stopColor={leafPrimary} />
              <stop offset="100%" stopColor={leafSecondary} />
            </linearGradient>

            <linearGradient id="soilGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6b4426" />
              <stop offset="35%" stopColor="#52331c" />
              <stop offset="100%" stopColor="#362010" />
            </linearGradient>

            <g id="detailed-leaf-left">
              <path
                d="M 0,0 C -18,-22 -56,-26 -76,-6 C -58,18 -24,20 0,0 Z"
                fill="url(#leafSurfaceGrad)"
                stroke="#1e5631"
                strokeWidth="1"
              />
              <path
                d="M -2,0 Q -36,-5 -70,-5"
                fill="none"
                stroke={leafVein}
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.75"
              />
              <path
                d="M -20,-3 Q -30,-12 -40,-14 M -36,-4 Q -46,-12 -55,-12 M -24,-2 Q -34,6 -45,8 M -42,-4 Q -50,4 -60,4"
                fill="none"
                stroke={leafVein}
                strokeWidth="0.9"
                strokeLinecap="round"
                opacity="0.5"
              />
            </g>

            <g id="detailed-leaf-right">
              <path
                d="M 0,0 C 18,-22 56,-26 76,-6 C 58,18 24,20 0,0 Z"
                fill="url(#leafSurfaceGrad)"
                stroke="#1e5631"
                strokeWidth="1"
              />
              <path
                d="M 2,0 Q 36,-5 70,-5"
                fill="none"
                stroke={leafVein}
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.75"
              />
              <path
                d="M 20,-3 Q 30,-12 40,-14 M 36,-4 Q 46,-12 55,-12 M 24,-2 Q 34,6 45,8 M 42,-4 Q 50,4 60,4"
                fill="none"
                stroke={leafVein}
                strokeWidth="0.9"
                strokeLinecap="round"
                opacity="0.5"
              />
            </g>

            <g id="detailed-leaf-crown">
              <path
                d="M 0,0 C -20,-24 -18,-58 0,-74 C 18,-58 20,-24 0,0 Z"
                fill="url(#leafSurfaceGrad)"
                stroke="#1e5631"
                strokeWidth="1"
              />
              <path
                d="M 0,-2 L 0,-68"
                fill="none"
                stroke={leafVein}
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.75"
              />
              <path
                d="M 0,-22 Q -9,-30 -12,-38 M 0,-38 Q -8,-45 -10,-52 M 0,-22 Q 9,-30 12,-38 M 0,-38 Q 8,-45 10,-52"
                fill="none"
                stroke={leafVein}
                strokeWidth="0.9"
                strokeLinecap="round"
                opacity="0.5"
              />
            </g>
          </defs>

          {/* 1. Sky Background */}
          <rect x="0" y="0" width={STAGE_W} height={STAGE_H} fill="url(#skyGrad)" />

          {/* Subtle Nocturnal Stars when in Darkness / Deep Shade (< 12 klux) */}
          {inputs.lightKlux < 12 && (
            <g opacity={Math.max(0, (12 - inputs.lightKlux) / 12) * 0.65}>
              <circle cx="65" cy="42" r="1.2" fill="#e2e8f0" />
              <circle cx="130" cy="74" r="1.5" fill="#cbd5e1" />
              <circle cx="92" cy="120" r="1" fill="#94a3b8" />
              <circle cx="215" cy="38" r="1.3" fill="#e2e8f0" />
              <circle cx="340" cy="52" r="1.1" fill="#cbd5e1" />
            </g>
          )}

          {/* 2. Volumetric Sun Beams Reaching the Plant Canopy */}
          {inputs.lightKlux > 0.5 && (
            <g style={{ mixBlendMode: 'screen' }}>
              <polygon points="465,68 145,260 260,268" fill="url(#beamGrad1)" />
              <polygon points="465,68 205,225 345,260" fill="url(#beamGrad2)" />
              <polygon points="465,68 175,155 290,220" fill="url(#beamGrad1)" />
            </g>
          )}

          {/* 3. Detailed Sun & Atmospheric Corona */}
          <g>
            <circle
              cx="465"
              cy="68"
              r={82 * sunGlowScale}
              fill="url(#sunHalo)"
              style={{ transition: 'r 200ms ease' }}
            />
            <circle
              cx="465"
              cy="68"
              r={42 + lightNorm * 12}
              fill="#eab308"
              fillOpacity={0.14 + lightNorm * 0.16}
            />
            <g ref={sunRayGroupRef} transform="translate(465, 68)">
              {Array.from({ length: 16 }).map((_, i) => {
                const angle = (i * 360) / 16;
                const rayLen = 33 + lightNorm * 20 + (i % 2 === 0 ? 5 : 0);
                return (
                  <line
                    key={i}
                    x1="0"
                    y1="27"
                    x2="0"
                    y2={rayLen}
                    stroke="#facc15"
                    strokeWidth={i % 2 === 0 ? '3.0' : '2.0'}
                    strokeLinecap="round"
                    strokeOpacity={0.18 + lightNorm * 0.72}
                    transform={`rotate(${angle})`}
                  />
                );
              })}
            </g>
            <circle
              cx="465"
              cy="68"
              r={22 + lightNorm * 4}
              fill="#eab308"
              fillOpacity={sunCoreOpacity}
              stroke="#fef08a"
              strokeWidth={lightNorm > 0.1 ? '2' : '0.5'}
              strokeOpacity={lightNorm * 0.8}
            />
          </g>

          {/* 4. Soil Horizon & Vascular Root System */}
          <g>
            <path
              d={`M 0,260 Q 160,248 285,258 T ${STAGE_W},256 L ${STAGE_W},${STAGE_H} L 0,${STAGE_H} Z`}
              fill="url(#soilGrad)"
            />
            <path
              d={`M 0,260 Q 160,248 285,258 T ${STAGE_W},256`}
              fill="none"
              stroke="#855834"
              strokeWidth="2"
              opacity="0.65"
            />
            <g stroke="#a37c56" strokeLinecap="round" fill="none" opacity="0.65">
              <path d="M 255,260 Q 225,280 190,298" strokeWidth="2.4" />
              <path d="M 255,260 Q 285,280 320,298" strokeWidth="2.4" />
              <path d="M 255,262 Q 244,284 230,304" strokeWidth="1.8" />
              <path d="M 255,262 Q 267,284 282,304" strokeWidth="1.8" />
              <path d="M 220,280 Q 202,284 180,286" strokeWidth="1.1" />
              <path d="M 290,280 Q 308,284 332,286" strokeWidth="1.1" />
              <path d="M 255,260 L 255,306" strokeWidth="2.0" />
            </g>
          </g>

          {/* 5. Main Botanical Stem & Articulated Leaves */}
          <g>
            <path
              d="M 255,264 Q 253,195 255,124"
              fill="none"
              stroke={leafSecondary}
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M 255,264 Q 253,195 255,124"
              fill="none"
              stroke={leafVein}
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.45"
            />

            {LEAF_NODES.map((leaf, idx) => (
              <g
                key={leaf.id}
                ref={(el) => {
                  leafGroupRefs.current[idx] = el;
                }}
                transform={`translate(${leaf.baseX}, ${leaf.baseY}) rotate(${leaf.angle}) scale(${leaf.scale})`}
              >
                {leaf.side === -1 && <use href="#detailed-leaf-left" />}
                {leaf.side === 1 && <use href="#detailed-leaf-right" />}
                {leaf.side === 0 && <use href="#detailed-leaf-crown" />}
              </g>
            ))}
          </g>
        </svg>

        {/* High-Performance 2D Canvas Overlay for Recycled O₂, CO₂ & H₂O Particles */}
        <canvas
          ref={canvasRef}
          width={STAGE_W}
          height={STAGE_H}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Scientific Particle Legend Overlay */}
        <div className="absolute bottom-2 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-slate-950/75 backdrop-blur-xs border border-white/10 text-[10px] text-slate-200">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full border border-sky-400 bg-sky-400/25 inline-block" />
              <span>O₂ Evolution</span>
            </span>
            {showCo2Particles && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                <span>CO₂ ({inputs.co2Ppm} ppm)</span>
              </span>
            )}
            {showXylemFlow && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-300 inline-block" />
                <span>Xylem H₂O ({inputs.waterPct}%)</span>
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Visual particle scale: illustrative
          </span>
        </div>
      </div>

      {/* Live Reaction Stoichiometry & Physiological Status Strip */}
      <div
        className={`px-3 py-1.5 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${
          theme === 'dark'
            ? 'bg-[#0a1510] border-emerald-900/40 text-slate-300'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-mono text-[11px]">
            6 CO₂ + 6 H₂O + hν → C₆H₁₂O₆ + 6 O₂
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
          <Wind className="w-3 h-3 text-emerald-400" />
          <span>
            Mode:{' '}
            <strong className={theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'}>
              {inputs.mode === 'baseline' ? 'Baseline (Light-Only)' : 'Extended (Multi-Factor)'}
            </strong>
          </span>
        </span>
      </div>
    </div>
  );
};
