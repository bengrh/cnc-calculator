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
    notes: '46282-K · O-Flute upcut spiral · 1" flute length · 2.185" OAL',
  },
  {
    name: 'Amana 46286-K — 1/8" Upcut Spiral',
    type: 'router_bit', subtype: 'upcut', vBitAngle: null,
    diameter: 0.125, diameterUnit: 'in', flutes: 3,
    material: 'carbide', coating: 'spektra', maxRPM: null,
    notes: '46286-K · Upcut spiral · 1" flute length · 1.713" OAL',
  },
  {
    name: 'Amana 46202-K — 1/4" Downcut Flat',
    type: 'router_bit', subtype: 'downcut', vBitAngle: null,
    diameter: 0.25, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'spektra', maxRPM: null,
    notes: '46202-K · Downcut spiral flat end · 0.75" flute length · 1.811" OAL',
  },
  {
    name: 'Amana 46476-K — 1/4" Downcut Ball',
    type: 'end_mill', subtype: 'ball', vBitAngle: null,
    diameter: 0.25, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'spektra', maxRPM: null,
    notes: '46476-K · Downcut ball nose · 1" flute length · 1.713" OAL',
  },
  {
    name: 'Amana 46477 — 1/2" Downcut Ball',
    type: 'end_mill', subtype: 'ball', vBitAngle: null,
    diameter: 0.5, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'uncoated', maxRPM: null,
    notes: '46477 · Downcut ball nose · 1.25" flute length · 1.929" OAL',
  },
  {
    name: 'Amana 46034-K — 1/2" Compression',
    type: 'router_bit', subtype: 'compression', vBitAngle: null,
    diameter: 0.5, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'spektra', maxRPM: null,
    notes: '46034-K · Compression spiral flat end · 1" flute length · 2.008" OAL',
  },
  {
    name: 'Amana 46226 — 1/2" Upcut Rougher',
    type: 'router_bit', subtype: 'upcut', vBitAngle: null,
    diameter: 0.5, diameterUnit: 'in', flutes: 3,
    material: 'carbide', coating: 'uncoated', maxRPM: null,
    notes: '46226 · Upcut spiral roughing end mill · 2" flute length · 3.346" OAL',
  },
  {
    name: 'Amana 46387 — 3/4" Upcut Ball',
    type: 'end_mill', subtype: 'ball', vBitAngle: null,
    diameter: 0.75, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'uncoated', maxRPM: null,
    notes: '46387 · Upcut ball nose · 2.5" flute length · 3.819" OAL',
  },
  {
    name: 'Amana 45944 — (verify specs)',
    type: 'router_bit', subtype: 'upcut', vBitAngle: null,
    diameter: 0.25, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'uncoated', maxRPM: null,
    notes: '45944 · Not present in VKB file — verify specs at amanatool.com and update this entry',
  },
  {
    name: 'Amana 46360 — 1/2" Compression (Long)',
    type: 'router_bit', subtype: 'compression', vBitAngle: null,
    diameter: 0.5, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'uncoated', maxRPM: null,
    notes: '46360 · Compression spiral flat end · 2.126" flute length · 3.386" OAL (longer reach than 46034-K)',
  },
  {
    name: 'Amana 46294-K — 1/4" Upcut Ball',
    type: 'end_mill', subtype: 'ball', vBitAngle: null,
    diameter: 0.25, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'spektra', maxRPM: null,
    notes: '46294-K · Upcut ball nose · 1.25" flute length · 2.067" OAL',
  },
  {
    name: 'Amana RC-2255 — 2" Fly Cutter',
    type: 'router_bit', subtype: 'upcut', vBitAngle: null,
    diameter: 2.0, diameterUnit: 'in', flutes: 3,
    material: 'carbide', coating: 'uncoated', maxRPM: null,
    notes: 'RC-2255 · Fly cutter / surfacing insert bit · 3-insert · 2" cutting dia · 0.25" depth capacity',
  },
  {
    name: 'Amana 48342-K — 1/4" Downcut Flat (Long)',
    type: 'router_bit', subtype: 'downcut', vBitAngle: null,
    diameter: 0.25, diameterUnit: 'in', flutes: 2,
    material: 'carbide', coating: 'spektra', maxRPM: null,
    notes: '48342-K · Downcut spiral flat end · 2" flute length · 2.835" OAL (longer reach than 46202-K)',
  },
];
