// app.js — Application state, event wiring, and initialization
// Depends on: data.js, toolLibrary.js, calculator.js, ui.js

// -------------------------------------------------------------------
// Application State (single source of truth)
// -------------------------------------------------------------------
const AppState = {
  unit: 'imperial',
  activeTab: 'calculator',

  calc: {
    toolSource:     'custom',  // 'custom' | 'library'
    selectedToolId: null,
    materialKey:    'wood_softwood',
    diameter:       0.25,
    flutes:         2,
    toolMaterial:   'carbide',
    surfaceSpeed:   600,
    chipLoad:       0.003,
    results:        null,
  },

  library: {
    filterType:     '',
    filterMaterial: '',
    searchQuery:    '',
    editingId:      null,  // null = adding new, string = editing existing
  },
};

// -------------------------------------------------------------------
// Recalculate outputs from current state
// -------------------------------------------------------------------
function recalculate() {
  const { calc, unit } = AppState;
  calc.results = Calculator.calculate({
    surfaceSpeed: calc.surfaceSpeed,
    diameter:     calc.diameter,
    flutes:       calc.flutes,
    chipLoad:     calc.chipLoad,
    unit,
    materialKey:  calc.materialKey,
  });
}

// -------------------------------------------------------------------
// Render the calculator output panel
// -------------------------------------------------------------------
function renderCalcOutputs() {
  const { results } = AppState.calc;
  const unit        = AppState.unit;
  const isMetric    = unit === 'metric';

  // RPM
  const rpmEl = document.getElementById('output-rpm');
  rpmEl.textContent = results?.rpm != null
    ? Math.round(results.rpm).toLocaleString()
    : '--';

  // Feed rate
  const frEl   = document.getElementById('output-feedrate');
  const frUnit = document.getElementById('lbl-feedrate-unit');
  if (results?.feedRate != null) {
    frEl.textContent   = results.feedRate.toFixed(1);
    frUnit.textContent = isMetric ? 'mm/min' : 'in/min';
  } else {
    frEl.textContent   = '--';
    frUnit.textContent = isMetric ? 'mm/min' : 'in/min';
  }

  // Step-down / step-over (show for all materials — recommendations always useful)
  const stepUnit = isMetric ? 'mm' : 'in';
  const dec      = isMetric ? 2 : 4;

  const sdEl  = document.getElementById('output-stepdown');
  const soEl  = document.getElementById('output-stepover');
  const suEl  = document.getElementById('lbl-step-unit');
  const souEl = document.getElementById('lbl-stepover-unit');

  if (results?.stepDownMin != null) {
    sdEl.textContent  = `${results.stepDownMin.toFixed(dec)} – ${results.stepDownMax.toFixed(dec)}`;
    soEl.textContent  = `${results.stepOverMin.toFixed(dec)} – ${results.stepOverMax.toFixed(dec)}`;
    if (suEl)  suEl.textContent  = stepUnit;
    if (souEl) souEl.textContent = stepUnit;
  } else {
    sdEl.textContent = '--';
    soEl.textContent = '--';
  }

  // Preset hint card
  updatePresetHints();
}

// -------------------------------------------------------------------
// Render unit labels on calculator inputs
// -------------------------------------------------------------------
function renderCalcLabels() {
  const isMetric = AppState.unit === 'metric';
  const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  setText('lbl-diameter',  isMetric ? 'mm' : 'in');
  setText('lbl-speed',     isMetric ? 'm/min' : 'SFM');
  setText('lbl-chipload',  isMetric ? 'mm/tooth' : 'in/tooth');
  // modal unit label (if open)
  setText('modal-unit-label', isMetric ? 'mm' : 'in');
}

// -------------------------------------------------------------------
// Sync input DOM values from AppState (called after unit toggle or load)
// -------------------------------------------------------------------
function syncInputsFromState() {
  const { calc } = AppState;
  const isMetric = AppState.unit === 'metric';

  setInputVal('input-diameter',    calc.diameter,     isMetric ? 4 : 4);
  setInputVal('input-flutes',      calc.flutes,       0);
  setInputVal('input-surface-speed', calc.surfaceSpeed, isMetric ? 2 : 1);
  setInputVal('input-chip-load',   calc.chipLoad,     isMetric ? 4 : 5);

  const matSel = document.getElementById('material-select');
  if (matSel) matSel.value = calc.materialKey;

  const tmSel = document.getElementById('tool-material-select');
  if (tmSel) tmSel.value = calc.toolMaterial;
}

function setInputVal(id, val, dec) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = (typeof val === 'number' && !isNaN(val))
    ? (dec > 0 ? val.toFixed(dec) : String(Math.round(val)))
    : '';
}

// -------------------------------------------------------------------
// Show/update preset range hints
// -------------------------------------------------------------------
function updatePresetHints() {
  const { calc, unit } = AppState;
  const isMetric = unit === 'metric';
  const diamIn   = UnitConverter.toInches(calc.diameter, unit);
  const presets  = getPresets(calc.materialKey, calc.toolMaterial, diamIn, unit);

  const speedHint    = document.getElementById('hint-speed');
  const chipHint     = document.getElementById('hint-chipload');
  const hintCard     = document.getElementById('preset-hint-card');
  const hintSpeedRng = document.getElementById('hint-speed-range');
  const hintChipRng  = document.getElementById('hint-chipload-range');

  if (presets) {
    const speedDec = isMetric ? 1 : 0;
    const chipDec  = isMetric ? 3 : 5;
    const speedU   = isMetric ? 'm/min' : 'SFM';
    const chipU    = isMetric ? 'mm/tooth' : 'in/tooth';

    if (speedHint) speedHint.textContent =
      `Suggested: ${presets.surfaceSpeedMin.toFixed(speedDec)}–${presets.surfaceSpeedMax.toFixed(speedDec)} ${speedU}`;
    if (chipHint) chipHint.textContent =
      `Suggested: ${presets.chipLoadMin.toFixed(chipDec)}–${presets.chipLoadMax.toFixed(chipDec)} ${chipU}`;
    if (hintSpeedRng) hintSpeedRng.textContent =
      `${presets.surfaceSpeedMin.toFixed(speedDec)}–${presets.surfaceSpeedMax.toFixed(speedDec)} ${speedU}`;
    if (hintChipRng) hintChipRng.textContent =
      `${presets.chipLoadMin.toFixed(chipDec)}–${presets.chipLoadMax.toFixed(chipDec)} ${chipU}`;
  } else {
    if (speedHint)    speedHint.textContent = '';
    if (chipHint)     chipHint.textContent  = '';
    if (hintSpeedRng) hintSpeedRng.textContent = '--';
    if (hintChipRng)  hintChipRng.textContent  = '--';
  }
}

// -------------------------------------------------------------------
// Render the library tab grid
// -------------------------------------------------------------------
function renderLibraryTab() {
  const { filterType, filterMaterial, searchQuery } = AppState.library;
  const allTools    = ToolLibrary.getAll();
  const filtered    = ToolLibrary.filter({ type: filterType, material: filterMaterial, searchQuery });
  const grid        = document.getElementById('tool-grid');
  const emptyState  = document.getElementById('empty-state');
  const noResults   = document.getElementById('no-results-state');

  // Update tool count badge
  const badge = document.getElementById('tool-count-badge');
  if (badge) badge.textContent = allTools.length;

  // Clear grid
  grid.innerHTML = '';

  if (allTools.length === 0) {
    emptyState.hidden  = false;
    noResults.hidden   = true;
    return;
  }

  emptyState.hidden = true;

  if (filtered.length === 0) {
    noResults.hidden = false;
    return;
  }

  noResults.hidden = true;

  filtered.forEach(tool => {
    grid.appendChild(renderToolCard(tool, AppState.unit));
  });
}

// -------------------------------------------------------------------
// Populate the tool select dropdown in the calculator
// -------------------------------------------------------------------
function refreshToolSelect() {
  const sel = document.getElementById('tool-select');
  if (!sel) return;
  const tools = ToolLibrary.getAll();
  renderToolSelectOptions(sel, tools, AppState.calc.selectedToolId);
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

  // Convert stored diameter (always in inches) to active unit
  const diamIn = tool.diameter;
  AppState.calc.diameter = AppState.unit === 'metric'
    ? UnitConverter.inchesToMM(diamIn)
    : diamIn;

  // Apply presets for current material
  const presets = getPresets(AppState.calc.materialKey, tool.material, diamIn, AppState.unit);
  if (presets) {
    AppState.calc.surfaceSpeed = presets.surfaceSpeed;
    AppState.calc.chipLoad     = presets.chipLoad;
  }

  recalculate();
  syncInputsFromState();
  renderCalcOutputs();
  renderCalcLabels();

  // Switch to calculator tab
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

  // Convert current calc state in-place
  UnitConverter.convertCalcState(AppState.calc, oldUnit, newUnit);
  AppState.unit = newUnit;

  recalculate();
  syncInputsFromState();
  renderCalcOutputs();
  renderCalcLabels();

  // Update unit toggle button states
  document.querySelectorAll('.unit-toggle__btn').forEach(btn => {
    const isActive = btn.dataset.unit === newUnit;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  // Re-render library cards so diameters update
  if (AppState.activeTab === 'library') renderLibraryTab();

  // Persist preference
  savePreferences();
}

// -------------------------------------------------------------------
// Modal: open for Add
// -------------------------------------------------------------------
function openAddModal() {
  AppState.library.editingId = null;
  const modal = document.getElementById('tool-modal');
  document.getElementById('modal-title').textContent = 'Add Tool';
  document.getElementById('tool-form').reset();

  // Default subtype field
  const typeEl = document.getElementById('field-type');
  typeEl.value = 'end_mill';
  renderModalSubtypeField(
    document.getElementById('field-subtype-container'),
    'end_mill', 'flat', 45
  );

  // Clear validation errors
  document.querySelectorAll('.form-input.error, .form-select.error')
    .forEach(el => el.classList.remove('error'));
  document.querySelectorAll('.form-error')
    .forEach(el => { el.hidden = true; });

  // Update unit label
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

  // Populate fields
  document.getElementById('field-name').value     = tool.name ?? '';
  document.getElementById('field-type').value     = tool.type ?? 'end_mill';
  document.getElementById('field-material').value = tool.material ?? 'carbide';
  document.getElementById('field-coating').value  = tool.coating  ?? 'uncoated';
  document.getElementById('field-maxrpm').value   = tool.maxRPM   ?? '';
  document.getElementById('field-notes').value    = tool.notes    ?? '';
  document.getElementById('field-flutes').value   = tool.flutes   ?? '';

  // Diameter: show in current unit
  const diam = AppState.unit === 'metric'
    ? UnitConverter.inchesToMM(tool.diameter)
    : tool.diameter;
  document.getElementById('field-diameter').value = diam.toFixed(AppState.unit === 'metric' ? 2 : 4);

  // Update unit label
  document.getElementById('modal-unit-label').textContent =
    AppState.unit === 'metric' ? 'mm' : 'in';

  // Render subtype field
  renderModalSubtypeField(
    document.getElementById('field-subtype-container'),
    tool.type, tool.subtype, tool.vBitAngle
  );

  // Clear validation errors
  document.querySelectorAll('.form-input.error, .form-select.error')
    .forEach(el => el.classList.remove('error'));
  document.querySelectorAll('.form-error')
    .forEach(el => { el.hidden = true; });

  modal.showModal();
}

// -------------------------------------------------------------------
// Modal: close
// -------------------------------------------------------------------
function closeModal() {
  const modal = document.getElementById('tool-modal');
  modal.close();
  AppState.library.editingId = null;
}

// -------------------------------------------------------------------
// Modal: save (add or update)
// -------------------------------------------------------------------
function handleModalSave() {
  if (!validateModalForm()) return;

  const form     = document.getElementById('tool-form');
  const typeEl   = document.getElementById('field-type');
  const type     = typeEl.value;

  // Read subtype/vBitAngle depending on type
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

  // Diameter: convert to inches for storage (always stored in inches)
  const rawDiam = parseFloat(document.getElementById('field-diameter').value);
  const diamIn  = AppState.unit === 'metric'
    ? UnitConverter.mmToInches(rawDiam)
    : rawDiam;

  const toolData = {
    name:        document.getElementById('field-name').value.trim(),
    type,
    subtype,
    vBitAngle,
    diameter:    diamIn,
    diameterUnit:'in',
    flutes:      parseInt(document.getElementById('field-flutes').value, 10),
    material:    document.getElementById('field-material').value,
    coating:     document.getElementById('field-coating').value,
    maxRPM:      parseInt(document.getElementById('field-maxrpm').value, 10) || null,
    notes:       document.getElementById('field-notes').value.trim(),
  };

  const editingId = AppState.library.editingId;
  if (editingId) {
    ToolLibrary.update(editingId, toolData);
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
    } catch (err) {
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
      surfaceSpeed:  AppState.calc.surfaceSpeed,
      chipLoad:      AppState.calc.chipLoad,
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
    if (c.materialKey)  AppState.calc.materialKey  = c.materialKey;
    if (c.diameter)     AppState.calc.diameter      = c.diameter;
    if (c.flutes)       AppState.calc.flutes        = c.flutes;
    if (c.toolMaterial) AppState.calc.toolMaterial  = c.toolMaterial;
    if (c.surfaceSpeed) AppState.calc.surfaceSpeed  = c.surfaceSpeed;
    if (c.chipLoad)     AppState.calc.chipLoad      = c.chipLoad;
  }
}

// -------------------------------------------------------------------
// Initialization
// -------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {

  // 1. Load preferences
  loadPreferences();

  // 2. Render material select
  renderMaterialSelect(document.getElementById('material-select'), AppState.calc.materialKey);

  // 3. Populate tool select for library source
  refreshToolSelect();

  // 4. Sync input values + labels
  syncInputsFromState();
  renderCalcLabels();

  // 5. Set active unit toggle button
  document.querySelectorAll('.unit-toggle__btn').forEach(btn => {
    const isActive = btn.dataset.unit === AppState.unit;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  // 6. Initial calculation + render
  recalculate();
  renderCalcOutputs();

  // 7. Initial library render
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

  // --- Tool source toggle (Custom / From Library) ---
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

  // --- Tool select (from library picker) ---
  document.getElementById('tool-select').addEventListener('change', e => {
    const id = e.target.value;
    if (id) handleLoadTool(id);
  });

  // --- Calculator form: all inputs (delegated) ---
  const calcInputIds = [
    'input-diameter', 'input-flutes', 'input-surface-speed', 'input-chip-load',
    'material-select', 'tool-material-select',
  ];

  calcInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const val = el.type === 'number' ? parseFloat(el.value) : el.value;

      if (id === 'input-diameter')       AppState.calc.diameter      = val || 0;
      else if (id === 'input-flutes')    AppState.calc.flutes        = val || 0;
      else if (id === 'input-surface-speed') AppState.calc.surfaceSpeed = val || 0;
      else if (id === 'input-chip-load') AppState.calc.chipLoad      = val || 0;
      else if (id === 'material-select') AppState.calc.materialKey   = val;
      else if (id === 'tool-material-select') AppState.calc.toolMaterial = val;

      recalculate();
      renderCalcOutputs();
      savePreferences();
    });
  });

  // --- Apply Presets button ---
  document.getElementById('btn-apply-presets').addEventListener('click', () => {
    const diamIn  = UnitConverter.toInches(AppState.calc.diameter, AppState.unit);
    const presets = getPresets(AppState.calc.materialKey, AppState.calc.toolMaterial, diamIn, AppState.unit);
    if (presets) {
      AppState.calc.surfaceSpeed = presets.surfaceSpeed;
      AppState.calc.chipLoad     = presets.chipLoad;
      syncInputsFromState();
      recalculate();
      renderCalcOutputs();
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

  // --- Library: Add tool button ---
  document.getElementById('btn-add-tool').addEventListener('click', openAddModal);
  document.getElementById('btn-add-tool-empty').addEventListener('click', openAddModal);

  // --- Library: tool card actions (delegated click on grid) ---
  document.getElementById('tool-grid').addEventListener('click', e => {
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

  // --- Modal: type field changes subtype rendering ---
  document.getElementById('field-type').addEventListener('change', e => {
    renderModalSubtypeField(
      document.getElementById('field-subtype-container'),
      e.target.value, null, 45
    );
  });

  // --- Modal controls ---
  document.getElementById('modal-save').addEventListener('click', handleModalSave);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  // Close on backdrop click
  document.getElementById('tool-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Close on Escape key (native behavior, but ensure state cleanup)
  document.getElementById('tool-modal').addEventListener('cancel', () => {
    AppState.library.editingId = null;
  });

  // --- Blur-based validation on modal number inputs ---
  ['field-diameter', 'field-flutes'].forEach(id => {
    document.getElementById(id)?.addEventListener('blur', () => {
      validateNumber(document.getElementById(id), `err-${id.replace('field-', '')}`);
    });
  });
  document.getElementById('field-name')?.addEventListener('blur', () => {
    validateRequired(document.getElementById('field-name'), 'err-name');
  });

});
