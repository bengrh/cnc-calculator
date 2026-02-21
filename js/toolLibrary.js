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
};
