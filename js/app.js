// app.js — Application state, event wiring, and initialization
// Depends on: data.js, toolLibrary.js, calculator.js, ui.js

// -------------------------------------------------------------------
// Application State (single source of truth)
// -------------------------------------------------------------------
const AppState = {
  unit: 'imperial',
  activeTab: 'calculator',

  calc: {
    // Tool / material context
    toolSource:     'custom',
    selectedToolId: null,
    materialKey:    'wood_softwood',
    diameter:       0.25,      // always in current unit
    flutes:         2,
    toolMaterial:   'carbide',

    // The four interlinked parameter values (always in current unit)
    rpm:      18000,
    feedRate: null,   // in/min or mm/min
    chipLoad: 0.003,  // in/tooth or mm/tooth
    sfm:      null,   // SFM or m/min — will be computed on init

    // Depth of cut multiplier: 1 | 2 | 3
    docMultiplier: 1,

    // Which fields are locked (frozen from auto-recalc)
    lockedFields: new Set(['rpm']),  // RPM locked by default at 18,000
  },

  library: {
    filterType:     '',
    filterMaterial: '',
    searchQuery:    '',
    editingId:      null,
  },
};

// -------------------------------------------------------------------
// Build the params object for CalcEngine from AppState
// -------------------------------------------------------------------
function buildCalcParams() {
  const { calc, unit } = AppState;
  return {
    rpm:          calc.rpm,
    feedrate:     calc.feedRate,
    chipload:     calc.chipLoad,
    sfm:          calc.sfm,
    diameter:     calc.diameter,
    flutes:       calc.flutes,
    unit,
    lockedFields: calc.lockedFields,
    docFactor:    calc.docMultiplier,
  };
}

// -------------------------------------------------------------------
// Recalculate — run the engine and push results back into state
// -------------------------------------------------------------------
function recalculate(editedField) {
  const params = buildCalcParams();
  let result;

  if (editedField) {
    result = CalcEngine.solveFromEdit(editedField, params);
  } else {
    result = CalcEngine.solve(params);
  }

  // Write results back into state (only update non-null results to avoid
  // clobbering when engine can't solve a field)
  if (result.rpm      != null) AppState.calc.rpm      = result.rpm;
  if (result.feedrate != null) AppState.calc.feedRate  = result.feedrate;
  if (result.chipload != null) AppState.calc.chipLoad  = result.chipload;
  if (result.sfm      != null) AppState.calc.sfm       = result.sfm;
}

// -------------------------------------------------------------------
// Render all four calc field inputs from state
// (skip any field that is currently focused so we don't interrupt typing)
// -------------------------------------------------------------------
function renderCalcFields() {
  const { calc, unit } = AppState;
  const isMetric = unit === 'metric';

  // Helpers
  const setVal = (id, val, dec) => {
    const el = document.getElementById(id);
    if (!el || document.activeElement === el) return;
    el.value = (val != null && !isNaN(val)) ? val.toFixed(dec) : '';
  };

  setVal('input-rpm',      calc.rpm,      0);
  setVal('input-feedrate', calc.feedRate, isMetric ? 1 : 2);
  setVal('input-chipload', calc.chipLoad, isMetric ? 4 : 5);
  setVal('input-sfm',      calc.sfm,      1);
}

// -------------------------------------------------------------------
// Render unit labels on all four calc fields
// -------------------------------------------------------------------
function renderCalcLabels() {
  const isMetric = AppState.unit === 'metric';
  const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };

  setText('lbl-diameter',      isMetric ? 'mm'      : 'in');
  setText('lbl-chipload-unit', isMetric ? 'mm/tooth' : 'in/tooth');
  setText('lbl-feedrate-unit', isMetric ? 'mm/min'  : 'in/min');
  setText('lbl-sfm-unit',      isMetric ? 'm/min'   : 'SFM');

  // Formula hints update with unit
  const fRpm = document.getElementById('formula-rpm');
  if (fRpm) fRpm.textContent = isMetric
    ? 'RPM = (Vc × 1000) / (π × diameter)'
    : 'RPM = (SFM × 3.82) / diameter';

  const fSfm = document.getElementById('formula-sfm');
  if (fSfm) fSfm.textContent = isMetric
    ? 'Vc (m/min) = (RPM × π × dia) / 1000'
    : 'SFM = (RPM × π × dia) / 12';

  // Modal unit label
  setText('modal-unit-label', isMetric ? 'mm' : 'in');
}

// -------------------------------------------------------------------
// Apply lock state visuals to each field wrapper + button
// -------------------------------------------------------------------
function renderLockState() {
  const locked = AppState.calc.lockedFields;
  const fields = ['rpm', 'feedrate', 'chipload', 'sfm'];

  // Closed-lock SVG path (locked)
  const closedLock = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`;
  // Open-lock SVG path (unlocked)
  const openLock   = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/><path d="M12 7v4" stroke-dasharray="3 3"/>`;

  fields.forEach(field => {
    const wrapper = document.getElementById(`field-${field}`);
    const btn     = document.getElementById(`lock-${field}`);
    const icon    = document.getElementById(`lock-icon-${field}`);
    const isLocked = locked.has(field);

    if (wrapper) wrapper.classList.toggle('is-locked', isLocked);
    if (btn)     btn.classList.toggle('locked', isLocked);
    if (btn)     btn.setAttribute('aria-label', isLocked ? `Unlock ${field}` : `Lock ${field}`);
    if (icon)    icon.innerHTML = isLocked ? closedLock : openLock;
  });
}

// -------------------------------------------------------------------
// Render step-down / step-over in the results panel
// -------------------------------------------------------------------
function renderStepOutputs() {
  const { calc, unit } = AppState;
  const isMetric = unit === 'metric';
  const dec      = isMetric ? 2 : 4;
  const stepUnit = isMetric ? 'mm' : 'in';

  // Diameter in inches for step lookup
  const diamIn = UnitConverter.toInches(calc.diameter, unit);
  const steps  = calcStepRecommendations(diamIn, calc.materialKey, isMetric);

  const sdEl  = document.getElementById('output-stepdown');
  const soEl  = document.getElementById('output-stepover');
  const suEl  = document.getElementById('lbl-step-unit');
  const souEl = document.getElementById('lbl-stepover-unit');

  if (steps) {
    sdEl.textContent = `${steps.stepDownMin.toFixed(dec)}–${steps.stepDownMax.toFixed(dec)}`;
    soEl.textContent = `${steps.stepOverMin.toFixed(dec)}–${steps.stepOverMax.toFixed(dec)}`;
    if (suEl)  suEl.textContent  = stepUnit;
    if (souEl) souEl.textContent = stepUnit;
  } else {
    sdEl.textContent = '--';
    soEl.textContent = '--';
  }
}

// -------------------------------------------------------------------
// Render preset hint card
// -------------------------------------------------------------------
function updatePresetHints() {
  const { calc, unit } = AppState;
  const isMetric = unit === 'metric';
  const diamIn   = UnitConverter.toInches(calc.diameter, unit);
  const presets  = getPresets(calc.materialKey, calc.toolMaterial, diamIn, unit);

  const hintChipRng = document.getElementById('hint-chipload-range');
  const hintSfmRng  = document.getElementById('hint-sfm-range');
  const hintCalcRpm = document.getElementById('hint-calc-rpm');

  if (presets) {
    const chipDec = isMetric ? 3 : 5;
    const chipU   = isMetric ? 'mm/t' : 'in/t';
    const sfmU    = isMetric ? 'm/min' : 'SFM';

    if (hintChipRng) hintChipRng.textContent =
      `${presets.chipLoadMin.toFixed(chipDec)}–${presets.chipLoadMax.toFixed(chipDec)} ${chipU}`;

    if (hintSfmRng) hintSfmRng.textContent =
      `${Math.round(presets.surfaceSpeedMin)}–${Math.round(presets.surfaceSpeedMax)} ${sfmU}`;

    if (hintCalcRpm && presets.suggestedRPMMin != null) {
      hintCalcRpm.textContent =
        `${presets.suggestedRPMMin.toLocaleString()}–${presets.suggestedRPMMax.toLocaleString()} RPM`;
    } else if (hintCalcRpm) {
      hintCalcRpm.textContent = '--';
    }
  } else {
    if (hintChipRng) hintChipRng.textContent = '--';
    if (hintSfmRng)  hintSfmRng.textContent  = '--';
    if (hintCalcRpm) hintCalcRpm.textContent  = '--';
  }
}

// -------------------------------------------------------------------
// Full render pass (fields + labels + lock state + step outputs + hints)
// -------------------------------------------------------------------
function renderAll() {
  renderCalcFields();
  renderCalcLabels();
  renderLockState();
  renderStepOutputs();
  updatePresetHints();
}

// -------------------------------------------------------------------
// Sync setup inputs from state (diameter, flutes, material selects, etc.)
// -------------------------------------------------------------------
function syncSetupInputs() {
  const { calc, unit } = AppState;
  const isMetric = unit === 'metric';

  const setVal = (id, val, dec) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = (typeof val === 'number' && !isNaN(val))
      ? (dec > 0 ? val.toFixed(dec) : String(Math.round(val)))
      : '';
  };

  setVal('input-diameter', calc.diameter, isMetric ? 2 : 4);
  setVal('input-flutes',   calc.flutes,   0);

  const matSel = document.getElementById('material-select');
  if (matSel) matSel.value = calc.materialKey;

  const tmSel = document.getElementById('tool-material-select');
  if (tmSel) tmSel.value = calc.toolMaterial;
}

// -------------------------------------------------------------------
// Render the library tab as a table
// -------------------------------------------------------------------
function renderLibraryTab() {
  const { filterType, filterMaterial, searchQuery } = AppState.library;
  const allTools  = ToolLibrary.getAll();
  const filtered  = ToolLibrary.filter({ type: filterType, material: filterMaterial, searchQuery });
  const tbody     = document.getElementById('tool-tbody');
  const noResults = document.getElementById('no-results-state');

  // Update tool count badge
  const badge = document.getElementById('tool-count-badge');
  if (badge) badge.textContent = allTools.length;

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    noResults.hidden = allTools.length === 0;
    return;
  }

  noResults.hidden = true;
  filtered.forEach(tool => tbody.appendChild(renderToolRow(tool, AppState.unit)));
}

// -------------------------------------------------------------------
// Handle inline add-tool row submission
// -------------------------------------------------------------------
function handleInlineAddTool() {
  const name     = document.getElementById('new-name').value.trim();
  const type     = document.getElementById('new-type').value;
  const diamRaw  = parseFloat(document.getElementById('new-diameter').value);
  const flutes   = parseInt(document.getElementById('new-flutes').value, 10);
  const material = document.getElementById('new-material').value;
  const notes    = document.getElementById('new-notes').value.trim();

  if (!name)               { showToast('Tool name is required', 'error');       document.getElementById('new-name').focus();     return; }
  if (!diamRaw || diamRaw <= 0) { showToast('Enter a valid diameter', 'error'); document.getElementById('new-diameter').focus(); return; }
  if (!flutes || flutes < 1)    { showToast('Enter a valid flute count', 'error'); document.getElementById('new-flutes').focus(); return; }

  const diamIn = AppState.unit === 'metric' ? UnitConverter.mmToInches(diamRaw) : diamRaw;
  const defaultSubtype = { router_bit: 'upcut', end_mill: 'flat', v_bit: null, drill: null };

  ToolLibrary.add({
    name, type,
    subtype:      defaultSubtype[type] ?? null,
    vBitAngle:    null,
    diameter:     diamIn,
    diameterUnit: 'in',
    flutes,
    material,
    coating:      'uncoated',
    maxRPM:       null,
    notes,
  });

  ['new-name','new-diameter','new-flutes','new-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });

  refreshToolSelect();
  renderLibraryTab();
  showToast(`Added: ${name}`, 'success');
}

// -------------------------------------------------------------------
// Populate the tool select dropdown in the calculator
// -------------------------------------------------------------------
function refreshToolSelect() {
  const sel = document.getElementById('tool-select');
  if (!sel) return;
  renderToolSelectOptions(sel, ToolLibrary.getAll(), AppState.calc.selectedToolId);
}

// -------------------------------------------------------------------
// Handle: load a tool from library into the calculator
// -------------------------------------------------------------------
function handleLoadTool(toolId) {
  const tool = ToolLibrary.getById(toolId);
  if (!tool) return;

  AppState.calc.toolSource     = 'library';
  AppState.calc.selectedToolId = toolId;
  AppState.calc.flutes         = tool.flutes;
  AppState.calc.toolMaterial   = tool.material;

  // Convert stored diameter (always inches) to current unit
  const diamIn = tool.diameter;
  AppState.calc.diameter = AppState.unit === 'metric'
    ? UnitConverter.inchesToMM(diamIn) : diamIn;

  // Apply chip load preset (RPM stays at user's value)
  const presets = getPresets(AppState.calc.materialKey, tool.material, diamIn, AppState.unit);
  if (presets) AppState.calc.chipLoad = presets.chipLoad;

  recalculate('chipload');
  syncSetupInputs();
  renderAll();

  AppState.activeTab = 'calculator';
  switchTab('calculator');
  showToast(`Loaded: ${tool.name}`, 'success');
}

// -------------------------------------------------------------------
// Unit toggle handler
// -------------------------------------------------------------------
function handleUnitToggle(newUnit) {
  const oldUnit = AppState.unit;
  if (oldUnit === newUnit) return;

  UnitConverter.convertCalcState(AppState.calc, oldUnit, newUnit);
  AppState.unit = newUnit;

  syncSetupInputs();
  renderAll();
  savePreferences();

  document.querySelectorAll('.unit-toggle__btn').forEach(btn => {
    const isActive = btn.dataset.unit === newUnit;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  if (AppState.activeTab === 'library') renderLibraryTab();
}

// -------------------------------------------------------------------
// Modal: open for Add
// -------------------------------------------------------------------
function openAddModal() {
  AppState.library.editingId = null;
  const modal = document.getElementById('tool-modal');
  document.getElementById('modal-title').textContent = 'Add Tool';
  document.getElementById('tool-form').reset();

  const typeEl = document.getElementById('field-type');
  typeEl.value = 'end_mill';
  renderModalSubtypeField(
    document.getElementById('field-subtype-container'), 'end_mill', 'flat', 45
  );

  document.querySelectorAll('.form-input.error, .form-select.error')
    .forEach(el => el.classList.remove('error'));
  document.querySelectorAll('.form-error')
    .forEach(el => { el.hidden = true; });

  document.getElementById('modal-unit-label').textContent =
    AppState.unit === 'metric' ? 'mm' : 'in';

  modal.showModal();
}

// -------------------------------------------------------------------
// Modal: open for Edit
// -------------------------------------------------------------------
function openEditModal(toolId) {
  const tool = ToolLibrary.getById(toolId);
  if (!tool) return;

  AppState.library.editingId = toolId;
  const modal = document.getElementById('tool-modal');
  document.getElementById('modal-title').textContent = 'Edit Tool';

  document.getElementById('field-name').value     = tool.name     ?? '';
  document.getElementById('field-type').value     = tool.type     ?? 'end_mill';
  document.getElementById('field-material').value = tool.material ?? 'carbide';
  document.getElementById('field-coating').value  = tool.coating  ?? 'uncoated';
  document.getElementById('field-maxrpm').value   = tool.maxRPM   ?? '';
  document.getElementById('field-notes').value    = tool.notes    ?? '';
  document.getElementById('field-flutes').value   = tool.flutes   ?? '';

  const diam = AppState.unit === 'metric'
    ? UnitConverter.inchesToMM(tool.diameter) : tool.diameter;
  document.getElementById('field-diameter').value = diam.toFixed(AppState.unit === 'metric' ? 2 : 4);

  document.getElementById('modal-unit-label').textContent =
    AppState.unit === 'metric' ? 'mm' : 'in';

  renderModalSubtypeField(
    document.getElementById('field-subtype-container'),
    tool.type, tool.subtype, tool.vBitAngle
  );

  document.querySelectorAll('.form-input.error, .form-select.error')
    .forEach(el => el.classList.remove('error'));
  document.querySelectorAll('.form-error')
    .forEach(el => { el.hidden = true; });

  modal.showModal();
}

function closeModal() {
  document.getElementById('tool-modal').close();
  AppState.library.editingId = null;
}

// -------------------------------------------------------------------
// Modal: save (add or update)
// -------------------------------------------------------------------
function handleModalSave() {
  if (!validateModalForm()) return;

  const form   = document.getElementById('tool-form');
  const type   = document.getElementById('field-type').value;
  let subtype  = null;
  let vBitAngle = null;

  if (type === 'end_mill') {
    const st = form.querySelector('[name="subtype"]');
    subtype = st ? st.value : 'flat';
  } else if (type === 'router_bit') {
    const st = form.querySelector('[name="subtype"]');
    subtype = st ? st.value : 'upcut';
  } else if (type === 'v_bit') {
    const va = form.querySelector('[name="vBitAngle"]');
    vBitAngle = va ? Number(va.value) : 45;
  }

  const rawDiam = parseFloat(document.getElementById('field-diameter').value);
  const diamIn  = AppState.unit === 'metric' ? UnitConverter.mmToInches(rawDiam) : rawDiam;

  const toolData = {
    name:         document.getElementById('field-name').value.trim(),
    type, subtype, vBitAngle,
    diameter:     diamIn,
    diameterUnit: 'in',
    flutes:       parseInt(document.getElementById('field-flutes').value, 10),
    material:     document.getElementById('field-material').value,
    coating:      document.getElementById('field-coating').value,
    maxRPM:       parseInt(document.getElementById('field-maxrpm').value, 10) || null,
    notes:        document.getElementById('field-notes').value.trim(),
  };

  if (AppState.library.editingId) {
    ToolLibrary.update(AppState.library.editingId, toolData);
    showToast('Tool updated', 'success');
  } else {
    ToolLibrary.add(toolData);
    showToast('Tool added', 'success');
  }

  closeModal();
  refreshToolSelect();
  renderLibraryTab();
}

// -------------------------------------------------------------------
// Export / Import handlers
// -------------------------------------------------------------------
function handleExport() {
  const json = ToolLibrary.exportJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `cnc-tool-library-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleImport(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const count = ToolLibrary.importJSON(e.target.result);
      showToast(`Imported ${count} tool${count !== 1 ? 's' : ''} successfully`, 'success');
      refreshToolSelect();
      renderLibraryTab();
    } catch {
      showToast('Import failed — invalid or unsupported JSON format', 'error');
    }
  };
  reader.readAsText(file);
}

// -------------------------------------------------------------------
// Persist + load preferences
// -------------------------------------------------------------------
function savePreferences() {
  Preferences.save({
    unit: AppState.unit,
    lastCalc: {
      materialKey:   AppState.calc.materialKey,
      diameter:      AppState.calc.diameter,
      flutes:        AppState.calc.flutes,
      toolMaterial:  AppState.calc.toolMaterial,
      rpm:           AppState.calc.rpm,
      chipLoad:      AppState.calc.chipLoad,
      feedRate:      AppState.calc.feedRate,
      sfm:           AppState.calc.sfm,
      docMultiplier: AppState.calc.docMultiplier,
    },
  });
}

function loadPreferences() {
  const prefs = Preferences.load();
  if (prefs.unit === 'imperial' || prefs.unit === 'metric') {
    AppState.unit = prefs.unit;
  }
  if (prefs.lastCalc) {
    const c = prefs.lastCalc;
    if (c.materialKey)   AppState.calc.materialKey   = c.materialKey;
    if (c.diameter)      AppState.calc.diameter       = c.diameter;
    if (c.flutes)        AppState.calc.flutes         = c.flutes;
    if (c.toolMaterial)  AppState.calc.toolMaterial   = c.toolMaterial;
    if (c.rpm)           AppState.calc.rpm            = c.rpm;
    if (c.chipLoad)      AppState.calc.chipLoad       = c.chipLoad;
    if (c.feedRate)      AppState.calc.feedRate       = c.feedRate;
    if (c.sfm)           AppState.calc.sfm            = c.sfm;
    if (c.docMultiplier) AppState.calc.docMultiplier  = c.docMultiplier;
  }
}

// -------------------------------------------------------------------
// Initialization
// -------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {

  // 1. Seed + migrate + load preferences
  ToolLibrary.seedIfEmpty();
  ToolLibrary.migrateSpektraCoating();
  loadPreferences();

  // 2. Render material select
  renderMaterialSelect(document.getElementById('material-select'), AppState.calc.materialKey);

  // 3. Populate tool select
  refreshToolSelect();

  // 4. Sync setup inputs (diameter, flutes, material)
  syncSetupInputs();

  // 5. Set active unit toggle button
  document.querySelectorAll('.unit-toggle__btn').forEach(btn => {
    const isActive = btn.dataset.unit === AppState.unit;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  // 6. Set active DOC pill
  document.querySelectorAll('.doc-pill').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.doc) === AppState.calc.docMultiplier);
  });

  // 7. Initial solve + render
  recalculate();
  renderAll();

  // 8. Initial library render
  renderLibraryTab();

  // ================================================================
  // Event listeners
  // ================================================================

  // --- Unit toggle ---
  document.querySelectorAll('.unit-toggle__btn').forEach(btn => {
    btn.addEventListener('click', () => handleUnitToggle(btn.dataset.unit));
  });

  // --- Tab switching ---
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.activeTab = btn.dataset.tab;
      switchTab(btn.dataset.tab);
      if (btn.dataset.tab === 'library') renderLibraryTab();
    });
  });

  // --- Tool source toggle ---
  document.querySelectorAll('.source-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.source-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');

      AppState.calc.toolSource = btn.dataset.source;
      const picker = document.getElementById('library-picker');
      picker.hidden = btn.dataset.source !== 'library';

      if (btn.dataset.source === 'custom') {
        AppState.calc.selectedToolId = null;
        document.getElementById('tool-select').value = '';
      }
    });
  });

  // --- Tool select (from library) ---
  document.getElementById('tool-select').addEventListener('change', e => {
    const id = e.target.value;
    if (id) handleLoadTool(id);
  });

  // --- Setup inputs: diameter, flutes, material ---
  ['input-diameter', 'input-flutes', 'material-select', 'tool-material-select'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const val = el.type === 'number' ? parseFloat(el.value) : el.value;
      if      (id === 'input-diameter')       AppState.calc.diameter     = val || 0;
      else if (id === 'input-flutes')         AppState.calc.flutes       = val || 0;
      else if (id === 'material-select')      AppState.calc.materialKey  = val;
      else if (id === 'tool-material-select') AppState.calc.toolMaterial = val;

      // Changing diameter/flutes forces a re-solve of unlocked fields
      recalculate();
      renderAll();
      savePreferences();
    });
  });

  // --- The four bidirectional calc value inputs ---
  const calcFieldMap = {
    'input-rpm':      'rpm',
    'input-feedrate': 'feedrate',
    'input-chipload': 'chipload',
    'input-sfm':      'sfm',
  };

  Object.entries(calcFieldMap).forEach(([elId, fieldName]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    el.addEventListener('input', () => {
      const val = parseFloat(el.value);
      if (isNaN(val) || val <= 0) return;

      // Update state for the edited field
      if      (fieldName === 'rpm')      AppState.calc.rpm      = val;
      else if (fieldName === 'feedrate') AppState.calc.feedRate = val;
      else if (fieldName === 'chipload') AppState.calc.chipLoad = val;
      else if (fieldName === 'sfm')      AppState.calc.sfm      = val;

      // Solve from this edit
      recalculate(fieldName);

      // Push solved results to all other inputs
      renderCalcFields();
      renderStepOutputs();
      updatePresetHints();
      savePreferences();
    });
  });

  // --- Lock toggle buttons ---
  document.querySelectorAll('.lock-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.field;
      const locked = AppState.calc.lockedFields;
      if (locked.has(field)) {
        locked.delete(field);
      } else {
        locked.add(field);
      }
      renderLockState();
      // Re-solve with new lock set
      recalculate();
      renderCalcFields();
    });
  });

  // --- Depth of Cut pills ---
  document.querySelectorAll('.doc-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const multiplier = Number(btn.dataset.doc);
      AppState.calc.docMultiplier = multiplier;

      document.querySelectorAll('.doc-pill').forEach(b =>
        b.classList.toggle('active', Number(b.dataset.doc) === multiplier)
      );

      // Re-solve with new DOC factor
      recalculate();
      renderCalcFields();
      renderStepOutputs();
      savePreferences();
    });
  });

  // --- Apply Presets button ---
  document.getElementById('btn-apply-presets').addEventListener('click', () => {
    const diamIn  = UnitConverter.toInches(AppState.calc.diameter, AppState.unit);
    const presets = getPresets(AppState.calc.materialKey, AppState.calc.toolMaterial, diamIn, AppState.unit);
    if (presets) {
      AppState.calc.chipLoad = presets.chipLoad;
      // If RPM is not locked, apply suggested RPM too
      if (!AppState.calc.lockedFields.has('rpm') && presets.suggestedRPM) {
        AppState.calc.rpm = presets.suggestedRPM;
      }
      recalculate('chipload');
      syncSetupInputs();
      renderAll();
      savePreferences();
      showToast('Presets applied', 'success');
    } else {
      showToast('No preset data for this combination', 'warning');
    }
  });

  // --- Library: filter inputs ---
  document.getElementById('filter-search').addEventListener('input', e => {
    AppState.library.searchQuery = e.target.value;
    renderLibraryTab();
  });
  document.getElementById('filter-type').addEventListener('change', e => {
    AppState.library.filterType = e.target.value;
    renderLibraryTab();
  });
  document.getElementById('filter-material').addEventListener('change', e => {
    AppState.library.filterMaterial = e.target.value;
    renderLibraryTab();
  });

  // --- Library: inline Add tool row ---
  document.getElementById('btn-add-tool-inline').addEventListener('click', handleInlineAddTool);
  document.getElementById('add-tool-row').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleInlineAddTool();
  });

  // --- Library: tool row actions (delegated) ---
  document.getElementById('tool-tbody').addEventListener('click', e => {
    const useBtn    = e.target.closest('.btn-use-tool');
    const editBtn   = e.target.closest('.btn-edit-tool');
    const deleteBtn = e.target.closest('.btn-delete-tool');

    if (useBtn) {
      handleLoadTool(useBtn.dataset.id);
    } else if (editBtn) {
      openEditModal(editBtn.dataset.id);
    } else if (deleteBtn) {
      const tool = ToolLibrary.getById(deleteBtn.dataset.id);
      if (tool && window.confirm(`Delete "${tool.name}"?\n\nThis cannot be undone.`)) {
        ToolLibrary.delete(deleteBtn.dataset.id);
        refreshToolSelect();
        renderLibraryTab();
        showToast('Tool deleted', 'success');
      }
    }
  });

  // --- Export / Import ---
  document.getElementById('btn-export').addEventListener('click', handleExport);
  document.getElementById('btn-import-trigger').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', e => {
    if (e.target.files[0]) handleImport(e.target.files[0]);
    e.target.value = '';
  });

  // --- Modal: type field changes subtype ---
  document.getElementById('field-type').addEventListener('change', e => {
    renderModalSubtypeField(
      document.getElementById('field-subtype-container'), e.target.value, null, 45
    );
  });

  // --- Modal controls ---
  document.getElementById('modal-save').addEventListener('click', handleModalSave);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  document.getElementById('tool-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('tool-modal').addEventListener('cancel', () => {
    AppState.library.editingId = null;
  });

  // --- Blur validation on modal inputs ---
  ['field-diameter', 'field-flutes'].forEach(id => {
    document.getElementById(id)?.addEventListener('blur', () => {
      validateNumber(document.getElementById(id), `err-${id.replace('field-', '')}`);
    });
  });
  document.getElementById('field-name')?.addEventListener('blur', () => {
    validateRequired(document.getElementById('field-name'), 'err-name');
  });

});
