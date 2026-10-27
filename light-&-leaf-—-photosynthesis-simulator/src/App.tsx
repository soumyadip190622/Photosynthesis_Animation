/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sun,
  Play,
  Pause,
  RotateCcw,
  PlusCircle,
  Sparkles,
  Thermometer,
  Wind,
  Droplets,
  Moon,
  AlertCircle,
  CheckCircle2,
  TriangleAlert,
  Bot,
  Activity,
} from 'lucide-react';
import {
  MODEL_CONSTANTS,
  ENVIRONMENT_PRESETS,
  ModelMode,
  SimulationInputs,
  ExperimentObservation,
  evaluateSimulation,
  clampNumber,
} from './model/photosynthesisModel';
import { BotanicalStage } from './components/BotanicalStage';
import { ScientificGraphs, GraphTabId, TimeSeriesPoint } from './components/ScientificGraphs';
import { ExperimentTableAndBioExplorer } from './components/ExperimentTableAndBioExplorer';
import { BiologyChatbotModal } from './components/BiologyChatbotModal';

export default function App() {
  // Core Simulation Inputs
  const [lightKlux, setLightKlux] = useState<number>(MODEL_CONSTANTS.DEFAULT_LIGHT_KLUX);
  const [lightInputStr, setLightInputStr] = useState<string>(
    String(MODEL_CONSTANTS.DEFAULT_LIGHT_KLUX)
  );
  const [co2Ppm, setCo2Ppm] = useState<number>(MODEL_CONSTANTS.REF_CO2_PPM);
  const [co2InputStr, setCo2InputStr] = useState<string>(String(MODEL_CONSTANTS.REF_CO2_PPM));
  const [temperatureC, setTemperatureC] = useState<number>(MODEL_CONSTANTS.OPT_TEMP_C);
  const [waterPct, setWaterPct] = useState<number>(MODEL_CONSTANTS.REF_WATER_PCT);
  const [mode, setMode] = useState<ModelMode>('baseline');

  // Validation error feedback for numeric inputs
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  // Playback & Simulation Engine State
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [isSweeping, setIsSweeping] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Theme ('dark' default matching Light & Leaf botanical palette, or 'light' lab workbench)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Graph & Analytical State
  const [activeGraphTab, setActiveGraphTab] = useState<GraphTabId>('graphA');
  const [visitedLightLevels, setVisitedLightLevels] = useState<number[]>([
    0, 5, 10, 15, 20, 25, 30, 35, 40,
  ]);
  const [previousRate, setPreviousRate] = useState<number>(12.3077);

  // Seed initial deterministic observations so comparison & table work immediately
  const [observations, setObservations] = useState<ExperimentObservation[]>(() => {
    const seedPresets = [
      { id: 'EXP-001', klux: 10, co2: 400, temp: 25, water: 100, mode: 'baseline' as ModelMode, elapsed: 4.0 },
      { id: 'EXP-002', klux: 25, co2: 400, temp: 25, water: 100, mode: 'baseline' as ModelMode, elapsed: 8.5 },
      { id: 'EXP-003', klux: 40, co2: 400, temp: 25, water: 100, mode: 'baseline' as ModelMode, elapsed: 12.0 },
      { id: 'EXP-004', klux: 100, co2: 400, temp: 25, water: 100, mode: 'baseline' as ModelMode, elapsed: 16.5 },
    ];
    return seedPresets.map((s, idx) => {
      const out = evaluateSimulation({
        lightKlux: s.klux,
        co2Ppm: s.co2,
        temperatureC: s.temp,
        waterPct: s.water,
        mode: s.mode,
      });
      return {
        id: s.id,
        runNumber: idx + 1,
        timestamp: 'Initial Seed',
        elapsedSeconds: s.elapsed,
        mode: s.mode,
        lightKlux: s.klux,
        co2Ppm: s.co2,
        temperatureC: s.temp,
        waterPct: s.water,
        predictedRate: out.activeRate,
        baselineRate: out.baselineRate,
        estimatedO2Rate: out.estimatedO2Rate,
        bubbleRate: out.bubbleEmissionRate,
        percentOfPmax: out.percentOfPmax,
        analyticalSlope: out.analyticalSlope,
        limitingFactorLabel: out.limitingFactor.factor,
      };
    });
  });

  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([
    'EXP-001',
    'EXP-002',
    'EXP-003',
    'EXP-004',
  ]);
  const [nextRunNumber, setNextRunNumber] = useState<number>(5);

  // Time-series history buffer
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesPoint[]>([]);

  // Gemini Biology Consultant Drawer & Quick AI Brief
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [aiBriefText, setAiBriefText] = useState<string | null>(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState<boolean>(false);

  const inputs: SimulationInputs = useMemo(
    () => ({
      lightKlux,
      co2Ppm,
      temperatureC,
      waterPct,
      mode,
    }),
    [lightKlux, co2Ppm, temperatureC, waterPct, mode]
  );

  const outputs = useMemo(() => evaluateSimulation(inputs), [inputs]);

  // Keep latest inputs/outputs in ref for time-series sampling
  const latestSimRef = useRef({ inputs, outputs, isPlaying, simSpeed });
  useEffect(() => {
    latestSimRef.current = { inputs, outputs, isPlaying, simSpeed };
  }, [inputs, outputs, isPlaying, simSpeed]);

  // Helper to update Light Intensity cleanly and track visited curve points
  const applyLightKlux = (newKlux: number, recordPrev = true) => {
    const clamped = clampNumber(Math.round(newKlux * 10) / 10, 0, 100);
    if (recordPrev && Math.abs(clamped - lightKlux) >= 0.5) {
      setPreviousRate(outputs.activeRate);
    }
    setLightKlux(clamped);
    setLightInputStr(String(Math.round(clamped)));
    setVisitedLightLevels((prev) => {
      const rounded = Math.round(clamped);
      if (prev.includes(rounded)) return prev;
      return [...prev, rounded].sort((a, b) => a - b);
    });
  };

  // Continuous Time-Series Recorder (updates every 500ms when playing)
  useEffect(() => {
    const timer = setInterval(() => {
      const { inputs: curIn, outputs: curOut, isPlaying: playing, simSpeed: speed } =
        latestSimRef.current;
      if (!playing) return;
      setElapsedSeconds((prevElapsed) => {
        const nextElapsed = prevElapsed + 0.5 * speed;
        setTimeSeriesData((prevSeries) => {
          const nextPt: TimeSeriesPoint = {
            timeSec: nextElapsed,
            lightKlux: curIn.lightKlux,
            photosynthesisRate: curOut.activeRate,
            o2Rate: curOut.estimatedO2Rate,
            co2Ppm: curIn.co2Ppm,
            temperatureC: curIn.temperatureC,
          };
          const updated = [...prevSeries, nextPt];
          return updated.length > 80 ? updated.slice(updated.length - 80) : updated;
        });
        return nextElapsed;
      });
    }, 500);

    return () => clearInterval(timer);
  }, []);

  // Sweep Light Intensity 0 to 100 klux animation
  useEffect(() => {
    if (!isSweeping) return;
    let currentSweepKlux = 0;
    setLightKlux(0);
    setLightInputStr('0');
    setVisitedLightLevels([0]);

    const interval = setInterval(() => {
      currentSweepKlux += 5;
      if (currentSweepKlux >= 100) {
        currentSweepKlux = 100;
        setIsSweeping(false);
        clearInterval(interval);
      }
      setLightKlux(currentSweepKlux);
      setLightInputStr(String(currentSweepKlux));
      setVisitedLightLevels((prev) =>
        prev.includes(currentSweepKlux)
          ? prev
          : [...prev, currentSweepKlux].sort((a, b) => a - b)
      );
    }, 85);

    return () => clearInterval(interval);
  }, [isSweeping]);

  // Handlers for Validated Editable Numeric Inputs
  const handleLightInputChange = (raw: string) => {
    setLightInputStr(raw);
    if (raw.trim() === '') {
      setValidationMessage('Enter a sunlight intensity between 0 and 100 klux.');
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      setValidationMessage('Sunlight intensity must be a valid number (0–100 klux).');
      return;
    }
    if (parsed < 0 || parsed > 100) {
      setValidationMessage('Sunlight intensity is clamped to the valid 0–100 klux range.');
      applyLightKlux(clampNumber(parsed, 0, 100));
      return;
    }
    setValidationMessage(null);
    applyLightKlux(parsed);
  };

  const handleCo2InputChange = (raw: string) => {
    setCo2InputStr(raw);
    const parsed = Number(raw);
    if (raw.trim() === '' || Number.isNaN(parsed)) {
      setValidationMessage('CO₂ concentration must be a valid number between 0 and 1200 ppm.');
      return;
    }
    if (parsed < 0 || parsed > 1200) {
      setValidationMessage('CO₂ concentration is clamped to 0–1200 ppm.');
      setCo2Ppm(clampNumber(parsed, 0, 1200));
      return;
    }
    setValidationMessage(null);
    setPreviousRate(outputs.activeRate);
    setCo2Ppm(parsed);
  };

  const handleResetDefaults = () => {
    setPreviousRate(outputs.activeRate);
    setLightKlux(MODEL_CONSTANTS.DEFAULT_LIGHT_KLUX);
    setLightInputStr(String(MODEL_CONSTANTS.DEFAULT_LIGHT_KLUX));
    setCo2Ppm(MODEL_CONSTANTS.REF_CO2_PPM);
    setCo2InputStr(String(MODEL_CONSTANTS.REF_CO2_PPM));
    setTemperatureC(MODEL_CONSTANTS.OPT_TEMP_C);
    setWaterPct(MODEL_CONSTANTS.REF_WATER_PCT);
    setSimSpeed(1);
    setIsPlaying(true);
    setValidationMessage(null);
  };

  const handleAddObservation = () => {
    const id = `EXP-${String(nextRunNumber).padStart(3, '0')}`;
    const newObs: ExperimentObservation = {
      id,
      runNumber: nextRunNumber,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      elapsedSeconds,
      mode,
      lightKlux,
      co2Ppm,
      temperatureC,
      waterPct,
      predictedRate: outputs.activeRate,
      baselineRate: outputs.baselineRate,
      estimatedO2Rate: outputs.estimatedO2Rate,
      bubbleRate: outputs.bubbleEmissionRate,
      percentOfPmax: outputs.percentOfPmax,
      analyticalSlope: outputs.analyticalSlope,
      limitingFactorLabel: outputs.limitingFactor.factor,
    };
    setObservations((prev) => [newObs, ...prev]);
    setSelectedCompareIds((prev) => [...prev, id]);
    setNextRunNumber((n) => n + 1);
  };

  const handleGenerateQuickAiAnalysis = async () => {
    if (isGeneratingBrief) return;
    setIsGeneratingBrief(true);
    try {
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simContext: {
            lightKlux,
            co2Ppm,
            temperatureC,
            waterPct,
            mode,
            activeRate: outputs.activeRate,
            baselineRate: outputs.baselineRate,
            analyticalSlope: outputs.analyticalSlope,
            limitingFactor: outputs.limitingFactor.factor,
          },
        }),
      });
      const data = await res.json();
      setAiBriefText(data.summary);
    } catch {
      setAiBriefText(
        `At ${lightKlux} klux (${mode} model), net photosynthesis is ${outputs.activeRate.toFixed(2)} µmol CO₂ m⁻² s⁻¹ (${outputs.percentOfPmax.toFixed(1)}% of Pmax) with local sensitivity dR/dI = ${outputs.analyticalSlope.toFixed(3)} µmol m⁻² s⁻¹ klux⁻¹.`
      );
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        theme === 'dark'
          ? 'bg-[#09140f] text-slate-100'
          : 'bg-[#f8fafc] text-slate-900'
      }`}
    >
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header
        className={`flex items-center justify-between gap-8 px-5 py-3 border-b ${
          theme === 'dark'
            ? 'bg-[#07100c] border-emerald-900/50'
            : 'bg-white border-slate-200'
        }`}
      >
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          className={`text-lg font-bold tracking-tight whitespace-nowrap shrink-0 ${
            theme === 'dark' ? 'text-emerald-300' : 'text-emerald-800'
          }`}
        >
          Light &amp; Leaf
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav
          aria-label="Workspace Sections"
          className={`hidden md:flex items-center gap-6 text-xs font-medium ${
            theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
          }`}
        >
          <a
            href="#simulation-workspace"
            className="hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
          >
            Simulator Stage
          </a>
          <a
            href="#scientific-graphs"
            className="hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
          >
            Response Graphs
          </a>
          <a
            href="#experiment-records"
            className="hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
          >
            Observations Table
          </a>
          <a
            href="#experiment-records"
            className="hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
          >
            Bioscience Explorer
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsChatOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ask Biology Consultant
          </button>
        </div>
      </header>

      {/* WORKSPACE CALIBRATION & MODE SUB-TOOLBAR */}
      <div
        className={`px-5 py-2 border-b flex flex-wrap items-center justify-between gap-3 text-xs ${
          theme === 'dark'
            ? 'bg-[#0c1a14] border-emerald-900/40 text-slate-300'
            : 'bg-slate-100 border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-400">
            Turn the sun up and down and watch how fast this plant fixes carbon dioxide and releases oxygen.
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="font-mono text-[11px] text-emerald-400">
            Elapsed: {elapsedSeconds.toFixed(1)}s
          </span>
        </div>

        {/* Interactive Model Mode Selector & Theme Switch */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`inline-flex items-center gap-1 p-0.5 rounded-lg border ${
              theme === 'dark'
                ? 'bg-[#08120e] border-emerald-900/60'
                : 'bg-slate-200 border-slate-300'
            }`}
            role="group"
            aria-label="Scientific Model Selection"
          >
            <button
              type="button"
              onClick={() => {
                setPreviousRate(outputs.activeRate);
                setMode('baseline');
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'baseline'
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Baseline Model (Light-Only)
            </button>
            <button
              type="button"
              onClick={() => {
                setPreviousRate(outputs.activeRate);
                setMode('extended');
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'extended'
                  ? 'bg-sky-400 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Extended Model (Multi-Factor)
            </button>
          </div>

          <button
            type="button"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              theme === 'dark'
                ? 'border-emerald-900/60 bg-[#10231a] text-slate-200 hover:bg-emerald-950'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Light Lab Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-700" />
                <span>Botanical Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* MAIN 16:9 DESKTOP SCIENTIFIC WORKSPACE */}
      <main
        id="simulation-workspace"
        className="flex-1 max-w-[1920px] w-full mx-auto px-4 py-2.5 space-y-3"
      >
        {/* TOP 3-COLUMN DESKTOP GRID: Left Controls (~25% / 3 cols) | Center Plant Stage (~45% / 5 cols) | Right Live Telemetry (~30% / 4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          {/* LEFT COLUMN (3/12 = 25%): ENVIRONMENTAL & SIMULATION CONTROLS */}
          <section
            aria-label="Environmental Parameter Controls"
            className={`lg:col-span-3 rounded-xl border p-3 flex flex-col justify-between gap-2.5 ${
              theme === 'dark'
                ? 'bg-[#0e1f18] border-emerald-900/50'
                : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div className="space-y-2.5">
              {/* Primary Sunlight Intensity Control Card */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <label
                    htmlFor="sunlight-slider"
                    className="text-xs font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5"
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sunlight Intensity</span>
                  </label>
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      aria-label="Sunlight intensity numeric input in klux"
                      value={lightInputStr}
                      onChange={(e) => handleLightInputChange(e.target.value)}
                      className={`w-16 text-right font-mono text-xl font-bold rounded px-1.5 py-0.5 border focus:outline-none focus:ring-2 focus:ring-amber-400 tabular-nums ${
                        theme === 'dark'
                          ? 'bg-[#08130e] border-emerald-800/60 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                    <span className="text-xs font-mono text-slate-400">klux</span>
                  </div>
                </div>

                {/* Golden Gradient Sunlight Slider */}
                <input
                  id="sunlight-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={lightKlux}
                  onChange={(e) => applyLightKlux(Number(e.target.value))}
                  className="w-full sun-slider"
                  style={{
                    background: `linear-gradient(90deg, #1e293b 0%, #ca8a04 ${Math.max(
                      10,
                      lightKlux * 0.5
                    )}%, #facc15 100%)`,
                  }}
                />

                {/* 5 Quick-Select Environment Presets */}
                <div
                  className="flex flex-wrap items-center gap-1.5 pt-0.5"
                  role="group"
                  aria-label="Sunlight Environment Presets"
                >
                  {ENVIRONMENT_PRESETS.map((preset) => {
                    const isActive = Math.abs(lightKlux - preset.lightKlux) < 0.5;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyLightKlux(preset.lightKlux)}
                        title={preset.description}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          isActive
                            ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                            : theme === 'dark'
                            ? 'bg-[#12261d] border-emerald-800/50 text-slate-200 hover:bg-emerald-900/50'
                            : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <p className="text-[11px] text-slate-400 leading-snug">
                  1 klux = 1,000 lux (Shade ≈ 10 klux · Midday sun ≈ 100 klux).
                </p>
              </div>

              {/* Validation Alert Banner (if user types out-of-range number) */}
              {validationMessage && (
                <div
                  role="alert"
                  className="p-2 rounded-lg border border-amber-500/50 bg-amber-950/40 text-[11px] text-amber-200 flex items-center gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{validationMessage}</span>
                </div>
              )}

              {/* Extended Environmental Factor Controls (CO₂, Temperature, Water) */}
              <div className="pt-2 border-t border-emerald-900/40 space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-slate-300 whitespace-nowrap">
                    Environmental Co-Factors
                  </span>
                  {mode === 'baseline' && (
                    <button
                      type="button"
                      onClick={() => setMode('extended')}
                      className="text-[11px] text-sky-400 hover:underline cursor-pointer whitespace-nowrap"
                    >
                      Enable Extended Mode →
                    </button>
                  )}
                </div>

                {/* CO2 Concentration Control */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label
                      htmlFor="co2-slider"
                      className="inline-flex items-center gap-1 text-slate-300 font-medium"
                    >
                      <Wind className="w-3.5 h-3.5 text-amber-400" />
                      <span>CO₂ Concentration</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={1200}
                        step={10}
                        aria-label="CO2 concentration in ppm"
                        value={co2InputStr}
                        onChange={(e) => handleCo2InputChange(e.target.value)}
                        className={`w-14 text-right font-mono text-xs font-semibold rounded px-1 py-0.5 border tabular-nums ${
                          theme === 'dark'
                            ? 'bg-[#08130e] border-emerald-800/60 text-amber-300'
                            : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                      <span className="font-mono text-[11px] text-slate-400">ppm</span>
                    </div>
                  </div>
                  <input
                    id="co2-slider"
                    type="range"
                    min={0}
                    max={1200}
                    step={10}
                    value={co2Ppm}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPreviousRate(outputs.activeRate);
                      setCo2Ppm(val);
                      setCo2InputStr(String(val));
                      if (mode === 'baseline') setMode('extended');
                    }}
                    className="w-full sci-slider bg-slate-700"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>0 ppm</span>
                    <span>Ref: 400 ppm (1.00×)</span>
                    <span>1200 ppm</span>
                  </div>
                </div>

                {/* Leaf Temperature Control */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label
                      htmlFor="temp-slider"
                      className="inline-flex items-center gap-1 text-slate-300 font-medium"
                    >
                      <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                      <span>Leaf Temperature</span>
                    </label>
                    <span className="font-mono text-xs font-semibold text-rose-300 tabular-nums">
                      {temperatureC.toFixed(1)} °C
                    </span>
                  </div>
                  <input
                    id="temp-slider"
                    type="range"
                    min={0}
                    max={45}
                    step={0.5}
                    value={temperatureC}
                    onChange={(e) => {
                      setPreviousRate(outputs.activeRate);
                      setTemperatureC(Number(e.target.value));
                      if (mode === 'baseline') setMode('extended');
                    }}
                    className="w-full sci-slider bg-slate-700"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>0 °C</span>
                    <span>Optimum: 25 °C</span>
                    <span>45 °C</span>
                  </div>
                </div>

                {/* Water Availability Control */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label
                      htmlFor="water-slider"
                      className="inline-flex items-center gap-1 text-slate-300 font-medium"
                    >
                      <Droplets className="w-3.5 h-3.5 text-sky-400" />
                      <span>Water Availability</span>
                    </label>
                    <span className="font-mono text-xs font-semibold text-sky-300 tabular-nums">
                      {waterPct.toFixed(0)} %
                    </span>
                  </div>
                  <input
                    id="water-slider"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={waterPct}
                    onChange={(e) => {
                      setPreviousRate(outputs.activeRate);
                      setWaterPct(Number(e.target.value));
                      if (mode === 'baseline') setMode('extended');
                    }}
                    className="w-full sci-slider bg-slate-700"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>0% (Wilting)</span>
                    <span>50%</span>
                    <span>100% (Turgid)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Simulation Transport, Speed & Recording Controls */}
            <div className="pt-3 border-t border-emerald-900/40 space-y-2">
              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isPlaying
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                      : 'bg-emerald-500 text-slate-950'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    theme === 'dark'
                      ? 'border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-800'
                      : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddObservation}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Save Run</span>
                </button>
              </div>

              {/* Simulation Speed Multiplier Bar */}
              <div className="flex items-center justify-between text-xs pt-0.5">
                <span className="text-[11px] text-slate-400">Simulation Speed:</span>
                <div className="flex items-center gap-1">
                  {[0.5, 1, 2, 4].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setSimSpeed(spd)}
                      className={`px-2 py-0.5 rounded font-mono text-[11px] cursor-pointer ${
                        simSpeed === spd
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {spd}×
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* CENTER COLUMN (5/12 ≈ 42–45%): ANIMATED PLANT & LIGHT SIMULATION STAGE */}
          <section
            aria-label="Animated Plant and Sunlight Visualization"
            className="lg:col-span-5 flex flex-col justify-between"
          >
            <BotanicalStage
              inputs={inputs}
              outputs={outputs}
              isPlaying={isPlaying}
              simSpeed={simSpeed}
              theme={theme}
            />
          </section>

          {/* RIGHT COLUMN (4/12 ≈ 30–33%): LIVE METRICS, LIMITING FACTOR & AI DIAGNOSTICS */}
          <section
            aria-label="Live Telemetry and Physiological Diagnostics"
            className={`lg:col-span-4 rounded-xl border p-3 flex flex-col justify-between gap-2.5 ${
              theme === 'dark'
                ? 'bg-[#0e1f18] border-emerald-900/50'
                : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div className="space-y-2.5">
              {/* Top 2 Hero Readout Cards */}
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={`p-2.5 rounded-xl border ${
                    theme === 'dark'
                      ? 'bg-[#0a1510] border-emerald-900/50'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                    Photosynthesis Rate
                  </div>
                  <div
                    className="font-mono text-2xl font-bold text-emerald-400 mt-0.5 tabular-nums"
                    data-testid="metric-photosynthesis-rate"
                  >
                    {outputs.activeRate.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                    µmol CO₂ m⁻² s⁻¹
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-xl border ${
                    theme === 'dark'
                      ? 'bg-[#0a1510] border-emerald-900/50'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                    Oxygen Evolution
                  </div>
                  <div
                    className="font-mono text-2xl font-bold text-sky-400 mt-0.5 tabular-nums"
                    data-testid="metric-oxygen-rate"
                  >
                    {outputs.estimatedO2Rate.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-mono whitespace-nowrap">
                    µmol O₂ m⁻² s⁻¹ · {outputs.bubbleEmissionRate.toFixed(1)} bubbles/s
                  </div>
                </div>
              </div>

              {/* Secondary Quantitative Telemetry Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div
                  className={`p-2.5 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-[#0a1510] border-emerald-900/40'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    CO₂ Uptake
                  </div>
                  <div className="font-mono text-sm font-bold text-amber-300 mt-0.5 tabular-nums">
                    {outputs.co2UptakeRate.toFixed(2)}
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">µmol m⁻² s⁻¹</div>
                </div>

                <div
                  className={`p-2.5 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-[#0a1510] border-emerald-900/40'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    % of Pmax (20)
                  </div>
                  <div className="font-mono text-sm font-bold text-emerald-300 mt-0.5 tabular-nums">
                    {outputs.percentOfPmax.toFixed(1)}%
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">Asymptote</div>
                </div>

                <div
                  className={`p-2.5 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-[#0a1510] border-emerald-900/40'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    Local dR/dI
                  </div>
                  <div className="font-mono text-sm font-bold text-purple-300 mt-0.5 tabular-nums">
                    {outputs.analyticalSlope.toFixed(3)}
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">per klux</div>
                </div>
              </div>

              {/* Blackman's Limiting Factor Diagnostic Panel (Non-hue-only state signaling) */}
              <div
                className={`p-3 rounded-xl border ${
                  theme === 'dark'
                    ? 'bg-[#0a1510] border-emerald-900/50'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Primary Limiting Factor
                  </span>
                  {outputs.limitingFactor.severity === 'nominal' && (
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>● NOMINAL</span>
                    </span>
                  )}
                  {outputs.limitingFactor.severity === 'moderate' && (
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-amber-400">
                      <TriangleAlert className="w-3.5 h-3.5" />
                      <span>▲ CO-LIMITED</span>
                    </span>
                  )}
                  {outputs.limitingFactor.severity === 'limiting' && (
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-rose-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>✖ BOTTLENECK</span>
                    </span>
                  )}
                </div>

                <div className="text-sm font-bold mt-1 text-white">
                  {outputs.limitingFactor.factor}
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {outputs.limitingFactor.explanation}
                </p>

                {/* Active Multi-Factor Multipliers Readout */}
                <div className="mt-2.5 pt-2 border-t border-emerald-900/40 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-slate-400">
                  <span>f_Light: {(outputs.multipliers.lightFraction * 100).toFixed(0)}%</span>
                  <span>·</span>
                  <span>f_CO₂: {outputs.multipliers.co2Multiplier.toFixed(2)}×</span>
                  <span>·</span>
                  <span>f_Temp: {outputs.multipliers.temperatureMultiplier.toFixed(2)}×</span>
                  <span>·</span>
                  <span>f_H₂O: {outputs.multipliers.waterMultiplier.toFixed(2)}×</span>
                </div>
              </div>
            </div>

            {/* Gemini AI Instant Experimental Diagnostic & Consultant Trigger */}
            <div
              className={`p-3 rounded-xl border ${
                theme === 'dark'
                  ? 'bg-[#10241b] border-emerald-800/50'
                  : 'bg-emerald-50/70 border-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                  <Activity className="w-3.5 h-3.5" />
                  <span>AI Physiological Diagnostic</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleGenerateQuickAiAnalysis}
                    disabled={isGeneratingBrief}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{isGeneratingBrief ? 'Analyzing...' : 'Analyze State'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsChatOpen(true)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-emerald-400 hover:bg-emerald-300 text-slate-950 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Bot className="w-3 h-3" />
                    <span>Open Chat</span>
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                {aiBriefText ||
                  `${outputs.regime.headline} ${outputs.regime.detail} Click "Analyze State" or "Open Chat" to consult the Gemini Biology Tutor.`}
              </p>
            </div>
          </section>
        </div>

        {/* BOTTOM ANALYTICAL SECTION 1: INTERACTIVE SCIENTIFIC GRAPHS (A, B, C, D, E) */}
        <section id="scientific-graphs" aria-label="Interactive Scientific Graphs">
          <ScientificGraphs
            activeTab={activeGraphTab}
            onSelectTab={setActiveGraphTab}
            inputs={inputs}
            outputs={outputs}
            previousRate={previousRate}
            visitedLightLevels={visitedLightLevels}
            onSweepLight={() => setIsSweeping(true)}
            isSweeping={isSweeping}
            onClearVisitedPoints={() => setVisitedLightLevels([Math.round(lightKlux)])}
            onSelectLightFromGraph={(klux) => applyLightKlux(klux)}
            timeSeriesData={timeSeriesData}
            savedObservations={observations}
            selectedCompareIds={selectedCompareIds}
            theme={theme}
          />
        </section>

        {/* BOTTOM ANALYTICAL SECTION 2: LIVE EXPERIMENT OBSERVATIONS TABLE & BIOSCIENCE EXPLORER */}
        <section id="experiment-records" aria-label="Experiment Observations and Bioscience Data">
          <ExperimentTableAndBioExplorer
            observations={observations}
            selectedCompareIds={selectedCompareIds}
            onToggleCompareId={(id) =>
              setSelectedCompareIds((prev) =>
                prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
              )
            }
            onAddObservation={handleAddObservation}
            onClearObservations={() => {
              setObservations([]);
              setSelectedCompareIds([]);
            }}
            onSwitchToComparisonGraph={() => setActiveGraphTab('graphE')}
            theme={theme}
          />
        </section>
      </main>

      {/* MULTI-TURN GEMINI BIOLOGY & PHOTOSYNTHESIS CONSULTANT DRAWER */}
      <BiologyChatbotModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        inputs={inputs}
        outputs={outputs}
        savedCount={observations.length}
        theme={theme}
      />
    </div>
  );
}
