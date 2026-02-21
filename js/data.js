// data.js — CNC reference tables and constants
// No dependencies. Loaded first. Exposes global CNCData.

const CNCData = {

  // -------------------------------------------------------------------
  // Materials list (grouped for <optgroup> rendering)
  // -------------------------------------------------------------------
  materials: [
    { group: 'Wood',    key: 'wood_softwood',   label: 'Softwood (Pine, Cedar)' },
    { group: 'Wood',    key: 'wood_hardwood',   label: 'Hardwood (Oak, Maple)' },
    { group: 'Wood',    key: 'wood_mdf',        label: 'MDF' },
    { group: 'Wood',    key: 'wood_plywood',    label: 'Plywood' },
    { group: 'Metal',   key: 'aluminum_6061',   label: 'Aluminum 6061' },
    { group: 'Metal',   key: 'aluminum_cast',   label: 'Aluminum (Cast)' },
    { group: 'Plastic', key: 'plastic_acrylic', label: 'Acrylic' },
    { group: 'Plastic', key: 'plastic_hdpe',    label: 'HDPE' },
    { group: 'Plastic', key: 'plastic_delrin',  label: 'Delrin (POM)' },
  ],

  // -------------------------------------------------------------------
  // Surface speeds — SFM (Surface Feet per Minute) ranges
  // [min, max] per tool material
  // -------------------------------------------------------------------
  surfaceSpeeds: {
    wood_softwood:   { hss: [500,  900],  carbide: [800,  1500], coated_carbide: [1000, 2000] },
    wood_hardwood:   { hss: [300,  700],  carbide: [600,  1200], coated_carbide: [800,  1500] },
    wood_mdf:        { hss: [400,  800],  carbide: [700,  1300], coated_carbide: [900,  1600] },
    wood_plywood:    { hss: [400,  800],  carbide: [700,  1300], coated_carbide: [900,  1600] },
    aluminum_6061:   { hss: [200,  400],  carbide: [500,  1000], coated_carbide: [800,  1500] },
    aluminum_cast:   { hss: [150,  300],  carbide: [400,  800],  coated_carbide: [600,  1200] },
    plastic_acrylic: { hss: [400,  700],  carbide: [700,  1200], coated_carbide: [900,  1500] },
    plastic_hdpe:    { hss: [300,  600],  carbide: [600,  1100], coated_carbide: [800,  1400] },
    plastic_delrin:  { hss: [350,  650],  carbide: [650,  1100], coated_carbide: [850,  1400] },
  },

  // -------------------------------------------------------------------
  // Chip loads — inches per tooth
  // Keyed by diameter range then tool material
  // Ranges: lt_0125 = <1/8", lt_0250 = 1/8–1/4", lt_0500 = 1/4–1/2",
  //         lt_0750 = 1/2–3/4", gte_0750 = >=3/4"
  // -------------------------------------------------------------------
  chipLoads: {
    wood_softwood: {
      lt_0125:  { hss: 0.001,  carbide: 0.002,  coated_carbide: 0.0025 },
      lt_0250:  { hss: 0.002,  carbide: 0.004,  coated_carbide: 0.005  },
      lt_0500:  { hss: 0.004,  carbide: 0.006,  coated_carbide: 0.008  },
      lt_0750:  { hss: 0.006,  carbide: 0.010,  coated_carbide: 0.012  },
      gte_0750: { hss: 0.008,  carbide: 0.014,  coated_carbide: 0.016  },
    },
    wood_hardwood: {
      lt_0125:  { hss: 0.0008, carbide: 0.0015, coated_carbide: 0.002  },
      lt_0250:  { hss: 0.0015, carbide: 0.003,  coated_carbide: 0.004  },
      lt_0500:  { hss: 0.003,  carbide: 0.005,  coated_carbide: 0.006  },
      lt_0750:  { hss: 0.005,  carbide: 0.008,  coated_carbide: 0.010  },
      gte_0750: { hss: 0.006,  carbide: 0.012,  coated_carbide: 0.014  },
    },
    wood_mdf: {
      lt_0125:  { hss: 0.001,  carbide: 0.002,  coated_carbide: 0.0025 },
      lt_0250:  { hss: 0.002,  carbide: 0.004,  coated_carbide: 0.005  },
      lt_0500:  { hss: 0.004,  carbide: 0.007,  coated_carbide: 0.008  },
      lt_0750:  { hss: 0.006,  carbide: 0.010,  coated_carbide: 0.012  },
      gte_0750: { hss: 0.008,  carbide: 0.013,  coated_carbide: 0.015  },
    },
    wood_plywood: {
      lt_0125:  { hss: 0.001,  carbide: 0.002,  coated_carbide: 0.0025 },
      lt_0250:  { hss: 0.002,  carbide: 0.004,  coated_carbide: 0.005  },
      lt_0500:  { hss: 0.004,  carbide: 0.006,  coated_carbide: 0.007  },
      lt_0750:  { hss: 0.006,  carbide: 0.009,  coated_carbide: 0.011  },
      gte_0750: { hss: 0.007,  carbide: 0.012,  coated_carbide: 0.014  },
    },
    aluminum_6061: {
      lt_0125:  { hss: 0.0004, carbide: 0.0008, coated_carbide: 0.001  },
      lt_0250:  { hss: 0.0008, carbide: 0.0015, coated_carbide: 0.002  },
      lt_0500:  { hss: 0.0015, carbide: 0.003,  coated_carbide: 0.004  },
      lt_0750:  { hss: 0.002,  carbide: 0.004,  coated_carbide: 0.005  },
      gte_0750: { hss: 0.003,  carbide: 0.006,  coated_carbide: 0.007  },
    },
    aluminum_cast: {
      lt_0125:  { hss: 0.0003, carbide: 0.0007, coated_carbide: 0.0009 },
      lt_0250:  { hss: 0.0007, carbide: 0.0012, coated_carbide: 0.0015 },
      lt_0500:  { hss: 0.001,  carbide: 0.002,  coated_carbide: 0.0025 },
      lt_0750:  { hss: 0.0015, carbide: 0.003,  coated_carbide: 0.004  },
      gte_0750: { hss: 0.002,  carbide: 0.005,  coated_carbide: 0.006  },
    },
    plastic_acrylic: {
      lt_0125:  { hss: 0.001,  carbide: 0.002,  coated_carbide: 0.0025 },
      lt_0250:  { hss: 0.002,  carbide: 0.003,  coated_carbide: 0.004  },
      lt_0500:  { hss: 0.003,  carbide: 0.005,  coated_carbide: 0.006  },
      lt_0750:  { hss: 0.004,  carbide: 0.007,  coated_carbide: 0.009  },
      gte_0750: { hss: 0.006,  carbide: 0.010,  coated_carbide: 0.012  },
    },
    plastic_hdpe: {
      lt_0125:  { hss: 0.0015, carbide: 0.0025, coated_carbide: 0.003  },
      lt_0250:  { hss: 0.003,  carbide: 0.005,  coated_carbide: 0.006  },
      lt_0500:  { hss: 0.005,  carbide: 0.008,  coated_carbide: 0.010  },
      lt_0750:  { hss: 0.007,  carbide: 0.012,  coated_carbide: 0.014  },
      gte_0750: { hss: 0.010,  carbide: 0.016,  coated_carbide: 0.018  },
    },
    plastic_delrin: {
      lt_0125:  { hss: 0.001,  carbide: 0.002,  coated_carbide: 0.0025 },
      lt_0250:  { hss: 0.002,  carbide: 0.004,  coated_carbide: 0.005  },
      lt_0500:  { hss: 0.004,  carbide: 0.007,  coated_carbide: 0.008  },
      lt_0750:  { hss: 0.006,  carbide: 0.010,  coated_carbide: 0.012  },
      gte_0750: { hss: 0.008,  carbide: 0.014,  coated_carbide: 0.016  },
    },
  },

  // -------------------------------------------------------------------
  // Step-down / step-over recommendations
  // Expressed as fractions of tool diameter
  // stepDownMin/Max: depth of cut per pass
  // stepOverMin/Max: width of cut (radial engagement)
  // -------------------------------------------------------------------
  stepRecommendations: {
    wood_softwood:   { stepDownMin: 0.5,  stepDownMax: 1.0,  stepOverMin: 0.4,  stepOverMax: 0.5  },
    wood_hardwood:   { stepDownMin: 0.3,  stepDownMax: 0.5,  stepOverMin: 0.3,  stepOverMax: 0.45 },
    wood_mdf:        { stepDownMin: 0.4,  stepDownMax: 0.8,  stepOverMin: 0.4,  stepOverMax: 0.5  },
    wood_plywood:    { stepDownMin: 0.4,  stepDownMax: 0.8,  stepOverMin: 0.4,  stepOverMax: 0.5  },
    aluminum_6061:   { stepDownMin: 0.05, stepDownMax: 0.1,  stepOverMin: 0.25, stepOverMax: 0.33 },
    aluminum_cast:   { stepDownMin: 0.05, stepDownMax: 0.15, stepOverMin: 0.25, stepOverMax: 0.33 },
    plastic_acrylic: { stepDownMin: 0.3,  stepDownMax: 0.5,  stepOverMin: 0.35, stepOverMax: 0.5  },
    plastic_hdpe:    { stepDownMin: 0.5,  stepDownMax: 1.0,  stepOverMin: 0.4,  stepOverMax: 0.5  },
    plastic_delrin:  { stepDownMin: 0.4,  stepDownMax: 0.8,  stepOverMin: 0.4,  stepOverMax: 0.5  },
  },

  // -------------------------------------------------------------------
  // Helper: map diameter (inches) to chip load table key
  // -------------------------------------------------------------------
  getDiameterRangeKey(diameterInches) {
    if (diameterInches < 0.125) return 'lt_0125';
    if (diameterInches < 0.250) return 'lt_0250';
    if (diameterInches < 0.500) return 'lt_0500';
    if (diameterInches < 0.750) return 'lt_0750';
    return 'gte_0750';
  },

  // -------------------------------------------------------------------
  // V-bit angle options
  // -------------------------------------------------------------------
  vBitAngles: [15, 20, 30, 45, 60, 90, 120],

  // -------------------------------------------------------------------
  // Tool type display labels
  // -------------------------------------------------------------------
  toolTypeLabels: {
    end_mill:   'End Mill',
    v_bit:      'V-Bit',
    drill:      'Drill',
    router_bit: 'Router Bit',
  },

  toolSubtypeLabels: {
    flat:        'Flat',
    ball:        'Ball Nose',
    bull_nose:   'Bull Nose',
    upcut:       'Upcut Spiral',
    downcut:     'Downcut Spiral',
    compression: 'Compression',
  },

  toolMaterialLabels: {
    hss:           'HSS',
    carbide:       'Carbide',
    coated_carbide:'Coated Carbide',
  },

  coatingLabels: {
    uncoated: 'Uncoated',
    tin:      'TiN',
    ticn:     'TiCN',
    altin:    'AlTiN',
    dlc:      'DLC',
    zrn:      'ZrN',
  },
};
