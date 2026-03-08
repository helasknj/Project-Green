import { useState, useEffect, useCallback } from "react";
import sampleData from "./inventory.json";

// ───────────────────────────────────────── Utility helpers ────────────────────────────────────────────────────────

const CATEGORIES = ["All", "Produce", "Dairy", "Beverages", "Supplies", "Equipment", "Chemicals", "Donations"];
const CATEGORY_COLORS = {
  Produce: "#4caf50",
  Dairy: "#81c784",
  Beverages: "#a5d6a7",
  Supplies: "#ff8f00",
  Equipment: "#1976d2",
  Chemicals: "#7b1fa2",
  Donations: "#e91e63",
  Default: "#607d8b",
};

function daysUntilEmpty(item) {
  if (!item.dailyUsage || item.dailyUsage <= 0) return null;
  return Math.max(0, Math.floor(item.quantity / item.dailyUsage));
}

function ruleBasedForecast(item) {
  const days = daysUntilEmpty(item);
  if (days === null) return "No usage data available. Set a daily usage rate to enable predictions.";
  if (days === 0) return `⚠️ ${item.name} is depleted! Reorder immediately.`;
  if (days <= 3) return `🔴 Critical: ${item.name} will run out in ${days} day${days === 1 ? "" : "s"}. Reorder now.`;
  if (days <= 7) return `🟠 Low stock: ${item.name} will last ~${days} days. Consider reordering soon.`;
  if (days <= 14) return `🟡 ${item.name} has ~${days} days of stock remaining.`;
  return `🟢 ${item.name} is well stocked — estimated ${days} days of supply remaining.`;
}

function sustainabilityScore(items) {
  let score = 0;
  let wasteRisk = 0;
  items.forEach((item) => {
    const days = daysUntilEmpty(item);
    if (item.expiryDays && days && days > item.expiryDays) wasteRisk += 1;
    if (item.isEcoFriendly) score += 10;
    if (item.isLocal) score += 8;
    if (item.isRefurbished) score += 6;
  });
  const base = Math.max(0, 60 - wasteRisk * 5);
  return Math.min(100, base + score);
}

function carbonSaved(items) {
  return items.reduce((acc, item) => {
    if (item.isLocal) acc += item.quantity * 0.02;
    if (item.isEcoFriendly) acc += item.quantity * 0.05;
    return acc;
  }, 0).toFixed(1);
}

// ─────────────────────────────────────────────── AI Integration ──────────────────────────────────────────────────────────

async function fetchAIForecast(item, apiKey) {
  const prompt = `You are a sustainability-focused inventory assistant. Given this inventory item, provide a brief 1-2 sentence forecast about reorder timing and suggest a sustainable procurement tip.

Item: ${item.name}
Category: ${item.category}
Current Quantity: ${item.quantity} ${item.unit}
Daily Usage Rate: ${item.dailyUsage} ${item.unit}/day
Days Until Empty: ${daysUntilEmpty(item) ?? "unknown"}
Expiry in Days: ${item.expiryDays ?? "N/A"}
Is Local: ${item.isLocal ? "Yes" : "No"}
Is Eco-Friendly: ${item.isEcoFriendly ? "Yes" : "No"}

Respond with a practical, actionable insight in 2 sentences max. Be specific about timing and include one sustainability suggestion.`;

  const response = await fetch("http://localhost:3001/api/forecast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, apiKey }),
  });

  if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.text;
}

// ───────────────────────────────────────── Components ──────────────────────────────────────────────────────────────

function StatusBadge({ days }) { //color coding item status badge
  if (days === null) return <span className="badge badge-grey">No usage data</span>;
  if (days === 0) return <span className="badge badge-red">Depleted</span>;
  if (days <= 3) return <span className="badge badge-red">Critical</span>;
  if (days <= 7) return <span className="badge badge-orange">Low</span>;
  if (days <= 14) return <span className="badge badge-yellow">Watch</span>;
  return <span className="badge badge-green">Good</span>;
}

function ItemModal({ item, onClose, onSave, apiKey }) {
  const [form, setForm] = useState(
    item || {
      id: Date.now(),
      name: "",
      category: "Supplies",
      quantity: "",
      unit: "units",
      dailyUsage: "",
      expiryDays: "",
      isEcoFriendly: false,
      isLocal: false,
      isRefurbished: false,
      supplier: "",
    }
  );
  const [errors, setErrors] = useState({});
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);

  function validate() { //ensures information is entered properly when creating/edting item
    const e = {};
    if (!form.name.trim()) e.name = "Name is required.";
    if (form.quantity === "" || isNaN(form.quantity) || Number(form.quantity) < 0)
      e.quantity = "Quantity must be a non-negative number.";
    if (form.dailyUsage !== "" && (isNaN(form.dailyUsage) || Number(form.dailyUsage) < 0))
      e.dailyUsage = "Daily usage must be a non-negative number.";
    return e;
  }

  function handleSubmit() { 
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave({ ...form, quantity: Number(form.quantity), dailyUsage: Number(form.dailyUsage) || 0, expiryDays: form.expiryDays ? Number(form.expiryDays) : null });
    onClose();
  }

  async function getAIForecast() { // generating AI forecast
    if (!apiKey) { setAiFailed(true); setAiInsight(ruleBasedForecast(form)); return; }
    setAiLoading(true);
    setAiFailed(false);
    try {
      const insight = await fetchAIForecast({ ...form, quantity: Number(form.quantity), dailyUsage: Number(form.dailyUsage) }, apiKey);
      setAiInsight(insight);
    } catch { // if LLM API call fails, use rule-based fallback forecast instead
      setAiFailed(true);
      setAiInsight(ruleBasedForecast({ ...form, quantity: Number(form.quantity), dailyUsage: Number(form.dailyUsage) }));
    } finally {
      setAiLoading(false);
    }
  }

  const f = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{item ? "Edit Item" : "Add New Item"}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Item Name *</label>
              <input value={form.name} onChange={f("name")} placeholder="e.g. Oat Milk" />
              {errors.name && <span className="error">{errors.name}</span>}
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={f("category")}>
                {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity *</label>
              <input type="number" value={form.quantity} onChange={f("quantity")} placeholder="0" min="0" />
              {errors.quantity && <span className="error">{errors.quantity}</span>}
            </div>
            <div className="form-group">
              <label>Unit</label>
              <input value={form.unit} onChange={f("unit")} placeholder="kg, liters, units…" />
            </div>
            <div className="form-group">
              <label>Daily Usage Rate</label>
              <input type="number" value={form.dailyUsage} onChange={f("dailyUsage")} placeholder="0" min="0" step="0.1" />
              {errors.dailyUsage && <span className="error">{errors.dailyUsage}</span>}
            </div>
            <div className="form-group">
              <label>Expiry (days from now)</label>
              <input type="number" value={form.expiryDays} onChange={f("expiryDays")} placeholder="optional" min="0" />
            </div>
            <div className="form-group">
              <label>Supplier</label>
              <input value={form.supplier} onChange={f("supplier")} placeholder="optional" />
            </div>
          </div>

          <div className="eco-flags">
            <label><input type="checkbox" checked={form.isEcoFriendly} onChange={f("isEcoFriendly")} /> 🌿 Eco-Friendly</label>
            <label><input type="checkbox" checked={form.isLocal} onChange={f("isLocal")} /> 📍 Local Supplier</label>
            <label><input type="checkbox" checked={form.isRefurbished} onChange={f("isRefurbished")} /> ♻️ Refurbished</label>
          </div>

          <div className="ai-section">
            <button className="ai-btn" onClick={getAIForecast} disabled={aiLoading || !form.quantity || !form.dailyUsage}>
              {aiLoading ? "Analyzing…" : "Get AI Forecast"}
            </button>
            {aiFailed && <span className="fallback-note">⚡ Using rule-based fallback</span>}
            {aiInsight && <div className="ai-insight">{aiInsight}</div>}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit}>Save Item</button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ items }) {
  const score = sustainabilityScore(items);
  const carbon = carbonSaved(items);
  const criticalItems = items.filter((i) => { const d = daysUntilEmpty(i); return d !== null && d <= 7; });
  const wasteRiskItems = items.filter((i) => { const d = daysUntilEmpty(i); return i.expiryDays && d && d > i.expiryDays; });

  return (
    <div className="dashboard">
      <div className="stat-card eco-card">
        <div className="stat-icon">🌍</div>
        <div className="stat-content">
          <div className="stat-value">{score}/100</div>
          <div className="stat-label">Sustainability Score</div>
          <div className="score-bar"><div className="score-fill" style={{ width: `${score}%`, background: score > 70 ? "#4caf50" : score > 40 ? "#ff9800" : "#f44336" }} /></div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">💨</div>
        <div className="stat-content">
          <div className="stat-value">{carbon} kg</div>
          <div className="stat-label">CO₂ Saved (est.)</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">⚠️</div>
        <div className="stat-content">
          <div className="stat-value">{criticalItems.length}</div>
          <div className="stat-label">Critical / Low Items</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">🗑️</div>
        <div className="stat-content">
          <div className="stat-value">{wasteRiskItems.length}</div>
          <div className="stat-label">Waste Risk Items</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [items, setItems] = useState(sampleData);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [modalItem, setModalItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem("eco_api_key") || "");
  const [showApiInput, setShowApiInput] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState("");

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function saveApiKey(key) { //saving the inputted API key
    setApiKey(key);
    localStorage.setItem("eco_api_key", key);
    setShowApiInput(false);
    showToast("API key saved!");
  }

  function handleSave(item) { //handles savaing and updating items
    setItems((prev) => prev.find((i) => i.id === item.id) ? prev.map((i) => i.id === item.id ? item : i) : [...prev, item]);
    showToast(modalItem ? "Item updated!" : "Item added!");
  }

  function handleDelete(id) { //handles deleting item
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDeleteConfirm(null);
    showToast("Item deleted.");
  }

  const filtered = items.filter((i) => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || (i.supplier || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "All" || i.category === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="app">
      <style>{CSS}</style>

      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">🌿</div>
          <div>
            <h1>GreenStock</h1>
            <p className="subtitle">Intelligent Inventory Assistant</p>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-ghost" onClick={() => setShowApiInput((v) => !v)}>🔑 API Key</button>
          <button className="btn-primary" onClick={() => { setModalItem(null); setModalOpen(true); }}>+ Add Item</button>
        </div>
      </header>

      {/* API Key Panel */}
      {showApiInput && (
        <div className="api-panel">
          <span>Anthropic API Key (for AI forecasts):</span>
          <input
            type="password"
            defaultValue={apiKey}
            placeholder="sk-ant-..."
            id="api-key-input"
            style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #c8e6c9", fontFamily: "monospace" }}
          />
          <button className="btn-primary" onClick={() => saveApiKey(document.getElementById("api-key-input").value)}>Save</button>
          <button className="btn-ghost" onClick={() => setShowApiInput(false)}>Cancel</button>
        </div>
      )}

      <main className="main">
        {/* Dashboard */}
        <Dashboard items={items} />

        {/* Controls */}
        <div className="controls">
          <input className="search-input" placeholder="🔍 Search items or suppliers…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="category-filters">
            {CATEGORIES.map((c) => (
              <button key={c} className={`filter-btn ${categoryFilter === c ? "active" : ""}`} onClick={() => setCategoryFilter(c)}>{c}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="table-wrap">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 48 }}>🌱</div>
              <p>No items found. Try a different search or add a new item.</p>
            </div>
          ) : (
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Daily Usage</th>
                  <th>Days Left</th>
                  <th>Status</th>
                  <th>Eco Flags</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const days = daysUntilEmpty(item);
                  const isExpiring = item.expiryDays && days && days > item.expiryDays;
                  return (
                    <tr key={item.id} className={isExpiring ? "waste-risk" : ""}>
                      <td>
                        <div className="item-name">{item.name}</div>
                        {item.supplier && <div className="item-supplier">{item.supplier}</div>}
                        {isExpiring && <div className="waste-tag">⚠️ Waste risk</div>}
                      </td>
                      <td>
                        <span className="cat-pill" style={{ background: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Default }}>
                          {item.category}
                        </span>
                      </td>
                      <td>{item.quantity} {item.unit}</td>
                      <td>{item.dailyUsage ? `${item.dailyUsage} ${item.unit}/day` : "—"}</td>
                      <td>{days !== null ? `${days}d` : "—"}</td>
                      <td><StatusBadge days={days} /></td>
                      <td className="eco-flags-cell">
                        {item.isEcoFriendly && <span title="Eco-Friendly">🌿</span>}
                        {item.isLocal && <span title="Local Supplier">📍</span>}
                        {item.isRefurbished && <span title="Refurbished">♻️</span>}
                      </td>
                      <td>
                        <button className="action-btn" onClick={() => { setModalItem(item); setModalOpen(true); }}>✏️</button>
                        <button className="action-btn delete-btn" onClick={() => setDeleteConfirm(item.id)}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="table-footer">{filtered.length} of {items.length} items shown</div>
      </main>

      {/* Modals */}
      {modalOpen && (
        <ItemModal
          item={modalItem}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          apiKey={apiKey}
        />
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Item?</h3>
            <p>This action cannot be undone.</p>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────── CSS ─────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #f1f8f2;
    color: #1b3a1f;
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
  }

  .app { min-height: 100vh; }

  /* Header */
  .header {
    background: linear-gradient(135deg, #1b3a1f 0%, #2e5e35 60%, #3d7a47 100%);
    color: white;
    padding: 16px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 2px 16px rgba(27,58,31,0.18);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .header-left { display: flex; align-items: center; gap: 14px; }
  .logo { font-size: 36px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
  .header h1 { font-family: 'Playfair Display', serif; font-size: 26px; letter-spacing: -0.5px; }
  .subtitle { font-size: 12px; opacity: 0.7; margin-top: 2px; letter-spacing: 0.5px; }
  .header-right { display: flex; gap: 10px; align-items: center; }

  /* API Panel */
  .api-panel {
    background: #e8f5e9;
    border-bottom: 1px solid #c8e6c9;
    padding: 10px 32px;
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 13px;
    color: #2e5e35;
  }

  /* Buttons */
  .btn-primary {
    background: #2e7d32;
    color: white;
    border: none;
    padding: 9px 18px;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-primary:hover { background: #1b5e20; transform: translateY(-1px); }
  .btn-secondary {
    background: #f1f8f2;
    color: #2e5e35;
    border: 1.5px solid #a5d6a7;
    padding: 9px 18px;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-secondary:hover { background: #c8e6c9; }
  .btn-ghost {
    background: rgba(255,255,255,0.12);
    color: white;
    border: 1px solid rgba(255,255,255,0.25);
    padding: 8px 16px;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-ghost:hover { background: rgba(255,255,255,0.2); }
  .btn-danger {
    background: #c62828;
    color: white;
    border: none;
    padding: 9px 18px;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
  }
  .btn-danger:hover { background: #b71c1c; }

  /* Main */
  .main { max-width: 1200px; margin: 0 auto; padding: 28px 24px; }

  /* Dashboard */
  .dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 28px;
  }
  .stat-card {
    background: white;
    border-radius: 14px;
    padding: 20px;
    display: flex;
    gap: 14px;
    align-items: center;
    box-shadow: 0 2px 10px rgba(46,94,53,0.07);
    border: 1px solid #e8f5e9;
    transition: box-shadow 0.2s;
  }
  .stat-card:hover { box-shadow: 0 4px 20px rgba(46,94,53,0.12); }
  .eco-card { border-left: 4px solid #4caf50; }
  .stat-icon { font-size: 28px; }
  .stat-value { font-family: 'Playfair Display', serif; font-size: 26px; color: #1b3a1f; line-height: 1; }
  .stat-label { font-size: 12px; color: #6a9b70; margin-top: 3px; font-weight: 500; }
  .score-bar { height: 5px; background: #e8f5e9; border-radius: 99px; margin-top: 8px; overflow: hidden; }
  .score-fill { height: 100%; border-radius: 99px; transition: width 0.6s ease; }

  /* Controls */
  .controls { margin-bottom: 16px; display: flex; flex-direction: column; gap: 12px; }
  .search-input {
    width: 100%;
    padding: 11px 16px;
    border: 1.5px solid #c8e6c9;
    border-radius: 10px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    background: white;
    color: #1b3a1f;
    outline: none;
    transition: border-color 0.15s;
  }
  .search-input:focus { border-color: #4caf50; box-shadow: 0 0 0 3px rgba(76,175,80,0.12); }
  .category-filters { display: flex; gap: 8px; flex-wrap: wrap; }
  .filter-btn {
    padding: 6px 14px;
    border-radius: 99px;
    border: 1.5px solid #c8e6c9;
    background: white;
    font-size: 12px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    cursor: pointer;
    color: #2e5e35;
    transition: all 0.15s;
  }
  .filter-btn:hover { background: #e8f5e9; }
  .filter-btn.active { background: #2e7d32; color: white; border-color: #2e7d32; }

  /* Table */
  .table-wrap {
    background: white;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(46,94,53,0.07);
    border: 1px solid #e8f5e9;
  }
  .inventory-table { width: 100%; border-collapse: collapse; }
  .inventory-table th {
    background: #f1f8f2;
    padding: 12px 14px;
    text-align: left;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #5a8a60;
    font-weight: 600;
    border-bottom: 1px solid #e8f5e9;
  }
  .inventory-table td {
    padding: 12px 14px;
    font-size: 13px;
    border-bottom: 1px solid #f5faf5;
    vertical-align: middle;
  }
  .inventory-table tr:last-child td { border-bottom: none; }
  .inventory-table tr:hover td { background: #f9fdf9; }
  .waste-risk td { background: #fff8e1 !important; }
  .waste-risk:hover td { background: #fff3cd !important; }

  .item-name { font-weight: 600; color: #1b3a1f; }
  .item-supplier { font-size: 11px; color: #8a9e8c; margin-top: 2px; }
  .waste-tag { font-size: 10px; color: #f57f17; margin-top: 2px; font-weight: 600; }

  .cat-pill {
    display: inline-block;
    padding: 3px 9px;
    border-radius: 99px;
    color: white;
    font-size: 11px;
    font-weight: 600;
  }

  .badge {
    display: inline-block;
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  .badge-green { background: #e8f5e9; color: #2e7d32; }
  .badge-yellow { background: #fffde7; color: #f57f17; }
  .badge-orange { background: #fff3e0; color: #e65100; }
  .badge-red { background: #ffebee; color: #c62828; }
  .badge-grey { background: #f5f5f5; color: #757575; }

  .eco-flags-cell { font-size: 16px; letter-spacing: 2px; }
  .action-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 15px;
    padding: 4px 6px;
    border-radius: 6px;
    transition: background 0.15s;
  }
  .action-btn:hover { background: #e8f5e9; }
  .delete-btn:hover { background: #ffebee; }

  .table-footer { text-align: right; font-size: 12px; color: #8a9e8c; padding: 10px 4px 0; }

  .empty-state { text-align: center; padding: 60px 20px; color: #8a9e8c; }
  .empty-state p { margin-top: 12px; font-size: 14px; }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(27,58,31,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    backdrop-filter: blur(2px);
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  .modal {
    background: white;
    border-radius: 16px;
    width: 90%;
    max-width: 560px;
    box-shadow: 0 20px 60px rgba(27,58,31,0.2);
    animation: slideUp 0.2s ease;
    max-height: 90vh;
    overflow-y: auto;
  }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: none; opacity: 1 } }
  .confirm-modal { max-width: 360px; padding: 28px; text-align: center; }
  .confirm-modal h3 { font-family: 'Playfair Display', serif; font-size: 22px; margin-bottom: 8px; }
  .confirm-modal p { color: #8a9e8c; font-size: 14px; margin-bottom: 20px; }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 22px 24px 16px;
    border-bottom: 1px solid #e8f5e9;
  }
  .modal-header h2 { font-family: 'Playfair Display', serif; font-size: 22px; color: #1b3a1f; }
  .close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: #8a9e8c; transition: color 0.15s; }
  .close-btn:hover { color: #1b3a1f; }
  .modal-body { padding: 20px 24px; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid #e8f5e9; }

  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
  .form-group { display: flex; flex-direction: column; gap: 5px; }
  .form-group label { font-size: 12px; font-weight: 600; color: #5a8a60; text-transform: uppercase; letter-spacing: 0.5px; }
  .form-group input, .form-group select {
    padding: 9px 12px;
    border: 1.5px solid #c8e6c9;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #1b3a1f;
    background: white;
    outline: none;
    transition: border-color 0.15s;
  }
  .form-group input:focus, .form-group select:focus { border-color: #4caf50; }
  .error { font-size: 11px; color: #c62828; }

  .eco-flags { display: flex; gap: 20px; margin-bottom: 16px; flex-wrap: wrap; }
  .eco-flags label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #2e5e35; cursor: pointer; font-weight: 500; }
  .eco-flags input { accent-color: #4caf50; }

  .ai-section { background: #f1f8f2; border-radius: 10px; padding: 14px; }
  .ai-btn {
    background: linear-gradient(135deg, #2e7d32, #4caf50);
    color: white;
    border: none;
    padding: 9px 16px;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .ai-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .ai-btn:not(:disabled):hover { opacity: 0.85; }
  .fallback-note { font-size: 11px; color: #f57f17; margin-left: 10px; font-style: italic; }
  .ai-insight { margin-top: 12px; font-size: 13px; color: #1b3a1f; line-height: 1.55; background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #4caf50; }

  /* Toast */
  .toast {
    position: fixed;
    bottom: 28px;
    right: 28px;
    background: #1b3a1f;
    color: white;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    animation: slideUp 0.2s ease;
    z-index: 999;
  }

  @media (max-width: 640px) {
    .header { padding: 14px 16px; }
    .main { padding: 16px; }
    .form-grid { grid-template-columns: 1fr; }
    .dashboard { grid-template-columns: 1fr 1fr; }
    .inventory-table th:nth-child(4), .inventory-table td:nth-child(4),
    .inventory-table th:nth-child(7), .inventory-table td:nth-child(7) { display: none; }
  }
`;
