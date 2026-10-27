import React, { useMemo, useState } from 'react';
import {
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Play,
  Trash2,
  Info,
  TrendingUp,
} from 'lucide-react';
import {
  MODEL_CONSTANTS,
  SimulationInputs,
  SimulationOutputs,
  ExperimentObservation,
  calculateBaselineRate,
  evaluateSimulation,
  calculateSafePercentChange,
} from '../model/photosynthesisModel';

export type GraphTabId = 'graphA' | 'graphB' | 'graphC' | 'graphD' | 'graphE';

export interface TimeSeriesPoint {
  timeSec: number;
  lightKlux: number;
  photosynthesisRate: number;
  o2Rate: number;
  co2Ppm: number;
  temperatureC: number;
}

interface ScientificGraphsProps {
  activeTab: GraphTabId;
  onSelectTab: (tab: GraphTabId) => void;
  inputs: SimulationInputs;
  outputs: SimulationOutputs;
  previousRate: number;
  visitedLightLevels: number[];
  onSweepLight: () => void;
  isSweeping: boolean;
  onClearVisitedPoints: () => void;
  onSelectLightFromGraph: (klux: number) => void;
  timeSeriesData: TimeSeriesPoint[];
  savedObservations: ExperimentObservation[];
  selectedCompareIds: string[];
  theme: 'dark' | 'light';
}

export const ScientificGraphs: React.FC<ScientificGraphsProps> = ({
  activeTab,
  onSelectTab,
  inputs,
  outputs,
  previousRate,
  visitedLightLevels,
  onSweepLight,
  isSweeping,
  onClearVisitedPoints,
  onSelectLightFromGraph,
  timeSeriesData,
  savedObservations,
  selectedCompareIds,
  theme,
}) => {
  const [zoomDomainMax, setZoomDomainMax] = useState<100 | 50>(100);
  const [hoverLightKlux, setHoverLightKlux] = useState<number | null>(null);
  const [showExtendedComparison, setShowExtendedComparison] = useState<boolean>(true);
  const [envFactorSubTab, setEnvFactorSubTab] = useState<'co2' | 'temperature' | 'water'>('co2');

  // SVG Chart coordinate geometry
  const W = 680;
  const H = 215;
  const PAD = { top: 18, right: 24, bottom: 36, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Environmental Multiplier Product for Extended Curve
  const envProduct =
    outputs.multipliers.co2Multiplier *
    outputs.multipliers.temperatureMultiplier *
    outputs.multipliers.waterMultiplier;

  const yMaxRate = Math.max(22, Math.ceil(20 * envProduct + 2));

  // Generate smooth theoretical curve points for Graph A & B
  const lightCurvePoints = useMemo(() => {
    const pts: Array<{
      I: number;
      baseRate: number;
      extRate: number;
      o2Rate: number;
      bubbleRate: number;
    }> = [];
    const step = zoomDomainMax === 50 ? 1 : 2;
    for (let I = 0; I <= zoomDomainMax; I += step) {
      const baseRate = calculateBaselineRate(I);
      const extRate = baseRate * envProduct;
      const active = inputs.mode === 'baseline' ? baseRate : extRate;
      pts.push({
        I,
        baseRate,
        extRate,
        o2Rate: active * MODEL_CONSTANTS.STOICHIOMETRIC_O2_PER_CO2,
        bubbleRate: active * MODEL_CONSTANTS.BUBBLE_VISUAL_SCALE,
      });
    }
    return pts;
  }, [zoomDomainMax, envProduct, inputs.mode]);

  // Environmental Factor Response Curve for Graph C
  const factorCurvePoints = useMemo(() => {
    const pts: Array<{ x: number; y: number }> = [];
    if (envFactorSubTab === 'co2') {
      for (let c = 0; c <= 1200; c += 25) {
        const res = evaluateSimulation({
          ...inputs,
          co2Ppm: c,
          mode: 'extended',
        });
        pts.push({ x: c, y: res.extendedRate });
      }
    } else if (envFactorSubTab === 'temperature') {
      for (let t = 0; t <= 45; t += 1) {
        const res = evaluateSimulation({
          ...inputs,
          temperatureC: t,
          mode: 'extended',
        });
        pts.push({ x: t, y: res.extendedRate });
      }
    } else {
      for (let w = 0; w <= 100; w += 2) {
        const res = evaluateSimulation({
          ...inputs,
          waterPct: w,
          mode: 'extended',
        });
        pts.push({ x: w, y: res.extendedRate });
      }
    }
    return pts;
  }, [envFactorSubTab, inputs]);

  // Export current graph's underlying series as CSV
  const handleExportGraphCsv = () => {
    let csv = '';
    if (activeTab === 'graphA' || activeTab === 'graphB') {
      csv = [
        'Light_Intensity_klux,Theoretical_Baseline_Rate_umol_m2_s,Extended_Model_Rate_umol_m2_s,Estimated_O2_Evolution_umol_m2_s,Illustrative_Bubble_Rate_s',
        ...lightCurvePoints.map(
          (p) =>
            `${p.I},${p.baseRate.toFixed(4)},${p.extRate.toFixed(4)},${p.o2Rate.toFixed(4)},${p.bubbleRate.toFixed(2)}`
        ),
      ].join('\n');
    } else if (activeTab === 'graphC') {
      const colName =
        envFactorSubTab === 'co2'
          ? 'CO2_ppm'
          : envFactorSubTab === 'temperature'
          ? 'Temperature_C'
          : 'Water_Availability_pct';
      csv = [
        `${colName},Modeled_Photosynthesis_Rate_umol_CO2_m2_s`,
        ...factorCurvePoints.map((p) => `${p.x},${p.y.toFixed(4)}`),
      ].join('\n');
    } else if (activeTab === 'graphD') {
      csv = [
        'Elapsed_Time_s,Light_klux,Photosynthesis_Rate_umol_m2_s,Estimated_O2_umol_m2_s,CO2_ppm,Temperature_C',
        ...timeSeriesData.map(
          (p) =>
            `${p.timeSec.toFixed(1)},${p.lightKlux.toFixed(1)},${p.photosynthesisRate.toFixed(4)},${p.o2Rate.toFixed(4)},${p.co2Ppm},${p.temperatureC}`
        ),
      ].join('\n');
    } else {
      csv = [
        'Experiment_ID,Light_klux,CO2_ppm,Temp_C,Water_pct,Predicted_Rate_umol_m2_s',
        ...savedObservations.map(
          (o) =>
            `${o.id},${o.lightKlux},${o.co2Ppm},${o.temperatureC},${o.waterPct},${o.predictedRate.toFixed(4)}`
        ),
      ].join('\n');
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `light_and_leaf_${activeTab}_data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rateChangeInfo = calculateSafePercentChange(previousRate, outputs.activeRate);

  const comparedRuns = useMemo(() => {
    if (selectedCompareIds.length > 0) {
      return savedObservations.filter((o) => selectedCompareIds.includes(o.id));
    }
    return savedObservations.slice(0, 6);
  }, [savedObservations, selectedCompareIds]);

  const xToPx = (val: number, maxVal: number) =>
    PAD.left + (Math.min(maxVal, Math.max(0, val)) / maxVal) * plotW;
  const yToPx = (val: number, maxVal: number) =>
    PAD.top + plotH - (Math.min(maxVal, Math.max(0, val)) / maxVal) * plotH;

  return (
    <div
      className={`rounded-xl border flex flex-col ${
        theme === 'dark'
          ? 'bg-[#0e1f18] border-emerald-900/50 text-slate-100'
          : 'bg-white border-slate-200 text-slate-900 shadow-xs'
      }`}
    >
      {/* Top Bar: Graph Selection Tabs + Action Controls */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b ${
          theme === 'dark' ? 'border-emerald-900/40 bg-[#0a1611]' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div
          className="flex flex-wrap items-center gap-1"
          role="tablist"
          aria-label="Scientific Graph Views"
        >
          {[
            { id: 'graphA', label: 'A. Light vs. Rate' },
            { id: 'graphB', label: 'B. Light vs. O₂ Output' },
            { id: 'graphC', label: 'C. Environmental Factors' },
            { id: 'graphD', label: 'D. Live Time-Series' },
            { id: 'graphE', label: `E. Run Comparison (${savedObservations.length})` },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectTab(tab.id as GraphTabId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-emerald-500 text-slate-950 font-semibold shadow-xs'
                    : theme === 'dark'
                    ? 'text-slate-300 hover:bg-emerald-950/60 hover:text-white'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Graph Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(activeTab === 'graphA' || activeTab === 'graphB') && (
            <>
              <button
                type="button"
                onClick={onSweepLight}
                disabled={isSweeping}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-400 hover:bg-emerald-300 text-slate-950 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isSweeping ? 'Sweeping...' : 'Sweep 0 to 100'}</span>
              </button>

              <button
                type="button"
                onClick={onClearVisitedPoints}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  theme === 'dark'
                    ? 'border-emerald-800/70 bg-emerald-950/40 text-slate-200 hover:bg-emerald-900/50'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear graph</span>
              </button>

              <button
                type="button"
                onClick={() => setZoomDomainMax((z) => (z === 100 ? 50 : 100))}
                title="Toggle X-Axis Zoom (0–50 klux vs 0–100 klux)"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  zoomDomainMax === 50
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                    : theme === 'dark'
                    ? 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {zoomDomainMax === 100 ? (
                  <>
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Zoom 0–50 klux</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Zoom (0–100)</span>
                  </>
                )}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleExportGraphCsv}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              theme === 'dark'
                ? 'border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Graph CSV</span>
          </button>
        </div>
      </div>

      {/* Main Graph Body + Side-by-Side Automated Scientific Interpretation */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 p-4 items-stretch">
        {/* SVG Chart Container (8 cols on XL) */}
        <div className="xl:col-span-8 flex flex-col justify-between">
          {/* Sub-header for active graph */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div>
              {activeTab === 'graphA' && (
                <p className="text-xs text-slate-400">
                  Theoretical Michaelis-Menten hyperbola{' '}
                  <span className="font-mono text-emerald-400">
                    R = Pmax × I / (I + K)
                  </span>
                  . Every light level you visit plots a point on the curve. Click anywhere on the plot to jump to that klux.
                </p>
              )}
              {activeTab === 'graphB' && (
                <p className="text-xs text-slate-400">
                  Estimated O₂ evolution rate assuming an approximate 1:1 molar photosynthetic quotient (O₂ released per CO₂ fixed) alongside visual bubble scaling.
                </p>
              )}
              {activeTab === 'graphC' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">Inspect single factor response:</span>
                  {(['co2', 'temperature', 'water'] as const).map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setEnvFactorSubTab(sub)}
                      className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                        envFactorSubTab === sub
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sub === 'co2'
                        ? 'CO₂ Concentration (ppm)'
                        : sub === 'temperature'
                        ? 'Leaf Temperature (°C)'
                        : 'Water Availability (%)'}
                    </button>
                  ))}
                </div>
              )}
              {activeTab === 'graphD' && (
                <p className="text-xs text-slate-400">
                  Real-time evolution of modeled photosynthesis rate and sunlight intensity (/5 scaled) over elapsed simulation time.
                </p>
              )}
              {activeTab === 'graphE' && (
                <p className="text-xs text-slate-400">
                  Side-by-side comparison of saved experimental conditions. Save conditions from the controls or table to compare predicted rates.
                </p>
              )}
            </div>

            {activeTab === 'graphA' && (
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showExtendedComparison}
                  onChange={(e) => setShowExtendedComparison(e.target.checked)}
                  className="rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Show Baseline vs. Extended overlay</span>
              </label>
            )}
          </div>

          {/* Interactive SVG Plot */}
          <div className="relative w-full overflow-hidden rounded-lg border border-emerald-950/60 bg-[#091510]">
            {(activeTab === 'graphA' || activeTab === 'graphB') && (
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-auto block cursor-crosshair"
                role="img"
                aria-label={
                  activeTab === 'graphA'
                    ? 'Light intensity versus photosynthesis rate graph'
                    : 'Light intensity versus estimated oxygen production graph'
                }
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX = ((e.clientX - rect.left) / rect.width) * W;
                  const clampedPx = Math.max(PAD.left, Math.min(W - PAD.right, relX));
                  const klux = ((clampedPx - PAD.left) / plotW) * zoomDomainMax;
                  setHoverLightKlux(Math.round(klux));
                }}
                onMouseLeave={() => setHoverLightKlux(null)}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX = ((e.clientX - rect.left) / rect.width) * W;
                  if (relX >= PAD.left && relX <= W - PAD.right) {
                    const klux = Math.round(((relX - PAD.left) / plotW) * zoomDomainMax);
                    onSelectLightFromGraph(klux);
                  }
                }}
              >
                {/* Horizontal Grid Lines & Y-Axis Ticks */}
                {[0, 5, 10, 15, 20].map((yTick) => {
                  const py = yToPx(yTick, yMaxRate);
                  return (
                    <g key={yTick}>
                      <line
                        x1={PAD.left}
                        y1={py}
                        x2={W - PAD.right}
                        y2={py}
                        stroke="#1e3a2f"
                        strokeWidth="1"
                      />
                      <text
                        x={PAD.left - 8}
                        y={py + 4}
                        textAnchor="end"
                        className="fill-slate-400 font-mono text-[11px]"
                      >
                        {yTick}
                      </text>
                    </g>
                  );
                })}

                {/* Theoretical Asymptote Pmax = 20 Reference Line */}
                <line
                  x1={PAD.left}
                  y1={yToPx(20, yMaxRate)}
                  x2={W - PAD.right}
                  y2={yToPx(20, yMaxRate)}
                  stroke="#64748b"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={W - PAD.right - 4}
                  y={yToPx(20, yMaxRate) - 5}
                  textAnchor="end"
                  className="fill-slate-400 font-mono text-[10px]"
                >
                  Theoretical Asymptote Pmax = 20
                </text>

                {/* Vertical Grid Lines & X-Axis Ticks */}
                {(zoomDomainMax === 100
                  ? [0, 20, 40, 60, 80, 100]
                  : [0, 10, 20, 30, 40, 50]
                ).map((xTick) => {
                  const px = xToPx(xTick, zoomDomainMax);
                  return (
                    <g key={xTick}>
                      <line
                        x1={px}
                        y1={PAD.top}
                        x2={px}
                        y2={H - PAD.bottom}
                        stroke="#1e3a2f"
                        strokeWidth="1"
                      />
                      <text
                        x={px}
                        y={H - PAD.bottom + 16}
                        textAnchor="middle"
                        className="fill-slate-400 font-mono text-[11px]"
                      >
                        {xTick}
                      </text>
                    </g>
                  );
                })}

                {/* Axis Titles */}
                <text
                  x={PAD.left + plotW / 2}
                  y={H - 6}
                  textAnchor="middle"
                  className="fill-slate-300 text-[11px] font-semibold"
                >
                  Light intensity (klux)
                </text>
                <text
                  x={14}
                  y={PAD.top + plotH / 2}
                  textAnchor="middle"
                  transform={`rotate(-90, 14, ${PAD.top + plotH / 2})`}
                  className="fill-slate-300 text-[11px] font-semibold"
                >
                  {activeTab === 'graphA'
                    ? 'Rate (µmol CO₂ m⁻² s⁻¹)'
                    : 'Est. O₂ Output (µmol O₂ m⁻² s⁻¹)'}
                </text>

                {/* Area fill under active curve */}
                <path
                  d={`M ${xToPx(0, zoomDomainMax)},${yToPx(0, yMaxRate)} ` +
                    lightCurvePoints
                      .map((p) => {
                        const val =
                          activeTab === 'graphA'
                            ? inputs.mode === 'baseline'
                              ? p.baseRate
                              : p.extRate
                            : p.o2Rate;
                        return `L ${xToPx(p.I, zoomDomainMax).toFixed(1)},${yToPx(val, yMaxRate).toFixed(1)}`;
                      })
                      .join(' ') +
                    ` L ${xToPx(zoomDomainMax, zoomDomainMax)},${yToPx(0, yMaxRate)} Z`}
                  fill={activeTab === 'graphA' ? 'rgba(52, 211, 153, 0.12)' : 'rgba(56, 189, 248, 0.12)'}
                />

                {/* Baseline Theoretical Curve (Dashed when in Extended Mode for comparison) */}
                {(inputs.mode === 'baseline' || showExtendedComparison) && (
                  <polyline
                    fill="none"
                    stroke={
                      activeTab === 'graphB'
                        ? '#38bdf8'
                        : inputs.mode === 'baseline'
                        ? '#4ade80'
                        : '#94a3b8'
                    }
                    strokeWidth={inputs.mode === 'baseline' ? '2.6' : '1.6'}
                    strokeDasharray={inputs.mode === 'extended' ? '5 4' : undefined}
                    points={lightCurvePoints
                      .map(
                        (p) =>
                          `${xToPx(p.I, zoomDomainMax).toFixed(1)},${yToPx(
                             p.baseRate,
                            yMaxRate
                          ).toFixed(1)}`
                      )
                      .join(' ')}
                  />
                )}

                {/* Extended Multi-Factor Model Curve */}
                {(inputs.mode === 'extended' ||
                  (showExtendedComparison && Math.abs(envProduct - 1) > 0.01)) && (
                  <polyline
                    fill="none"
                    stroke={activeTab === 'graphB' ? '#0284c7' : '#34d399'}
                    strokeWidth={inputs.mode === 'extended' ? '2.6' : '1.8'}
                    points={lightCurvePoints
                      .map(
                        (p) =>
                          `${xToPx(p.I, zoomDomainMax).toFixed(1)},${yToPx(
                            p.extRate,
                            yMaxRate
                          ).toFixed(1)}`
                      )
                      .join(' ')}
                  />
                )}

                {/* Visited Light Intensity Sample Dots on the Curve (Preserving Light & Leaf signature interaction) */}
                {visitedLightLevels
                  .filter((lvl) => lvl <= zoomDomainMax)
                  .map((lvl) => {
                    const baseR = calculateBaselineRate(lvl);
                    const yVal =
                      inputs.mode === 'baseline' ? baseR : baseR * envProduct;
                    return (
                      <circle
                        key={lvl}
                        cx={xToPx(lvl, zoomDomainMax)}
                        cy={yToPx(yVal, yMaxRate)}
                        r="3.2"
                        fill={activeTab === 'graphA' ? '#4ade80' : '#38bdf8'}
                      />
                    );
                  })}

                {/* Current Operating Point Dashed Guide Lines & Highlight Marker */}
                {inputs.lightKlux <= zoomDomainMax && (
                  <g>
                    <line
                      x1={PAD.left}
                      y1={yToPx(outputs.activeRate, yMaxRate)}
                      x2={xToPx(inputs.lightKlux, zoomDomainMax)}
                      y2={yToPx(outputs.activeRate, yMaxRate)}
                      stroke="#facc15"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <line
                      x1={xToPx(inputs.lightKlux, zoomDomainMax)}
                      y1={yToPx(outputs.activeRate, yMaxRate)}
                      x2={xToPx(inputs.lightKlux, zoomDomainMax)}
                      y2={H - PAD.bottom}
                      stroke="#facc15"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <circle
                      cx={xToPx(inputs.lightKlux, zoomDomainMax)}
                      cy={yToPx(outputs.activeRate, yMaxRate)}
                      r="6.5"
                      fill="#f59e0b"
                      stroke="#fef9c3"
                      strokeWidth="2.5"
                    />
                  </g>
                )}

                {/* Interactive Crosshair Hover Probe */}
                {hoverLightKlux !== null && hoverLightKlux <= zoomDomainMax && (
                  <g>
                    <line
                      x1={xToPx(hoverLightKlux, zoomDomainMax)}
                      y1={PAD.top}
                      x2={xToPx(hoverLightKlux, zoomDomainMax)}
                      y2={H - PAD.bottom}
                      stroke="rgba(226, 232, 240, 0.35)"
                      strokeWidth="1"
                    />
                    {(() => {
                      const hBase = calculateBaselineRate(hoverLightKlux);
                      const hRate =
                        inputs.mode === 'baseline' ? hBase : hBase * envProduct;
                      const px = xToPx(hoverLightKlux, zoomDomainMax);
                      const py = yToPx(hRate, yMaxRate);
                      const boxX = px > W - 165 ? px - 148 : px + 10;
                      const boxY = Math.max(PAD.top + 4, py - 28);
                      return (
                        <g>
                          <circle cx={px} cy={py} r="4" fill="#38bdf8" stroke="#fff" strokeWidth="1.5" />
                          <rect
                            x={boxX}
                            y={boxY}
                            width="138"
                            height="38"
                            rx="5"
                            fill="rgba(15, 23, 42, 0.92)"
                            stroke="rgba(148, 163, 184, 0.3)"
                          />
                          <text
                            x={boxX + 8}
                            y={boxY + 15}
                            className="fill-amber-300 font-mono text-[10px]"
                          >
                            I = {hoverLightKlux} klux
                          </text>
                          <text
                            x={boxX + 8}
                            y={boxY + 30}
                            className="fill-emerald-300 font-mono text-[10px]"
                          >
                            Rate = {hRate.toFixed(2)} µmol/m²/s
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                )}
              </svg>
            )}

            {/* Graph C: Environmental Factor Sensitivity Curve */}
            {activeTab === 'graphC' && (
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-auto block"
                role="img"
                aria-label={`Photosynthesis response to ${envFactorSubTab}`}
              >
                {(() => {
                  const maxX =
                    envFactorSubTab === 'co2'
                      ? 1200
                      : envFactorSubTab === 'temperature'
                      ? 45
                      : 100;
                  const currentX =
                    envFactorSubTab === 'co2'
                      ? inputs.co2Ppm
                      : envFactorSubTab === 'temperature'
                      ? inputs.temperatureC
                      : inputs.waterPct;
                  const currentEval = evaluateSimulation({
                    ...inputs,
                    mode: 'extended',
                  });

                  const xTicks =
                    envFactorSubTab === 'co2'
                      ? [0, 200, 400, 600, 800, 1000, 1200]
                      : envFactorSubTab === 'temperature'
                      ? [0, 10, 20, 25, 30, 40, 45]
                      : [0, 20, 40, 60, 80, 100];

                  return (
                    <>
                      {[0, 5, 10, 15, 20].map((yTick) => {
                        const py = yToPx(yTick, yMaxRate);
                        return (
                          <g key={yTick}>
                            <line
                              x1={PAD.left}
                              y1={py}
                              x2={W - PAD.right}
                              y2={py}
                              stroke="#1e3a2f"
                              strokeWidth="1"
                            />
                            <text
                              x={PAD.left - 8}
                              y={py + 4}
                              textAnchor="end"
                              className="fill-slate-400 font-mono text-[11px]"
                            >
                              {yTick}
                            </text>
                          </g>
                        );
                      })}

                      {xTicks.map((xt) => {
                        const px = xToPx(xt, maxX);
                        return (
                          <g key={xt}>
                            <line
                              x1={px}
                              y1={PAD.top}
                              x2={px}
                              y2={H - PAD.bottom}
                              stroke="#1e3a2f"
                              strokeWidth="1"
                            />
                            <text
                              x={px}
                              y={H - PAD.bottom + 16}
                              textAnchor="middle"
                              className="fill-slate-400 font-mono text-[11px]"
                            >
                              {xt}
                            </text>
                          </g>
                        );
                      })}

                      <polyline
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="2.6"
                        points={factorCurvePoints
                          .map((p) => `${xToPx(p.x, maxX).toFixed(1)},${yToPx(p.y, yMaxRate).toFixed(1)}`)
                          .join(' ')}
                      />

                      <line
                        x1={xToPx(currentX, maxX)}
                        y1={yToPx(currentEval.extendedRate, yMaxRate)}
                        x2={xToPx(currentX, maxX)}
                        y2={H - PAD.bottom}
                        stroke="#facc15"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <circle
                        cx={xToPx(currentX, maxX)}
                        cy={yToPx(currentEval.extendedRate, yMaxRate)}
                        r="6"
                        fill="#f59e0b"
                        stroke="#fef9c3"
                        strokeWidth="2"
                      />

                      <text
                        x={PAD.left + plotW / 2}
                        y={H - 6}
                        textAnchor="middle"
                        className="fill-slate-300 text-[11px] font-semibold"
                      >
                        {envFactorSubTab === 'co2'
                          ? 'CO₂ Concentration (ppm) — Holding Light, Temp, Water constant'
                          : envFactorSubTab === 'temperature'
                          ? 'Leaf Temperature (°C) — Cardinal Thermal Response (Optimum = 25 °C)'
                          : 'Water Availability (%) — Stomatal Conductance Response'}
                      </text>
                      <text
                        x={14}
                        y={PAD.top + plotH / 2}
                        textAnchor="middle"
                        transform={`rotate(-90, 14, ${PAD.top + plotH / 2})`}
                        className="fill-slate-300 text-[11px] font-semibold"
                      >
                        Extended Rate (µmol m⁻² s⁻¹)
                      </text>
                    </>
                  );
                })()}
              </svg>
            )}

            {/* Graph D: Real-Time Time-Series Simulation */}
            {activeTab === 'graphD' && (
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-auto block"
                role="img"
                aria-label="Time-series photosynthesis simulation graph"
              >
                {(() => {
                  const series = timeSeriesData.length > 0 ? timeSeriesData : [
                    {
                      timeSec: 0,
                      lightKlux: inputs.lightKlux,
                      photosynthesisRate: outputs.activeRate,
                      o2Rate: outputs.estimatedO2Rate,
                      co2Ppm: inputs.co2Ppm,
                      temperatureC: inputs.temperatureC,
                    },
                  ];
                  const minT = series[0].timeSec;
                  const maxT = Math.max(minT + 10, series[series.length - 1].timeSec);
                  const tSpan = Math.max(1, maxT - minT);

                  const mapTimeX = (t: number) => PAD.left + ((t - minT) / tSpan) * plotW;

                  return (
                    <>
                      {[0, 5, 10, 15, 20].map((yTick) => {
                        const py = yToPx(yTick, 22);
                        return (
                          <g key={yTick}>
                            <line
                              x1={PAD.left}
                              y1={py}
                              x2={W - PAD.right}
                              y2={py}
                              stroke="#1e3a2f"
                              strokeWidth="1"
                            />
                            <text
                              x={PAD.left - 8}
                              y={py + 4}
                              textAnchor="end"
                              className="fill-slate-400 font-mono text-[11px]"
                            >
                              {yTick}
                            </text>
                          </g>
                        );
                      })}

                      {/* Scaled Light Intensity (I / 5) trace */}
                      <polyline
                        fill="none"
                        stroke="#facc15"
                        strokeWidth="1.6"
                        strokeDasharray="3 3"
                        points={series
                          .map((pt) => `${mapTimeX(pt.timeSec).toFixed(1)},${yToPx(pt.lightKlux / 5, 22).toFixed(1)}`)
                          .join(' ')}
                      />

                      {/* Photosynthesis Rate trace */}
                      <polyline
                        fill="none"
                        stroke="#4ade80"
                        strokeWidth="2.5"
                        points={series
                          .map(
                            (pt) =>
                              `${mapTimeX(pt.timeSec).toFixed(1)},${yToPx(pt.photosynthesisRate, 22).toFixed(1)}`
                          )
                          .join(' ')}
                      />

                      <text
                        x={PAD.left + plotW / 2}
                        y={H - 6}
                        textAnchor="middle"
                        className="fill-slate-300 text-[11px] font-semibold"
                      >
                        Elapsed Simulation Time ({minT.toFixed(0)}s – {maxT.toFixed(0)}s)
                      </text>
                      <text
                        x={14}
                        y={PAD.top + plotH / 2}
                        textAnchor="middle"
                        transform={`rotate(-90, 14, ${PAD.top + plotH / 2})`}
                        className="fill-slate-300 text-[11px] font-semibold"
                      >
                        Rate (µmol m⁻² s⁻¹) | Light÷5
                      </text>
                    </>
                  );
                })()}
              </svg>
            )}

            {/* Graph E: Environmental Run Comparison Bar Chart */}
            {activeTab === 'graphE' && (
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-auto block"
                role="img"
                aria-label="Comparison of saved experimental conditions"
              >
                {[0, 5, 10, 15, 20].map((yTick) => {
                  const py = yToPx(yTick, 22);
                  return (
                    <g key={yTick}>
                      <line
                        x1={PAD.left}
                        y1={py}
                        x2={W - PAD.right}
                        y2={py}
                        stroke="#1e3a2f"
                        strokeWidth="1"
                      />
                      <text
                        x={PAD.left - 8}
                        y={py + 4}
                        textAnchor="end"
                        className="fill-slate-400 font-mono text-[11px]"
                      >
                        {yTick}
                      </text>
                    </g>
                  );
                })}

                {comparedRuns.length === 0 ? (
                  <text
                    x={W / 2}
                    y={H / 2}
                    textAnchor="middle"
                    className="fill-slate-400 text-xs"
                  >
                    No saved runs yet. Click "Record Observation" to compare experimental conditions.
                  </text>
                ) : (
                  comparedRuns.map((run, idx) => {
                    const slotW = plotW / comparedRuns.length;
                    const barW = Math.min(54, slotW * 0.55);
                    const bx = PAD.left + idx * slotW + (slotW - barW) / 2;
                    const by = yToPx(run.predictedRate, 22);
                    const bh = H - PAD.bottom - by;
                    return (
                      <g key={run.id}>
                        <rect
                          x={bx}
                          y={by}
                          width={barW}
                          height={Math.max(2, bh)}
                          rx="4"
                          fill={run.mode === 'baseline' ? '#4ade80' : '#38bdf8'}
                        />
                        <text
                          x={bx + barW / 2}
                          y={by - 6}
                          textAnchor="middle"
                          className="fill-emerald-300 font-mono text-[10px] font-semibold"
                        >
                          {run.predictedRate.toFixed(2)}
                        </text>
                        <text
                          x={bx + barW / 2}
                          y={H - PAD.bottom + 14}
                          textAnchor="middle"
                          className="fill-slate-300 font-mono text-[10px]"
                        >
                          {run.id} ({run.lightKlux}klx)
                        </text>
                        <text
                          x={bx + barW / 2}
                          y={H - PAD.bottom + 27}
                          textAnchor="middle"
                          className="fill-slate-400 font-mono text-[9px]"
                        >
                          {run.co2Ppm}ppm·{run.temperatureC}°C
                        </text>
                      </g>
                    );
                  })
                )}
              </svg>
            )}
          </div>

          {/* Graph Legend & Mathematical Footnote */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                <span>Theoretical model curve</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-yellow-100 inline-block" />
                <span>Current setting ({inputs.lightKlux.toFixed(0)} klux)</span>
              </span>
              {inputs.mode === 'extended' && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-slate-400 inline-block" />
                  <span>Baseline reference (dashed)</span>
                </span>
              )}
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              Model: rate = Pmax × I ÷ (I + K), with Pmax = 20 and K = 25 klux
            </span>
          </div>
        </div>

        {/* Right 4 Columns: Live Mathematical & Physiological Graph Interpretation */}
        <div
          className={`xl:col-span-4 rounded-xl border p-3.5 flex flex-col justify-between gap-3 ${
            theme === 'dark'
              ? 'bg-[#0a1510] border-emerald-900/40'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Quantitative Curve Analysis</span>
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                I = {inputs.lightKlux.toFixed(0)} klux
              </span>
            </div>

            {/* Regime Headline Banner (Matches Screenshot 1 "Gains are slowing...") */}
            <div
              className={`p-3 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-[#11241b] border-emerald-800/50'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="font-semibold text-sm text-emerald-300">
                {outputs.regime.headline}
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {outputs.regime.detail}
              </p>
            </div>

            {/* Analytical Calculus & Marginal Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div
                className={`p-2.5 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-[#0e1d16] border-emerald-900/40'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-[11px] text-slate-400">Local Slope (dR/dI)</div>
                <div className="font-mono text-sm font-bold text-amber-300 mt-0.5 tabular-nums">
                  {outputs.analyticalSlope.toFixed(3)}
                </div>
                <div className="font-mono text-[10px] text-slate-400">
                  µmol CO₂ m⁻² s⁻¹ klux⁻¹
                </div>
              </div>

              <div
                className={`p-2.5 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-[#0e1d16] border-emerald-900/40'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-[11px] text-slate-400">Marginal Gain (+10 klux)</div>
                <div className="font-mono text-sm font-bold text-emerald-300 mt-0.5 tabular-nums">
                  +{outputs.marginalGain10Klux.toFixed(2)}
                </div>
                <div className="font-mono text-[10px] text-slate-400">
                  µmol CO₂ m⁻² s⁻¹
                </div>
              </div>

              <div
                className={`p-2.5 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-[#0e1d16] border-emerald-900/40'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-[11px] text-slate-400">Step Δ vs. Previous</div>
                <div className="font-mono text-sm font-bold text-sky-300 mt-0.5 tabular-nums">
                  {rateChangeInfo.delta >= 0 ? '+' : ''}
                  {rateChangeInfo.delta.toFixed(2)} ({rateChangeInfo.formatted})
                </div>
                <div className="font-mono text-[10px] text-slate-400">
                  From {previousRate.toFixed(2)} µmol/m²/s
                </div>
              </div>

              <div
                className={`p-2.5 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-[#0e1d16] border-emerald-900/40'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-[11px] text-slate-400">Asymptote Proximity</div>
                <div className="font-mono text-sm font-bold text-purple-300 mt-0.5 tabular-nums">
                  {outputs.percentOfPmax.toFixed(1)}%
                </div>
                <div className="font-mono text-[10px] text-slate-400">
                  of baseline Pmax (20.0)
                </div>
              </div>
            </div>
          </div>

          {/* Scientific Honesty & Assumptions Disclosure */}
          <div className="pt-2 border-t border-emerald-900/40 text-[11px] text-slate-400 flex items-start gap-2 leading-relaxed">
            <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Model Scope:</strong> Values represent deterministic mathematical predictions (
              <span className="font-mono">dR/dI = Pmax·K/(I+K)²</span>), not live IRGA sensor measurements. The asymptote Pmax = 20 is a model parameter; real leaves vary by species, dark respiration, and photoinhibition.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
