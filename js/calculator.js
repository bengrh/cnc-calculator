// calculator.js — Speed & Feed calculation logic and unit conversion
// Depends on: data.js (CNCData global)

// -------------------------------------------------------------------
// Unit Conversion
// -------------------------------------------------------------------
const UnitConverter = {
  inchesToMM(v)        { return v * 25.4; },
  mmToInches(v)        { return v / 25.4; },
  sfmToMMin(v)         { return v * 0.3048; },
  mMinToSFM(v)         { return v / 0.3048; },
  inPerToothToMM(v)    { return v * 25.4; },
  mmPerToothToIn(v)    { return v / 25.4; },
  inPerMinToMMPerMin(v){ return v * 25.4; },
  mmPerMinToInPerMin(v){ return v / 25.4; },

  // Normalize any diameter value to inches for table lookups
  toInches(val, unit) {
    return unit === 'metric' ? this.mmToInches(val) : val;
  },

  // Convert the mutable calc state fields from one unit system to another.
  // Note: rpm stays the same across unit systems.
  convertCalcState(state, fromUnit, toUnit) {
    if (fromUnit === toUnit) return;
    const toMetric = toUnit === 'metric';
    state.diameter = toMetric ? this.inchesToMM(state.diameter) : this.mmToInches(state.diameter);
    state.chipLoad = toMetric ? this.inPerToothToMM(state.chipLoad) : this.mmPerToothToIn(state.chipLoad);
    // feedRate stored in in/min (imperial) or mm/min (metric) — convert on unit switch
    if (state.feedRate) {
      state.feedRate = toMetric
        ? this.inPerMinToMMPerMin(state.feedRate)
        : this.mmPerMinToInPerMin(state.feedRate);
    }
  },
};

// -------------------------------------------------------------------
// Core Calculator
// -------------------------------------------------------------------
const Calculator = {

  // Feed rate from RPM, flutes, chip load (unit-agnostic — result units
  // match chip load units: in/min if imperial, mm/min if metric)
  calcFeedRate(rpm, flutes, chipLoad) {
    if (!rpm || !flutes || !chipLoad) return null;
    return rpm * flutes * chipLoad;
  },

  // Suggested RPM from surface speed and diameter (reference only)
  calcSuggestedRPM(surfaceSpeed, diameter, unit) {
    if (!surfaceSpeed || !diameter) return null;
    if (unit === 'imperial') {
      return (surfaceSpeed * 3.82) / diameter;  // SFM formula
    } else {
      return (surfaceSpeed * 1000) / (Math.PI * diameter); // m/min formula
    }
  },

  // Run a full calculation and return a result object (or null if incomplete).
  // rpm is now the PRIMARY input — feed rate is derived from it.
  calculate(params) {
    const { rpm, diameter, flutes, chipLoad, unit, materialKey } = params;
    if (!rpm || !diameter || !flutes || !chipLoad) return null;

    const feedRate = this.calcFeedRate(rpm, flutes, chipLoad);
    if (feedRate === null) return null;

    const recs = CNCData.stepRecommendations[materialKey];
    let stepDownMin = null, stepDownMax = null;
    let stepOverMin = null, stepOverMax = null;

    if (recs) {
      stepDownMin = diameter * recs.stepDownMin;
      stepDownMax = diameter * recs.stepDownMax;
      stepOverMin = diameter * recs.stepOverMin;
      stepOverMax = diameter * recs.stepOverMax;
    }

    return { rpm, feedRate, stepDownMin, stepDownMax, stepOverMin, stepOverMax };
  },
};

// -------------------------------------------------------------------
// Preset lookup — returns suggested starting values for chip load
// and a suggested RPM (from surface speed tables) for reference.
// -------------------------------------------------------------------
function getPresets(materialKey, toolMaterial, diameterInches, unit) {
  const speedRange = CNCData.surfaceSpeeds[materialKey]?.[toolMaterial];
  const diamKey    = CNCData.getDiameterRangeKey(diameterInches);
  const chipTable  = CNCData.chipLoads[materialKey]?.[diamKey];

  if (!speedRange || !chipTable) return null;

  const chipIn  = chipTable[toolMaterial] ?? chipTable['carbide'];
  const sfmMid  = (speedRange[0] + speedRange[1]) / 2;
  const sfmMin  = speedRange[0];
  const sfmMax  = speedRange[1];

  const toMet = unit === 'metric';

  // Suggested RPM from surface speed mid-point and diameter
  const suggestedRPM = diameterInches > 0
    ? Math.round((sfmMid * 3.82) / diameterInches)
    : null;
  const suggestedRPMMin = diameterInches > 0
    ? Math.round((sfmMin * 3.82) / diameterInches)
    : null;
  const suggestedRPMMax = diameterInches > 0
    ? Math.round((sfmMax * 3.82) / diameterInches)
    : null;

  return {
    // Chip load (for display hints)
    chipLoad:        toMet ? UnitConverter.inPerToothToMM(chipIn)       : chipIn,
    chipLoadMin:     toMet ? UnitConverter.inPerToothToMM(chipIn * 0.7) : chipIn * 0.7,
    chipLoadMax:     toMet ? UnitConverter.inPerToothToMM(chipIn * 1.3) : chipIn * 1.3,
    // SFM range (for display in the hint card, shown as feed-rate context)
    surfaceSpeedMin: toMet ? UnitConverter.sfmToMMin(sfmMin) : sfmMin,
    surfaceSpeedMax: toMet ? UnitConverter.sfmToMMin(sfmMax) : sfmMax,
    surfaceSpeed:    toMet ? UnitConverter.sfmToMMin(sfmMid) : sfmMid,
    // Suggested RPM derived from surface speed (reference only)
    suggestedRPM,
    suggestedRPMMin,
    suggestedRPMMax,
  };
}
