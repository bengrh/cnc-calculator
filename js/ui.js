// ui.js — DOM helpers, rendering, and UI utilities
// Depends on: data.js, toolLibrary.js

// -------------------------------------------------------------------
// Safety: HTML escape to prevent XSS when inserting user content
// -------------------------------------------------------------------
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// -------------------------------------------------------------------
// Label formatters
// -------------------------------------------------------------------
function formatToolTypeBadge(type, subtype) {
  const subtypeLabels = CNCData.toolSubtypeLabels;
  const typeLabels    = CNCData.toolTypeLabels;

  if (type === 'v_bit')      return 'V-Bit';
  if (type === 'drill')      return 'Drill';
  if (subtype && subtypeLabels[subtype]) {
    return `${subtypeLabels[subtype]} ${typeLabels[type] || ''}`.trim();
  }
  return typeLabels[type] || type;
}

function formatDiameter(tool, unit) {
  const inches = tool.diameter; // always stored in inches
  if (unit === 'metric') {
    return `${UnitConverter.inchesToMM(inches).toFixed(2)} mm`;
  }
  // Show as fraction hint if it's a common fraction
  const fractions = {
    0.0625: '1/16"', 0.125: '1/8"', 0.1875: '3/16"',
    0.25: '1/4"', 0.3125: '5/16"', 0.375: '3/8"',
    0.4375: '7/16"', 0.5: '1/2"', 0.625: '5/8"',
    0.75: '3/4"', 0.875: '7/8"', 1.0: '1"',
  };
  const frac = fractions[Math.round(inches * 10000) / 10000];
  return frac ? `${frac} (${inches.toFixed(4)}")` : `${inches}" `;
}

// -------------------------------------------------------------------
// Toast notifications
// -------------------------------------------------------------------
let _toastTimer = null;

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) { clearTimeout(_toastTimer); existing.remove(); }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);

  _toastTimer = setTimeout(() => toast.remove(), 3500);
}

// -------------------------------------------------------------------
// Tab switching
// -------------------------------------------------------------------
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.remove('active');
    el.hidden = true;
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });
  const panel = document.getElementById(`tab-${tabName}`);
  if (panel) {
    panel.hidden = false;
    panel.classList.add('active');
  }
}

// -------------------------------------------------------------------
// Render material <select> with <optgroup> grouping
// -------------------------------------------------------------------
function renderMaterialSelect(selectEl, currentValue) {
  const groups = {};
  CNCData.materials.forEach(m => {
    if (!groups[m.group]) groups[m.group] = [];
    groups[m.group].push(m);
  });

  selectEl.innerHTML = Object.entries(groups).map(([group, mats]) => `
    <optgroup label="${escapeHtml(group)}">
      ${mats.map(m =>
        `<option value="${m.key}"${m.key === currentValue ? ' selected' : ''}>
           ${escapeHtml(m.label)}
         </option>`
      ).join('')}
    </optgroup>
  `).join('');
}

// -------------------------------------------------------------------
// Render tool <select> for "from library" picker
// -------------------------------------------------------------------
function renderToolSelectOptions(selectEl, tools, currentId) {
  const options = tools.length
    ? tools.map(t =>
        `<option value="${t.id}"${t.id === currentId ? ' selected' : ''}>
           ${escapeHtml(t.name)}
         </option>`
      ).join('')
    : '<option value="" disabled>No tools in library</option>';

  selectEl.innerHTML = `<option value="">-- Choose a tool --</option>${options}`;
}

// -------------------------------------------------------------------
// Render a single tool as a table row
// -------------------------------------------------------------------
function renderToolRow(tool, unit) {
  const tr = document.createElement('tr');
  tr.className = 'tool-row';
  tr.dataset.toolId = tool.id;

  const badge    = formatToolTypeBadge(tool.type, tool.subtype);
  const diameter = formatDiameter(tool, unit);
  const matLabel = CNCData.toolMaterialLabels[tool.material] || tool.material;

  tr.innerHTML = `
    <td class="col-name">
      <span class="tbl-tool-name">${escapeHtml(tool.name)}</span>
    </td>
    <td class="col-type">
      <span class="tool-badge">${escapeHtml(badge)}</span>
    </td>
    <td class="col-dia">
      <span class="tbl-mono">${escapeHtml(diameter)}</span>
    </td>
    <td class="col-flutes">
      <span class="tbl-mono">${tool.flutes}</span>
    </td>
    <td class="col-mat">
      <span class="tbl-secondary">${escapeHtml(matLabel)}</span>
    </td>
    <td class="col-notes">
      <span class="tbl-notes">${escapeHtml(tool.notes || '')}</span>
    </td>
    <td class="col-actions">
      <div class="tbl-actions">
        <button class="btn btn-secondary btn-sm btn-use-tool" data-id="${tool.id}" title="Load into calculator">Use</button>
        <button class="btn btn-secondary btn-sm btn-edit-tool" data-id="${tool.id}" title="Edit tool">Edit</button>
        <button class="btn btn-danger btn-sm btn-delete-tool" data-id="${tool.id}" title="Delete tool">Delete</button>
      </div>
    </td>`;

  return tr;
}

// -------------------------------------------------------------------
// Render the dynamic subtype field inside the modal
// based on the selected tool type
// -------------------------------------------------------------------
function renderModalSubtypeField(container, type, currentSubtype, vBitAngle) {
  container.innerHTML = '';

  if (type === 'end_mill') {
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `
      <label class="form-label" for="field-subtype">End Mill Style</label>
      <select class="form-select" id="field-subtype" name="subtype">
        <option value="flat"${currentSubtype === 'flat' ? ' selected' : ''}>Flat (Square End)</option>
        <option value="ball"${currentSubtype === 'ball' ? ' selected' : ''}>Ball Nose</option>
        <option value="bull_nose"${currentSubtype === 'bull_nose' ? ' selected' : ''}>Bull Nose</option>
      </select>`;
    container.appendChild(div);
  } else if (type === 'router_bit') {
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `
      <label class="form-label" for="field-subtype">Router Bit Style</label>
      <select class="form-select" id="field-subtype" name="subtype">
        <option value="upcut"${currentSubtype === 'upcut' ? ' selected' : ''}>Upcut Spiral</option>
        <option value="downcut"${currentSubtype === 'downcut' ? ' selected' : ''}>Downcut Spiral</option>
        <option value="compression"${currentSubtype === 'compression' ? ' selected' : ''}>Compression</option>
      </select>`;
    container.appendChild(div);
  } else if (type === 'v_bit') {
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `
      <label class="form-label" for="field-vangle">V-Bit Included Angle</label>
      <select class="form-select" id="field-vangle" name="vBitAngle">
        ${CNCData.vBitAngles.map(a =>
          `<option value="${a}"${Number(vBitAngle) === a ? ' selected' : ''}>${a}°</option>`
        ).join('')}
      </select>`;
    container.appendChild(div);
  }
  // drill: no subtype field needed
}

// -------------------------------------------------------------------
// Inline input validation helpers
// -------------------------------------------------------------------
function validateRequired(input, errorId) {
  const hasValue = input.value.trim() !== '';
  input.classList.toggle('error', !hasValue);
  const err = document.getElementById(errorId);
  if (err) err.hidden = hasValue;
  return hasValue;
}

function validateNumber(input, errorId) {
  const val = parseFloat(input.value);
  const min = parseFloat(input.min);
  const max = parseFloat(input.max);
  const isValid = !isNaN(val)
    && val > 0
    && (isNaN(min) || val >= min)
    && (isNaN(max) || val <= max);
  input.classList.toggle('error', !isValid);
  const err = document.getElementById(errorId);
  if (err) err.hidden = isValid;
  return isValid;
}

// Run validation on all required modal fields; returns true if valid
function validateModalForm() {
  const nameOk     = validateRequired(document.getElementById('field-name'), 'err-name');
  const diameterOk = validateNumber(document.getElementById('field-diameter'), 'err-diameter');
  const flutesOk   = validateNumber(document.getElementById('field-flutes'), 'err-flutes');
  return nameOk && diameterOk && flutesOk;
}
