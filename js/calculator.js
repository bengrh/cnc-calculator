// calculator.js — Speed & Feed calculation logic and unit conversion
// Depends on: data.js (CNCData global)

// -------------------------------------------------------------------
// Unit Conversion
// -------------------------------------------------------------------
const UnitConverter = {
  inchesToMM(v)       { return v * 25.4; },
  mmToInches(v)       { return v / 25.4; },
  sfmToMMin(v)        { return v * 0.3048; },
  mMinToSFM(v)        { return v / 0.3048; },
  inPerToothToMM(v)   { return v * 25.4; },
  mmPerToothToIn(v)   { return v / 25.4; },
  inPerMinToMMPerMin(v){ return v * 25.4; },
  mmPerMinToInPerMin(v){ return v / 25.4; },

  // Normalize any diameter value to inches for table lookups
  toInches(val, unit) {
    return unit === 'metric' ? this.mmToInches(val) : val;
  },

  // Convert the mutable calc state fields from one unit system to another
  convertCalcState(state, fromUnit, toUnit) {
    if (fromUnit === toUnit) return;
    const toMetric = toUnit === 'metric';
    state.diameter     = toMetric ? this.inchesToMM(state.diameter)       : this.mmToInches(state.diameter);
    state.surfaceSpeed = toMetric ? this.sfmToMMin(state.surfaceSpeed)     : this.mMinToSFM(state.surfaceSpeed);
    state.chipLoad     = toMetric ? this.inPerToothToMM(state.chipLoad)    : this.mmPerToothToIn(state.chipLoad);
  },
};

// -------------------------------------------------------------------
// Core Calculator
// -------------------------------------------------------------------
const Calculator = {

  // RPM from surface speed and diameter
  calcRPM(surfaceSpeed, diameter, unit) {
    if (!surfaceSpeed || !diameter) return null;
    if (unit === 'imperial') {
      return (surfaceSpeed * 3.82) / diameter;
    } else {
      return (surfaceSpeed * 1000) / (Math.PI * diameter);
    }
  },

  // Feed rate from RPM, flutes, chip load
  calcFeedRate(rpm, flutes, chipLoad) {
    if (!rpm || !flutes || !chipLoad) return null;
    return rpm * flutes * chipLoad;
  },

  // Run a full calculation and return a result object (or null if incomplete)
  calculate(params) {
    const { surfaceSpeed, diameter, flutes, chipLoad, unit, materialKey } = params;
    if (!surfaceSpeed || !diameter || !flutes || !chipLoad) return null;

    const rpm      = this.calcRPM(surfaceSpeed, diameter, unit);
    const feedRate = this.calcFeedRate(rpm, flutes, chipLoad);
    if (rpm === null || feedRate === null) return null;

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
// Preset lookup — returns suggested starting values for surface speed
// and chip load given a material, tool material, diameter, and unit.
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
  return {
    surfaceSpeed:    toMet ? UnitConverter.sfmToMMin(sfmMid) : sfmMid,
    surfaceSpeedMin: toMet ? UnitConverter.sfmToMMin(sfmMin) : sfmMin,
    surfaceSpeedMax: toMet ? UnitConverter.sfmToMMin(sfmMax) : sfmMax,
    chipLoad:        toMet ? UnitConverter.inPerToothToMM(chipIn)        : chipIn,
    chipLoadMin:     toMet ? UnitConverter.inPerToothToMM(chipIn * 0.7)  : chipIn * 0.7,
    chipLoadMax:     toMet ? UnitConverter.inPerToothToMM(chipIn * 1.3)  : chipIn * 1.3,
  };
}
