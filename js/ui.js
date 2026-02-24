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
// Bit Profile SVG Diagrams
// Each returns an inline SVG string showing a side-profile of the bit.
// Coordinate system: 0,0 = top-left of 52×52 viewBox.
// The bit runs top (shank) → bottom (tip), centred at x=26.
// -------------------------------------------------------------------
function renderBitDiagram(type, subtype) {
  // Shared dimensions
  const W = 52, H = 52;
  const cx = 26;            // centre x
  const sw = 10;            // half-shank width (shank = 20px wide)
  const fw = 13;            // half-flute width (flute zone = 26px wide)
  const shankH = 12;        // shank section height
  const fluteH = 28;        // flute zone height
  const shankY = 2;         // shank top y
  const fluteY = shankY + shankH; // flute top y
  const tipY   = fluteY + fluteH; // tip bottom y

  // Helper: helix lines for upcut (lines angling ↗ = chip moves up)
  const helixUp = (x1, x2, yTop, yBot, steps = 4) => {
    let d = '';
    const step = (yBot - yTop) / steps;
    for (let i = 0; i < steps; i++) {
      const y0 = yTop + i * step;
      const y1 = y0 + step * 0.85;
      // Upcut: lines angle from bottom-left to top-right
      d += `<path class="bd-helix" d="M${x1} ${y1} Q${cx} ${(y0+y1)/2 - 3} ${x2} ${y0}"/>`;
    }
    return d;
  };

  // Helper: helix lines for downcut (lines angling ↘ = chip moves down)
  const helixDown = (x1, x2, yTop, yBot, steps = 4) => {
    let d = '';
    const step = (yBot - yTop) / steps;
    for (let i = 0; i < steps; i++) {
      const y0 = yTop + i * step;
      const y1 = y0 + step * 0.85;
      // Downcut: lines angle from top-left to bottom-right
      d += `<path class="bd-helix" d="M${x1} ${y0} Q${cx} ${(y0+y1)/2 + 3} ${x2} ${y1}"/>`;
    }
    return d;
  };

  // Helper: serration bumps along an edge (rougher)
  const serrations = (x, yTop, yBot, side = 'left') => {
    const count = 6;
    const step  = (yBot - yTop) / count;
    const amp   = side === 'left' ? -3 : 3;
    let d = '';
    for (let i = 0; i < count; i++) {
      const y = yTop + i * step + step / 2;
      d += `<line class="bd-serration" x1="${x}" y1="${y - step/3}" x2="${x + amp}" y2="${y}"/>`;
      d += `<line class="bd-serration" x1="${x + amp}" y1="${y}" x2="${x}" y2="${y + step/3}"/>`;
    }
    return d;
  };

  const open  = `<svg class="bit-diagram" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
  const close = `</svg>`;

  // ── Shank block (common to all) ──────────────────────────────────
  const shankRect = `<rect class="bd-shank" x="${cx - sw}" y="${shankY}" width="${sw*2}" height="${shankH}" rx="1.5"/>`;

  // ── Collet taper line ────────────────────────────────────────────
  // Small taper from shank width to flute width
  const taperLeft  = `<polygon class="bd-shank" points="${cx-sw},${fluteY - 1} ${cx-fw},${fluteY + 3} ${cx-fw},${fluteY - 1}"/>`;
  const taperRight = `<polygon class="bd-shank" points="${cx+sw},${fluteY - 1} ${cx+fw},${fluteY + 3} ${cx+fw},${fluteY - 1}"/>`;

  // ── Flute body rectangle ─────────────────────────────────────────
  const fluteRect = `<rect class="bd-flute" x="${cx - fw}" y="${fluteY}" width="${fw*2}" height="${fluteH}" rx="1"/>`;

  // ─────────────────────────────────────────────────────────────────
  // Per-type / subtype assembly
  // ─────────────────────────────────────────────────────────────────

  // UPCUT SPIRAL ROUTER BIT
  if ((type === 'router_bit' && subtype === 'upcut') || (type === 'end_mill' && subtype === 'flat')) {
    const flatTip = `<rect class="bd-tip-flat" x="${cx-fw}" y="${tipY}" width="${fw*2}" height="3" rx="0"/>`;
    const helices = helixUp(cx - fw + 2, cx + fw - 2, fluteY + 2, tipY - 2);
    return open + shankRect + taperLeft + taperRight + fluteRect + helices + flatTip + close;
  }

  // DOWNCUT SPIRAL ROUTER BIT
  if (type === 'router_bit' && subtype === 'downcut') {
    const flatTip = `<rect class="bd-tip-flat" x="${cx-fw}" y="${tipY}" width="${fw*2}" height="3" rx="0"/>`;
    const helices = helixDown(cx - fw + 2, cx + fw - 2, fluteY + 2, tipY - 2);
    return open + shankRect + taperLeft + taperRight + fluteRect + helices + flatTip + close;
  }

  // COMPRESSION SPIRAL
  if (type === 'router_bit' && subtype === 'compression') {
    const midY   = fluteY + fluteH / 2;
    const divider = `<line class="bd-divider" x1="${cx - fw}" y1="${midY}" x2="${cx + fw}" y2="${midY}"/>`;
    // Bottom half: upcut helices; top half: downcut helices
    const helicesDown = helixDown(cx - fw + 2, cx + fw - 2, fluteY + 2, midY - 1, 2);
    const helicesUp   = helixUp(cx - fw + 2, cx + fw - 2, midY + 1, tipY - 2, 2);
    const flatTip = `<rect class="bd-tip-flat" x="${cx-fw}" y="${tipY}" width="${fw*2}" height="3" rx="0"/>`;
    return open + shankRect + taperLeft + taperRight + fluteRect + helicesDown + helicesUp + divider + flatTip + close;
  }

  // BALL NOSE (end_mill or router_bit ball)
  if (subtype === 'ball') {
    const r    = fw;
    const ballY = tipY - r;
    // Rectangular flute body ending before the ball
    const fluteShort = `<rect class="bd-flute" x="${cx-fw}" y="${fluteY}" width="${fw*2}" height="${fluteH - r}" rx="1"/>`;
    // Semicircle tip
    const ball = `<path class="bd-tip-ball" d="M${cx-fw} ${ballY} A${r} ${r} 0 0 0 ${cx+fw} ${ballY}"/>`;
    const helices = (type === 'end_mill')
      ? helixUp(cx - fw + 2, cx + fw - 2, fluteY + 2, ballY - 2)
      : helixDown(cx - fw + 2, cx + fw - 2, fluteY + 2, ballY - 2);
    return open + shankRect + taperLeft + taperRight + fluteShort + helices + ball + close;
  }

  // BULL NOSE
  if (subtype === 'bull_nose') {
    const cr   = 4; // corner radius
    const flatTip = `
      <path class="bd-tip-flat"
        d="M${cx-fw} ${tipY - cr} Q${cx-fw} ${tipY+2} ${cx-fw+cr} ${tipY+2}
           L${cx+fw-cr} ${tipY+2} Q${cx+fw} ${tipY+2} ${cx+fw} ${tipY - cr}
           L${cx+fw} ${tipY} L${cx-fw} ${tipY} Z"/>`;
    const helices = helixUp(cx - fw + 2, cx + fw - 2, fluteY + 2, tipY - 3);
    return open + shankRect + taperLeft + taperRight + fluteRect + helices + flatTip + close;
  }

  // V-BIT
  if (type === 'v_bit') {
    // V-shaped taper from full flute width to a point at bottom
    const vBody = `<polygon class="bd-vfill"
      points="${cx-fw},${fluteY} ${cx+fw},${fluteY} ${cx},${tipY+4}"/>`;
    // Shank still rectangular, but flute is v-shaped (no taper blocks)
    const shankOnly = `<rect class="bd-shank" x="${cx-sw}" y="${shankY}" width="${sw*2}" height="${shankH + 4}" rx="1.5"/>`;
    // Light helix lines on V flanks
    const vHelixL = `<line class="bd-helix" x1="${cx-fw+2}" y1="${fluteY+4}" x2="${cx-3}" y2="${tipY}"/>`;
    const vHelixR = `<line class="bd-helix" x1="${cx+fw-2}" y1="${fluteY+4}" x2="${cx+3}" y2="${tipY}"/>`;
    return open + shankOnly + vBody + vHelixL + vHelixR + close;
  }

  // DRILL BIT
  if (type === 'drill') {
    const drillBody = `<rect class="bd-drill" x="${cx-sw}" y="${fluteY}" width="${sw*2}" height="${fluteH - 6}" rx="1"/>`;
    // Pointed tip: triangle
    const drillTip  = `<polygon class="bd-drill-tip"
      points="${cx-sw},${tipY-6} ${cx+sw},${tipY-6} ${cx},${tipY+4}"/>`;
    // Twist lines
    const twist1 = `<path class="bd-helix" d="M${cx-sw+2} ${fluteY+4} Q${cx} ${fluteY+10} ${cx+sw-2} ${fluteY+16}"/>`;
    const twist2 = `<path class="bd-helix" d="M${cx-sw+2} ${fluteY+14} Q${cx} ${fluteY+20} ${cx+sw-2} ${fluteY+26}"/>`;
    return open + shankRect + drillBody + drillTip + twist1 + twist2 + close;
  }

  // ROUGHER / CHIPBREAKER (router_bit with no matching subtype, or explicit rougher)
  // Show upcut with serrated edges
  const flatTip = `<rect class="bd-tip-flat" x="${cx-fw}" y="${tipY}" width="${fw*2}" height="3" rx="0"/>`;
  const roughHelix = helixUp(cx - fw + 2, cx + fw - 2, fluteY + 2, tipY - 2, 3);
  const serrL = serrations(cx - fw, fluteY + 3, tipY - 3, 'left');
  const serrR = serrations(cx + fw, fluteY + 3, tipY - 3, 'right');
  return open + shankRect + taperLeft + taperRight + fluteRect + roughHelix + serrL + serrR + flatTip + close;
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
    <td class="col-diagram">${renderBitDiagram(tool.type, tool.subtype)}</td>
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
