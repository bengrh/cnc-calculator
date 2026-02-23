// toolLibrary.js — Tool library CRUD using localStorage
// Depends on: data.js (for label helpers)

// -------------------------------------------------------------------
// UUID generation (no library needed)
// -------------------------------------------------------------------
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// -------------------------------------------------------------------
// Preferences (unit system, last calc state)
// -------------------------------------------------------------------
const Preferences = {
  KEY: 'cnc_preferences',

  load() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '{}');
    } catch { return {}; }
  },

  save(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch { /* storage full — silently ignore */ }
  },
};

// -------------------------------------------------------------------
// Tool Library
// -------------------------------------------------------------------
const ToolLibrary = {
  KEY: 'cnc_tool_library',

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '[]');
    } catch { return []; }
  },

  _save(tools) {
    localStorage.setItem(this.KEY, JSON.stringify(tools));
  },

  add(toolData) {
    const tools = this.getAll();
    const now   = new Date().toISOString();
    const tool  = { ...toolData, id: generateId(), createdAt: now, updatedAt: now };
    tools.push(tool);
    this._save(tools);
    return tool;
  },

  update(id, updates) {
    const tools   = this.getAll();
    const idx     = tools.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tools[idx] = { ...tools[idx], ...updates, id, updatedAt: new Date().toISOString() };
    this._save(tools);
    return tools[idx];
  },

  delete(id) {
    this._save(this.getAll().filter(t => t.id !== id));
  },

  getById(id) {
    return this.getAll().find(t => t.id === id) || null;
  },

  // Filter tools — all params optional
  filter({ type = '', material = '', searchQuery = '' } = {}) {
    return this.getAll().filter(tool => {
      if (type     && tool.type     !== type)     return false;
      if (material && tool.material !== material) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inName  = tool.name?.toLowerCase().includes(q);
        const inNotes = tool.notes?.toLowerCase().includes(q);
        if (!inName && !inNotes) return false;
      }
      return true;
    });
  },

  // Export all tools as a formatted JSON string
  exportJSON() {
    return JSON.stringify({
      version:    1,
      exportedAt: new Date().toISOString(),
      tools:      this.getAll(),
    }, null, 2);
  },

  // Import from JSON string — merges with existing tools (new IDs assigned)
  importJSON(jsonString) {
    const data  = JSON.parse(jsonString);
    const tools = Array.isArray(data) ? data : data.tools;
    if (!Array.isArray(tools)) throw new Error('Invalid format: expected a tools array');
    const now     = new Date().toISOString();
    const stamped = tools.map(t => ({ ...t, id: generateId(), updatedAt: now,
                                       createdAt: t.createdAt || now }));
    this._save([...this.getAll(), ...stamped]);
    return stamped.length;
  },

  // Seed default tools on first load — only runs if library is empty
  seedIfEmpty() {
    if (this.getAll().length > 0) return;
    const now = new Date().toISOString();
    const tools = DEFAULT_TOOLS.map(t => ({ ...t, id: generateId(), createdAt: now, updatedAt: now }));
    this._save(tools);
  },

  // Migration: update notes for any existing tool whose name matches a DEFAULT_TOOLS entry,
  // but whose notes don't yet start with "Amana Tool" (i.e. have the old short-form notes).
  migrateToolNotes() {
    const tools = this.getAll();
    let changed = false;
    // Build a lookup: tool name prefix → notes from DEFAULT_TOOLS
    const notesMap = {};
    DEFAULT_TOOLS.forEach(t => {
      // Key off the model number portion (e.g. "46282-K") extracted from the name
      const match = t.name.match(/Amana\s+([\w\-]+)/);
      if (match) notesMap[match[1].toUpperCase()] = t.notes;
    });

    const updated = tools.map(t => {
      // Skip if notes are already in the new "Amana Tool …" format
      if (t.notes && t.notes.startsWith('Amana Tool')) return t;
      // Find matching model number in this tool's name
      const match = t.name.match(/Amana\s+([\w\-]+)/);
      if (!match) return t;
      const key = match[1].toUpperCase();
      if (notesMap[key]) {
        changed = true;
        return { ...t, notes: notesMap[key], updatedAt: new Date().toISOString() };
      }
      return t;
    });
    if (changed) this._save(updated);
  },

  // Migration: set coating to 'spektra' for any tool whose name contains '-K'
  // Safe to run on every load — only touches tools that still have 'uncoated'.
  migrateSpektraCoating() {
    const tools = this.getAll();
    let changed = false;
    const updated = tools.map(t => {
      if (t.coating === 'uncoated' && /\-K\b/.test(t.name)) {
        changed = true;
        return { ...t, coating: 'spektra', updatedAt: new Date().toISOString() };
      }
      return t;
    });
    if (changed) this._save(updated);
  },
};

// -------------------------------------------------------------------
// Default Amana tool data (seeded on first load)
// Diameters always stored in inches.
// Parsed from Amana Bits V2.vkb (RhinoCAM VisualMill library).
// -------------------------------------------------------------------
const DEFAULT_TOOLS = [
  {
    name: 'Amana 46282-K — 1/16" Upcut Spiral',
    type: 'router_bit', subtype: 'upcut', vBitAngle: null,
    diameter: 0.0625, diameterUnit: 'in', flutes: 4,
    material: 'carbide', coating: 'spektra', maxRPM: null,
    notes: 'Amana Tool 46282-K CNC Spektra Extreme Tool Life Coated SC 2D and 3D Carving 5.4 Deg Tapered Angle Ball Nose x 1/16 D x 1/32 R x 1 CH x 1/4 SHK x 3 Inch Long x 4 Flute Router Bit',
  },
  {
    name: 'Amana 46286-K — 1/8" Upcut Spiral',
    type: 'router_bit', subtype: 'upcut', vBitAngle: null,
    diameter: 0.125, diameterUnit: 'in', flutes: 3,
    material: 'carbide', coating: 'spektra', maxRPM: null,
    notes: 'Amana Tool 46286-K CNC Spektra Extreme Tool Life Coated SC 2D and 3D Carving 3.6 Deg Tapered Angle Ball Nose x 1/8 D x 1/16 R x 1 CH x 1/4 SHK x 3 Inch Long x 3 Flute Router Bit',
  },
  {
    name: 'Amana 46202-K — 1/4" Downcut Flat',
    type: 'router_bit', subtype: 'downcut', vBitAngle: null,
    diameter: 0.25, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'spektra', maxRPM: null,
    notes: 'Amana Tool 46202-K SC Spektra Extreme Tool Life Coated Spiral Plunge 1/4 Dia x 3/4 CH x 1/4 SHK 2-1/2 Inch Long Down-Cut Router Bit',
  },
  {
    name: 'Amana 46476-K — 1/4" Downcut Ball',
    type: 'end_mill', subtype: 'ball', vBitAngle: null,
    diameter: 0.25, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'spektra', maxRPM: null,
    notes: 'Amana Tool 46476-K SC Spektra Extreme Tool Life Coated Down-Cut Ball Nose Spiral 1/8 R x 1/4 D x 1 CH x 1/4 SHK x 2-1/2 Inch Long Router Bit',
  },
  {
    name: 'Amana 46477 — 1/2" Downcut Ball',
    type: 'end_mill', subtype: 'ball', vBitAngle: null,
    diameter: 0.5, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'uncoated', maxRPM: null,
    notes: 'Amana Tool 46477 Solid Carbide Double Flute Down-Cut Ball Nose Spiral 1/4 R x 1/2 D x 1-1/4 CH x 1/2 SHK x 3 Inch Long Router Bit',
  },
  {
    name: 'Amana 46034-K — 1/2" Compression',
    type: 'router_bit', subtype: 'compression', vBitAngle: null,
    diameter: 0.5, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'spektra', maxRPM: null,
    notes: 'Amana Tool 46034-K CNC SC Spektra Extreme Tool Life Coated Mortise Compression Spiral 1/2 D x 1 CH 1/2 SHK 3 Inch Long 2 Flute Router Bit',
  },
  {
    name: 'Amana 46226 — 1/2" Upcut Rougher',
    type: 'router_bit', subtype: 'upcut', vBitAngle: null,
    diameter: 0.5, diameterUnit: 'in', flutes: 3,
    material: 'carbide', coating: 'uncoated', maxRPM: null,
    notes: 'Amana Tool 46226 Solid Carbide Roughing Spiral 3 Flute Chipbreaker 1/2 D x 2 CH x 1/2 SHK x 4 Inch Long Down-Cut Router Bit',
  },
  {
    name: 'Amana 46387 — 3/4" Upcut Ball',
    type: 'end_mill', subtype: 'ball', vBitAngle: null,
    diameter: 0.75, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'uncoated', maxRPM: null,
    notes: 'Amana Tool 46387 Solid Carbide Double Flute Up-Cut Ball Nose Spiral 3/8 R x 3/4 D x 2-1/2 CH x 3/4 SHK x 5 Inch Long Router Bit',
  },
  {
    name: 'Amana 45944 — (verify specs)',
    type: 'router_bit', subtype: 'upcut', vBitAngle: null,
    diameter: 0.25, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'uncoated', maxRPM: null,
    notes: 'Amana Tool 45944 Carbide Tipped Core Box 5/8 R x 1-1/4 D x 1-1/4 CH x 1/2 Inch SHK Extra Deep Router Bit',
  },
  {
    name: 'Amana 46360 — 1/2" Compression (Long)',
    type: 'router_bit', subtype: 'compression', vBitAngle: null,
    diameter: 0.5, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'uncoated', maxRPM: null,
    notes: 'Amana Tool 46360 CNC SC Mortise Compression Spiral 1/2 D x 2-1/8 CH x 1/2 SHK x 4 Inch Long 2 Flute Router Bit',
  },
  {
    name: 'Amana 46294-K — 1/4" Upcut Ball',
    type: 'end_mill', subtype: 'ball', vBitAngle: null,
    diameter: 0.25, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'spektra', maxRPM: null,
    notes: 'Amana Tool 46294-K CNC Spektra Extreme Tool Life Coated SC 2D and 3D Carving 0.10 Deg Straight Angle Ball Nose x 1/4 D x 1/8 R x 1-1/2 CH x 1/4 SHK x 3 Inch Long x 2 Flute Router Bit',
  },
  {
    name: 'Amana RC-2255 — 2" Fly Cutter',
    type: 'router_bit', subtype: 'upcut', vBitAngle: null,
    diameter: 2.0, diameterUnit: 'in', flutes: 3,
    material: 'carbide', coating: 'uncoated', maxRPM: null,
    notes: 'Amana Tool RC-2255 CNC Spoilboard Insert Carbide 3 Wing, Surfacing, Planing, Flycutting & Slab Leveler 2-1/2 Diameter x 1/2 SHK Router Bit',
  },
  {
    name: 'Amana 48342-K — 1/4" Downcut Flat (Long)',
    type: 'router_bit', subtype: 'downcut', vBitAngle: null,
    diameter: 0.25, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'spektra', maxRPM: null,
    notes: 'Amana Tool 48342-K SC Spektra Extreme Tool Life Coated Spiral Plunge 1/4 Dia x 2 CH x 1/4 SHK x 4 Inch Long Down-Cut Router Bit',
  },
];
