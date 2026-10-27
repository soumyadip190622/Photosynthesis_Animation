import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODEL_CONSTANTS,
  calculateBaselineRate,
  calculateBaselineSlope,
  calculateCo2Multiplier,
  calculateTemperatureMultiplier,
  calculateWaterMultiplier,
  evaluateSimulation,
  calculateSafePercentChange,
  exportObservationsToCsv,
} from './photosynthesisModel';

test('baseline light-response equation matches exact mathematical targets', () => {
  // At 0 klux, rate must be exactly 0
  assert.equal(calculateBaselineRate(0), 0);

  // Negative inputs are clamped safely to 0
  assert.equal(calculateBaselineRate(-15), 0);

  // At K = 25 klux (Overcast), rate must be exactly Pmax / 2 = 10.00
  assert.equal(calculateBaselineRate(25), 10);

  // At default 40 klux, rate is 20 * 40 / (40 + 25) = 800 / 65 ≈ 12.307692
  const rate40 = calculateBaselineRate(40);
  assert.ok(Math.abs(rate40 - 12.3076923) < 1e-5, `Expected ~12.31, got ${rate40}`);

  // At 100 klux (Full sun), rate is 20 * 100 / (100 + 25) = 2000 / 125 = 16.00
  assert.equal(calculateBaselineRate(100), 16);
});

test('analytical slope dR/dI = Pmax * K / (I + K)^2 is accurate', () => {
  // At I = 0 klux: dR/dI = (20 * 25) / 625 = 500 / 625 = 0.80 µmol CO₂ m⁻² s⁻¹ klux⁻¹
  assert.equal(calculateBaselineSlope(0), 0.8);

  // At I = 25 klux: dR/dI = 500 / 2500 = 0.20
  assert.equal(calculateBaselineSlope(25), 0.2);

  // At I = 100 klux: dR/dI = 500 / 15625 = 0.032
  assert.equal(calculateBaselineSlope(100), 0.032);
});

test('extended multi-factor model aligns with baseline at reference conditions and responds to stress', () => {
  // At reference conditions (400 ppm CO2, 25 °C, 100% water), multipliers equal 1.0
  assert.ok(Math.abs(calculateCo2Multiplier(MODEL_CONSTANTS.REF_CO2_PPM) - 1) < 1e-6);
  assert.ok(Math.abs(calculateTemperatureMultiplier(MODEL_CONSTANTS.OPT_TEMP_C) - 1) < 1e-6);
  assert.ok(Math.abs(calculateWaterMultiplier(MODEL_CONSTANTS.REF_WATER_PCT) - 1) < 1e-6);

  const refEval = evaluateSimulation({
    lightKlux: 40,
    co2Ppm: 400,
    temperatureC: 25,
    waterPct: 100,
    mode: 'extended',
  });
  assert.ok(Math.abs(refEval.activeRate - refEval.baselineRate) < 1e-5);

  // Elevated CO2 (800 ppm) increases rate above baseline
  const highCo2Eval = evaluateSimulation({
    lightKlux: 40,
    co2Ppm: 800,
    temperatureC: 25,
    waterPct: 100,
    mode: 'extended',
  });
  assert.ok(highCo2Eval.activeRate > refEval.baselineRate);

  // Extreme drought (0% water) reduces extended rate to 0 without altering baselineRate
  const droughtEval = evaluateSimulation({
    lightKlux: 40,
    co2Ppm: 400,
    temperatureC: 25,
    waterPct: 0,
    mode: 'extended',
  });
  assert.equal(droughtEval.activeRate, 0);
  assert.ok(droughtEval.baselineRate > 12.3);
  assert.equal(droughtEval.limitingFactor.factor, 'Water Stress (Stomatal Closure)');
});

test('safe percentage change handles zero denominators gracefully', () => {
  const fromZero = calculateSafePercentChange(0, 12.31);
  assert.equal(fromZero.percentChange, null);
  assert.equal(fromZero.formatted, 'N/A (from 0 baseline)');

  const zeroToZero = calculateSafePercentChange(0, 0);
  assert.equal(zeroToZero.percentChange, 0);
  assert.equal(zeroToZero.formatted, '0.0%');

  const normalGain = calculateSafePercentChange(10, 16);
  assert.equal(normalGain.percentChange, 60);
  assert.equal(normalGain.formatted, '+60.0%');
});

test('CSV export formats observation rows with proper headers and precision', () => {
  const csv = exportObservationsToCsv([
    {
      id: 'EXP-001',
      runNumber: 1,
      timestamp: '10:00:00',
      elapsedSeconds: 12.5,
      mode: 'baseline',
      lightKlux: 40,
      co2Ppm: 400,
      temperatureC: 25,
      waterPct: 100,
      predictedRate: 12.3077,
      baselineRate: 12.3077,
      estimatedO2Rate: 12.3077,
      bubbleRate: 4.31,
      percentOfPmax: 61.54,
      analyticalSlope: 0.1183,
      limitingFactorLabel: 'Light Intensity',
    },
  ]);

  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('Predicted_Photosynthesis_Rate_umol_CO2_m2_s'));
  assert.ok(lines[1].includes('EXP-001,10:00:00,12.5,baseline,40.0,400,25.0,100,12.3077'));
});
