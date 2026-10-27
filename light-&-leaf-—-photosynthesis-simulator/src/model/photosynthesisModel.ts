/**
 * Pure Scientific Model for Light & Leaf Photosynthesis Simulator
 *
 * Baseline Model (Rectangular Hyperbola / Michaelis-Menten Light-Response):
 *   R_base(I) = (Pmax * I) / (I + K)
 *   where:
 *     Pmax = 20 µmol CO₂ m⁻² s⁻¹ (theoretical asymptotic maximum rate)
 *     K    = 25 klux (half-saturation constant where R = Pmax / 2 = 10)
 *     I    = sunlight intensity in klux [0, 100]
 *
 * Analytical Derivative (Local Slope with respect to Light Intensity):
 *   dR/dI = (Pmax * K) / (I + K)²  [µmol CO₂ m⁻² s⁻¹ klux⁻¹]
 *
 * Extended Illustrative Multi-Factor Teaching Model:
 *   R_ext(I, C, T, W) = R_base(I) * f_CO2(C) * f_temp(T) * f_water(W)
 *   Normalized such that at standard reference conditions
 *   (CO₂ = 400 ppm, Temp = 25 °C, Water = 100%), f_CO2 = f_temp = f_water = 1.00.
 */

export const MODEL_CONSTANTS = {
  P_MAX: 20, // µmol CO₂ m⁻² s⁻¹
  K_LIGHT: 25, // klux half-saturation constant
  DEFAULT_LIGHT_KLUX: 40, // klux (yields ~12.3077 µmol CO₂ m⁻² s⁻¹)
  REF_CO2_PPM: 400, // ambient reference CO₂ concentration in ppm (µmol mol⁻¹)
  K_CO2_PPM: 250, // illustrative Michaelis constant for CO₂ response (ppm)
  OPT_TEMP_C: 25, // optimal leaf temperature (°C) for C3 teaching plant
  MIN_TEMP_C: 0, // minimum thermal threshold (°C)
  MAX_TEMP_C: 45, // thermal inactivation ceiling (°C)
  REF_WATER_PCT: 100, // optimal relative soil/leaf water availability (%)
  K_WATER_PCT: 20, // half-saturation water availability (%)
  BUBBLE_VISUAL_SCALE: 0.35, // illustrative scaling factor: 12.31 µmol -> ~4.3 bubbles/s (matching original Light & Leaf)
  STOICHIOMETRIC_O2_PER_CO2: 1.0, // approximate 1:1 molar photosynthetic quotient (O₂ evolved per CO₂ fixed)
} as const;

export type ModelMode = 'baseline' | 'extended';

export interface EnvironmentPreset {
  id: string;
  label: string;
  lightKlux: number;
  description: string;
}

export const ENVIRONMENT_PRESETS: EnvironmentPreset[] = [
  {
    id: 'dark',
    label: 'Dark',
    lightKlux: 0,
    description: '0 klux — Zero light-driven carbon fixation.',
  },
  {
    id: 'shade',
    label: 'Shade',
    lightKlux: 10,
    description: '10 klux — Forest understory or deep indoor shade (light-limited).',
  },
  {
    id: 'overcast',
    label: 'Overcast',
    lightKlux: 25,
    description: '25 klux — Half-saturation point (K = 25 klux, exactly 50% of Pmax).',
  },
  {
    id: 'bright',
    label: 'Bright',
    lightKlux: 60,
    description: '60 klux — Clear daylight; diminishing marginal gains as enzymes saturate.',
  },
  {
    id: 'full_sun',
    label: 'Full sun',
    lightKlux: 100,
    description: '100 klux — Direct midday sunlight (80% of theoretical asymptote Pmax).',
  },
];

export interface SimulationInputs {
  lightKlux: number; // 0 to 100 klux
  co2Ppm: number; // 0 to 1200 ppm
  temperatureC: number; // 0 to 45 °C
  waterPct: number; // 0 to 100 %
  mode: ModelMode;
}

export interface SimulationOutputs {
  baselineRate: number; // µmol CO₂ m⁻² s⁻¹
  extendedRate: number; // µmol CO₂ m⁻² s⁻¹
  activeRate: number; // µmol CO₂ m⁻² s⁻¹ (equals baselineRate in baseline mode, extendedRate in extended mode)
  estimatedO2Rate: number; // µmol O₂ m⁻² s⁻¹ (1:1 stoichiometric teaching assumption)
  co2UptakeRate: number; // µmol CO₂ m⁻² s⁻¹
  bubbleEmissionRate: number; // illustrative bubbles / second shown in scene
  percentOfPmax: number; // % of baseline Pmax (20 µmol CO₂ m⁻² s⁻¹)
  analyticalSlope: number; // dR/dI in µmol CO₂ m⁻² s⁻¹ klux⁻¹
  marginalGain10Klux: number; // ΔR if light increases by +10 klux from current I
  limitingFactor: {
    factor: 'Light Intensity' | 'CO₂ Availability' | 'Temperature Stress' | 'Water Stress (Stomatal Closure)' | 'Carboxylation Capacity (Near Saturation)';
    severity: 'nominal' | 'moderate' | 'limiting';
    explanation: string;
  };
  regime: {
    id: 'zero' | 'light_limited' | 'transition' | 'near_saturation';
    headline: string;
    detail: string;
  };
  multipliers: {
    lightFraction: number; // I / (I + K) in [0, 0.8]
    co2Multiplier: number; // normalized to 1.0 at 400 ppm
    temperatureMultiplier: number; // normalized to 1.0 at 25 °C
    waterMultiplier: number; // normalized to 1.0 at 100 %
  };
}

export interface ExperimentObservation {
  id: string;
  runNumber: number;
  timestamp: string;
  elapsedSeconds: number;
  mode: ModelMode;
  lightKlux: number;
  co2Ppm: number;
  temperatureC: number;
  waterPct: number;
  predictedRate: number;
  baselineRate: number;
  estimatedO2Rate: number;
  bubbleRate: number;
  percentOfPmax: number;
  analyticalSlope: number;
  limitingFactorLabel: string;
  notes?: string;
}

/**
 * Clamp a numeric value safely into [min, max].
 */
export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Baseline rectangular hyperbola light-response equation:
 *   Rate = Pmax * I / (I + K)
 */
export function calculateBaselineRate(lightKlux: number): number {
  const I = Math.max(0, Number.isFinite(lightKlux) ? lightKlux : 0);
  if (I === 0) return 0;
  const { P_MAX, K_LIGHT } = MODEL_CONSTANTS;
  return Math.max(0, (P_MAX * I) / (I + K_LIGHT));
}

/**
 * Analytical first derivative of the baseline equation with respect to I:
 *   dR/dI = (Pmax * K) / (I + K)²  [µmol CO₂ m⁻² s⁻¹ klux⁻¹]
 */
export function calculateBaselineSlope(lightKlux: number): number {
  const I = Math.max(0, Number.isFinite(lightKlux) ? lightKlux : 0);
  const { P_MAX, K_LIGHT } = MODEL_CONSTANTS;
  const denom = I + K_LIGHT;
  return (P_MAX * K_LIGHT) / (denom * denom);
}

/**
 * Documented CO₂ response multiplier for the Extended Multi-Factor Model.
 * Uses saturating Michaelis-Menten kinetics normalized so f_CO2(400 ppm) = 1.00.
 * At 0 ppm -> 0.00. At 400 ppm -> 1.00. At 800 ppm -> ~1.238. At 1200 ppm -> ~1.345.
 */
export function calculateCo2Multiplier(co2Ppm: number): number {
  const C = Math.max(0, Number.isFinite(co2Ppm) ? co2Ppm : 0);
  if (C === 0) return 0;
  const { REF_CO2_PPM, K_CO2_PPM } = MODEL_CONSTANTS;
  const refTerm = REF_CO2_PPM / (REF_CO2_PPM + K_CO2_PPM); // 400 / 650
  const currentTerm = C / (C + K_CO2_PPM);
  return Math.max(0, currentTerm / refTerm);
}

/**
 * Documented Temperature response multiplier for a typical C3 mesophilic plant.
 * Asymmetric bell-shaped cardinal temperature function:
 *   T_min = 0 °C, T_opt = 25 °C (multiplier = 1.00), T_max = 45 °C (multiplier = 0.00).
 * Captures slower enzymatic turnover in cold conditions and rapid photorespiration /
 * Rubisco activase thermal lability above 28–30 °C.
 */
export function calculateTemperatureMultiplier(temperatureC: number): number {
  if (!Number.isFinite(temperatureC)) return 0;
  const T = temperatureC;
  const { MIN_TEMP_C, OPT_TEMP_C, MAX_TEMP_C } = MODEL_CONSTANTS;
  if (T <= MIN_TEMP_C || T >= MAX_TEMP_C) return 0;
  if (Math.abs(T - OPT_TEMP_C) < 1e-6) return 1;

  // Cardinal temperature response function (Briand / Yan & Hunt form)
  const ratio1 = (MAX_TEMP_C - T) / (MAX_TEMP_C - OPT_TEMP_C);
  const ratio2 = (T - MIN_TEMP_C) / (OPT_TEMP_C - MIN_TEMP_C);
  const exponent = (OPT_TEMP_C - MIN_TEMP_C) / (MAX_TEMP_C - OPT_TEMP_C);
  const val = ratio1 * Math.pow(ratio2, exponent);
  return clampNumber(val, 0, 1);
}

/**
 * Documented Water availability response multiplier [0, 1].
 * Models stomatal conductance and leaf turgor maintenance.
 * Normalized so f_water(100%) = 1.00 and f_water(0%) = 0.00.
 */
export function calculateWaterMultiplier(waterPct: number): number {
  const W = clampNumber(waterPct, 0, 100);
  if (W === 0) return 0;
  const { REF_WATER_PCT, K_WATER_PCT } = MODEL_CONSTANTS;
  const refTerm = REF_WATER_PCT / (REF_WATER_PCT + K_WATER_PCT); // 100 / 120
  const currentTerm = W / (W + K_WATER_PCT);
  return clampNumber(currentTerm / refTerm, 0, 1);
}

/**
 * Evaluates both the Baseline and Extended models for a given input state,
 * returning all derived biological rates, slopes, regimes, and limiting-factor diagnostics.
 */
export function evaluateSimulation(inputs: SimulationInputs): SimulationOutputs {
  const lightKlux = clampNumber(inputs.lightKlux, 0, 100);
  const co2Ppm = clampNumber(inputs.co2Ppm, 0, 1200);
  const temperatureC = clampNumber(inputs.temperatureC, 0, 45);
  const waterPct = clampNumber(inputs.waterPct, 0, 100);

  const baselineRate = calculateBaselineRate(lightKlux);
  const co2Multiplier = calculateCo2Multiplier(co2Ppm);
  const temperatureMultiplier = calculateTemperatureMultiplier(temperatureC);
  const waterMultiplier = calculateWaterMultiplier(waterPct);

  const envProduct = co2Multiplier * temperatureMultiplier * waterMultiplier;
  const extendedRate = Math.max(0, baselineRate * envProduct);

  const activeRate = inputs.mode === 'baseline' ? baselineRate : extendedRate;
  const baseSlope = calculateBaselineSlope(lightKlux);
  const analyticalSlope = inputs.mode === 'baseline' ? baseSlope : baseSlope * envProduct;

  // Marginal gain if light increases by +10 klux (clamped to 100 klux max or evaluated at I+10)
  const ratePlus10Base = calculateBaselineRate(lightKlux + 10);
  const ratePlus10 =
    inputs.mode === 'baseline' ? ratePlus10Base : ratePlus10Base * envProduct;
  const marginalGain10Klux = Math.max(0, ratePlus10 - activeRate);

  const estimatedO2Rate = activeRate * MODEL_CONSTANTS.STOICHIOMETRIC_O2_PER_CO2;
  const co2UptakeRate = activeRate;
  const bubbleEmissionRate = activeRate * MODEL_CONSTANTS.BUBBLE_VISUAL_SCALE;
  const percentOfPmax = (activeRate / MODEL_CONSTANTS.P_MAX) * 100;
  const lightFraction = lightKlux === 0 ? 0 : lightKlux / (lightKlux + MODEL_CONSTANTS.K_LIGHT);

  // Determine regime description (matching the original Light & Leaf educational tone + quantitative depth)
  let regime: SimulationOutputs['regime'];
  if (lightKlux <= 0.2 || activeRate <= 0.01) {
    regime = {
      id: 'zero',
      headline: 'Photosynthesis halted.',
      detail:
        lightKlux <= 0.2
          ? 'In darkness (0 klux), light-dependent reactions in the thylakoid membrane stop.'
          : 'An extreme environmental limiting factor (CO₂, temperature, or water stress) has reduced net fixation to zero.',
    };
  } else if (lightKlux < 25) {
    regime = {
      id: 'light_limited',
      headline: 'Steep light-limited gains.',
      detail:
        'Photon flux is the primary bottleneck. Small increases in klux drive a large rise in electron transport and carbon fixation.',
    };
  } else if (lightKlux < 65) {
    regime = {
      id: 'transition',
      headline: 'Gains are slowing.',
      detail:
        'Each extra klux adds less than the one before as Calvin cycle enzymes and electron carriers begin to saturate.',
    };
  } else {
    regime = {
      id: 'near_saturation',
      headline: 'Approaching light saturation.',
      detail:
        'The curve flattens toward the theoretical asymptote; downstream biochemical capacity (RuBisCO & CO₂ diffusion) now limits the rate.',
    };
  }

  // Determine primary limiting factor (Blackman's Law of Limiting Factors)
  let limitingFactor: SimulationOutputs['limitingFactor'];

  if (inputs.mode === 'baseline') {
    if (lightKlux < 25) {
      limitingFactor = {
        factor: 'Light Intensity',
        severity: 'limiting',
        explanation: `At ${lightKlux.toFixed(0)} klux (below K = 25 klux), photon absorption in Photosystems I & II limits ATP and NADPH supply.`,
      };
    } else if (lightKlux < 65) {
      limitingFactor = {
        factor: 'Light Intensity',
        severity: 'moderate',
        explanation: `Co-limitation transition: light (${lightKlux.toFixed(0)} klux) still increases rate, but downstream dark reactions increasingly constrain output.`,
      };
    } else {
      limitingFactor = {
        factor: 'Carboxylation Capacity (Near Saturation)',
        severity: 'nominal',
        explanation: `At high irradiance (${lightKlux.toFixed(0)} klux), light is abundant; the baseline model flattens because enzyme & CO₂ capacity are fixed in Pmax = 20.`,
      };
    }
  } else {
    // Extended multi-factor mode: compare normalized bottleneck severities
    const bottlenecks: Array<{
      name: SimulationOutputs['limitingFactor']['factor'];
      val: number;
      explanation: string;
    }> = [
      {
        name: 'Light Intensity',
        val: lightFraction / 0.8, // normalized against 100 klux max (0.80 of Pmax)
        explanation: `Low irradiance (${lightKlux.toFixed(0)} klux) restricts thylakoid electron transport and photophosphorylation.`,
      },
      {
        name: 'CO₂ Availability',
        val: Math.min(1, co2Multiplier),
        explanation: `Sub-ambient CO₂ (${co2Ppm.toFixed(0)} ppm vs 400 ppm ref) limits RuBisCO carboxylation velocity in the stroma.`,
      },
      {
        name: 'Temperature Stress',
        val: temperatureMultiplier,
        explanation:
          temperatureC < 20
            ? `Cool leaf temperature (${temperatureC.toFixed(1)} °C vs 25 °C opt) slows enzymatic turnover in the Calvin-Benson cycle.`
            : `Elevated temperature (${temperatureC.toFixed(1)} °C vs 25 °C opt) accelerates photorespiration and destabilizes Rubisco activase.`,
      },
      {
        name: 'Water Stress (Stomatal Closure)',
        val: waterMultiplier,
        explanation: `Reduced water availability (${waterPct.toFixed(0)}%) triggers abscisic acid (ABA)-mediated stomatal closure, restricting gas exchange.`,
      },
    ];

    bottlenecks.sort((a, b) => a.val - b.val);
    const worst = bottlenecks[0];

    if (worst.val < 0.55) {
      limitingFactor = {
        factor: worst.name,
        severity: 'limiting',
        explanation: worst.explanation,
      };
    } else if (worst.val < 0.85) {
      limitingFactor = {
        factor: worst.name,
        severity: 'moderate',
        explanation: worst.explanation,
      };
    } else {
      limitingFactor = {
        factor: 'Carboxylation Capacity (Near Saturation)',
        severity: 'nominal',
        explanation: `All environmental inputs are near or above reference optima; rate is governed by intrinsic biochemical capacity.`,
      };
    }
  }

  return {
    baselineRate,
    extendedRate,
    activeRate,
    estimatedO2Rate,
    co2UptakeRate,
    bubbleEmissionRate,
    percentOfPmax,
    analyticalSlope,
    marginalGain10Klux,
    limitingFactor,
    regime,
    multipliers: {
      lightFraction,
      co2Multiplier,
      temperatureMultiplier,
      waterMultiplier,
    },
  };
}

/**
 * Safely computes percentage change between a previous and current rate,
 * explicitly handling zero denominators without NaN or Infinity.
 */
export function calculateSafePercentChange(
  previousRate: number,
  currentRate: number
): { delta: number; percentChange: number | null; formatted: string } {
  const delta = currentRate - previousRate;
  if (Math.abs(previousRate) < 1e-9) {
    if (Math.abs(currentRate) < 1e-9) {
      return { delta: 0, percentChange: 0, formatted: '0.0%' };
    }
    return {
      delta,
      percentChange: null,
      formatted: 'N/A (from 0 baseline)',
    };
  }
  const percentChange = (delta / previousRate) * 100;
  const sign = percentChange > 0 ? '+' : '';
  return {
    delta,
    percentChange,
    formatted: `${sign}${percentChange.toFixed(1)}%`,
  };
}

/**
 * Formats recorded experiment observations into a RFC-4180 compliant CSV string.
 */
export function exportObservationsToCsv(observations: ExperimentObservation[]): string {
  const headers = [
    'Experiment_ID',
    'Timestamp',
    'Elapsed_Time_s',
    'Model_Mode',
    'Light_Intensity_klux',
    'CO2_Concentration_ppm',
    'Temperature_C',
    'Water_Availability_pct',
    'Predicted_Photosynthesis_Rate_umol_CO2_m2_s',
    'Baseline_Theoretical_Rate_umol_CO2_m2_s',
    'Estimated_O2_Output_umol_O2_m2_s',
    'Illustrative_Bubble_Rate_per_s',
    'Percent_of_Pmax',
    'Local_Slope_dR_dI_umol_per_klux',
    'Limiting_Factor',
  ];

  const escapeCsvCell = (val: string | number): string => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = observations.map((obs) =>
    [
      obs.id,
      obs.timestamp,
      obs.elapsedSeconds.toFixed(1),
      obs.mode,
      obs.lightKlux.toFixed(1),
      obs.co2Ppm.toFixed(0),
      obs.temperatureC.toFixed(1),
      obs.waterPct.toFixed(0),
      obs.predictedRate.toFixed(4),
      obs.baselineRate.toFixed(4),
      obs.estimatedO2Rate.toFixed(4),
      obs.bubbleRate.toFixed(2),
      obs.percentOfPmax.toFixed(2),
      obs.analyticalSlope.toFixed(4),
      obs.limitingFactorLabel,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
