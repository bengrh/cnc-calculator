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
    state.diameter  = toMetric ? this.inchesToMM(state.diameter)  : this.mmToInches(state.diameter);
    state.chipLoad  = toMetric ? this.inPerToothToMM(state.chipLoad) : this.mmPerToothToIn(state.chipLoad);
    state.feedRate  = toMetric ? this.inPerMinToMMPerMin(state.feedRate) : this.mmPerMinToInPerMin(state.feedRate);
    // sfm ↔ m/min
    state.sfm = toMetric ? this.sfmToMMin(state.sfm) : this.mMinToSFM(state.sfm);
  },
};

// -------------------------------------------------------------------
// Depth-of-cut chip load adjustment factors
// -------------------------------------------------------------------
const DOC_FACTORS = {
  1: 1.00,   // 1× diameter: no adjustment
  2: 0.75,   // 2× diameter: −25%
  3: 0.50,   // 3× diameter: −50%
};

// -------------------------------------------------------------------
// Bidirectional Formula Engine
//
// Fields: rpm, feedrate, chipload, sfm
// The user can lock any subset of fields. When they edit one unlocked
// field, we solve for the remaining unlocked fields using the locked
// values as anchors, in priority order.
//
// Formulas (imperial):
//   RPM       = (SFM × 3.82) / diameter
//   SFM       = (RPM × π × diameter) / 12
//   FeedRate  = RPM × flutes × chipLoad
//   ChipLoad  = FeedRate / (RPM × flutes)
//
// In metric (diameter in mm, SFM becomes m/min):
//   RPM       = (Vc × 1000) / (π × diameter)
//   Vc(m/min) = (RPM × π × diameter) / 1000
//   FeedRate  = RPM × flutes × chipLoad  (mm/min)
//   ChipLoad  = FeedRate / (RPM × flutes) (mm/tooth)
// -------------------------------------------------------------------
const CalcEngine = {

  // --- Core formula primitives ---

  rpmFromSFM(sfm, diameter, unit) {
    if (!sfm || !diameter) return null;
    return unit === 'metric'
      ? (sfm * 1000) / (Math.PI * diameter)
      : (sfm * 3.82) / diameter;
  },

  sfmFromRPM(rpm, diameter, unit) {
    if (!rpm || !diameter) return null;
    return unit === 'metric'
      ? (rpm * Math.PI * diameter) / 1000
      : (rpm * Math.PI * diameter) / 12;
  },

  feedFromRPMChip(rpm, flutes, chipLoad) {
    if (!rpm || !flutes || !chipLoad) return null;
    return rpm * flutes * chipLoad;
  },

  chipFromFeedRPM(feedRate, rpm, flutes) {
    if (!feedRate || !rpm || !flutes) return null;
    return feedRate / (rpm * flutes);
  },

  // --- Solve all four values given locked fields ---
  //
  // params: { rpm, feedrate, chipload, sfm, diameter, flutes, unit, lockedFields, docFactor }
  // lockedFields: Set of field names that should not be changed
  // Returns object: { rpm, feedrate, chipload, sfm }
  //
  // Strategy:
  //  1. Use locked values as starting anchors.
  //  2. Derive unlocked fields in the natural dependency order:
  //     sfm <-> rpm <-> (chipload, feedrate)
  // -------------------------------------------------------------------
  solve(params) {
    const { diameter, flutes, unit, lockedFields, docFactor } = params;
    const factor = DOC_FACTORS[docFactor] ?? 1;
    let { rpm, feedrate, chipload, sfm } = params;

    if (!diameter || !flutes) {
      return { rpm, feedrate, chipload, sfm };
    }

    const locked = field => lockedFields.has(field);

    // ---- Step 1: Resolve RPM ↔ SFM ----
    if (!locked('rpm') && locked('sfm') && sfm > 0) {
      // Derive RPM from locked SFM
      rpm = this.rpmFromSFM(sfm, diameter, unit);
    } else if (!locked('sfm') && locked('rpm') && rpm > 0) {
      // Derive SFM from locked RPM
      sfm = this.sfmFromRPM(rpm, diameter, unit);
    } else if (!locked('rpm') && !locked('sfm')) {
      // Neither locked — derive SFM from whatever RPM we have
      if (rpm > 0) sfm = this.sfmFromRPM(rpm, diameter, unit);
    }

    // ---- Step 2: Resolve chipload ↔ feedrate ----
    if (!locked('feedrate') && locked('chipload') && chipload > 0 && rpm > 0) {
      // Derive feedrate from locked chipload (apply DOC factor)
      feedrate = this.feedFromRPMChip(rpm, flutes, chipload * factor);
    } else if (!locked('chipload') && locked('feedrate') && feedrate > 0 && rpm > 0) {
      // Derive chipload from locked feedrate (un-apply DOC factor)
      const rawChipload = this.chipFromFeedRPM(feedrate, rpm, flutes);
      chipload = rawChipload ? rawChipload / factor : null;
    } else if (!locked('feedrate') && !locked('chipload')) {
      // Neither locked — derive feedrate from chipload
      if (rpm > 0 && chipload > 0) {
        feedrate = this.feedFromRPMChip(rpm, flutes, chipload * factor);
      }
    }

    return {
      rpm:      rpm      ? Math.round(rpm * 10) / 10    : null,
      feedrate: feedrate ? Math.round(feedrate * 10) / 10 : null,
      chipload: chipload ? chipload                       : null,
      sfm:      sfm      ? Math.round(sfm * 10) / 10    : null,
    };
  },

  // Solve triggered by user editing a SPECIFIC field.
  // The edited field always "wins" and drives the others.
  solveFromEdit(editedField, params) {
    const { lockedFields } = params;
    // Treat the field being edited as if it's locked (it drives the calc)
    const effectiveLocked = new Set(lockedFields);
    effectiveLocked.add(editedField);
    return this.solve({ ...params, lockedFields: effectiveLocked });
  },
};

// -------------------------------------------------------------------
// Step-down / step-over recommendations
// -------------------------------------------------------------------
function calcStepRecommendations(diameter, materialKey, isMetric) {
  const recs = CNCData.stepRecommendations?.[materialKey];
  if (!recs || !diameter) return null;

  const sdMin = diameter * recs.stepDownMin;
  const sdMax = diameter * recs.stepDownMax;
  const soMin = diameter * recs.stepOverMin;
  const soMax = diameter * recs.stepOverMax;

  if (isMetric) {
    return {
      stepDownMin: UnitConverter.inchesToMM(sdMin),
      stepDownMax: UnitConverter.inchesToMM(sdMax),
      stepOverMin: UnitConverter.inchesToMM(soMin),
      stepOverMax: UnitConverter.inchesToMM(soMax),
    };
  }
  return { stepDownMin: sdMin, stepDownMax: sdMax, stepOverMin: soMin, stepOverMax: soMax };
}

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
    // Chip load
    chipLoad:        toMet ? UnitConverter.inPerToothToMM(chipIn)       : chipIn,
    chipLoadMin:     toMet ? UnitConverter.inPerToothToMM(chipIn * 0.7) : chipIn * 0.7,
    chipLoadMax:     toMet ? UnitConverter.inPerToothToMM(chipIn * 1.3) : chipIn * 1.3,
    // SFM/Vc range
    surfaceSpeedMin: toMet ? UnitConverter.sfmToMMin(sfmMin) : sfmMin,
    surfaceSpeedMax: toMet ? UnitConverter.sfmToMMin(sfmMax) : sfmMax,
    surfaceSpeed:    toMet ? UnitConverter.sfmToMMin(sfmMid) : sfmMid,
    // Suggested RPM from surface speed
    suggestedRPM,
    suggestedRPMMin,
    suggestedRPMMax,
  };
}
