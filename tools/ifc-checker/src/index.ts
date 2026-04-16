import { parseIDS, IDSDocument } from './ids-parser';
import { checkSpecification, SpecificationResult } from './checker';

// ─── State ────────────────────────────────────────────────────────────────────

let api: any = null;
let ids: IDSDocument | null = null;
let results: Map<string, SpecificationResult> = new Map();
let activeTab: 'setup' | 'results' = 'setup';
let running = false;
let scope: 'all' | 'selected' = 'all';
let selectedGuids = new Set<string>();
let idsList: Array<{ id: string; name: string }> = [];

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function boot() {
  render();

  try {
    api = await (window as any).StreamBIM.connectToParent(window, {
      pickedObject: onPick,
    });
    log('Connected to StreamBIM', 'success');
    loadIDSList();
  } catch {
    log('Failed to connect to StreamBIM', 'error');
  }
}

function onPick(data: any) {
  if (scope !== 'selected') return;
  const guid: string | undefined = data?.guid;
  if (!guid) return;

  if (selectedGuids.has(guid)) {
    selectedGuids.delete(guid);
  } else {
    selectedGuids.add(guid);
  }

  log(`${selectedGuids.size} element(s) selected`, 'info');
  const counter = document.getElementById('sel-count');
  if (counter) counter.textContent = `${selectedGuids.size} selected`;
}

// ─── IDS Loading ──────────────────────────────────────────────────────────────

async function loadIDSList() {
  try {
    const res = await api.makeApiRequest({ url: '/files?type=ids' });
    idsList = (res?.files ?? []).map((f: any) => ({ id: f.id, name: f.name || f.id }));
  } catch {
    idsList = [];
  }
  renderSetupSection();
}

async function loadIDSFromServer(fileId: string) {
  log('Loading IDS file…', 'info');
  try {
    const raw = await api.makeApiRequest({ url: `/files/${fileId}/content` });
    const xml = typeof raw === 'string' ? raw : JSON.stringify(raw);
    ids = parseIDS(xml);
    results.clear();
    log(`Loaded: ${ids.title} — ${ids.specifications.length} spec(s)`, 'success');
    renderSetupSection();
  } catch (err) {
    log(`Failed to load IDS: ${(err as Error).message}`, 'error');
  }
}

function loadIDSFromFile(file: File) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      ids = parseIDS(e.target?.result as string);
      results.clear();
      log(`Loaded: ${ids.title} — ${ids.specifications.length} spec(s)`, 'success');
      renderSetupSection();
    } catch (err) {
      log(`Invalid IDS file: ${(err as Error).message}`, 'error');
    }
  };
  reader.readAsText(file);
}

// ─── Checks ───────────────────────────────────────────────────────────────────

async function runChecks() {
  if (!ids || !api || running) return;

  const enabled = getEnabledSpecs();
  if (enabled.length === 0) {
    log('No specifications selected', 'warn');
    return;
  }

  running = true;
  results.clear();
  setRunBtn(true);
  log(`Running ${enabled.length} specification(s)…`, 'info');

  let done = 0;
  for (const spec of enabled) {
    try {
      const result = await checkSpecification(spec, api);

      if (scope === 'selected' && selectedGuids.size > 0) {
        result.failedObjects = result.failedObjects.filter(o => selectedGuids.has(o.guid));
        result.passedObjects = result.passedObjects.filter(o => selectedGuids.has(o.guid));
        result.failedCount = result.failedObjects.length;
        result.passedCount = result.passedObjects.length;
        result.applicableCount = result.failedCount + result.passedCount;
      }

      results.set(spec.name, result);
    } catch (err) {
      console.error('Spec error:', err);
    }
    done++;
    log(`${done} / ${enabled.length} specifications checked…`, 'info');
  }

  running = false;
  setRunBtn(false);
  applyColorCoding();
  activeTab = 'results';
  render();
  log('Checks complete', 'success');
}

function getEnabledSpecs() {
  if (!ids) return [];
  return ids.specifications.filter((_, i) => {
    const cb = document.querySelector<HTMLInputElement>(`[data-spec="${i}"]`);
    return !cb || cb.checked;
  });
}

function setRunBtn(disabled: boolean) {
  const btn = document.getElementById('run-btn') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = disabled;
    btn.textContent = disabled ? 'Running…' : 'Run IDS Checks';
  }
}

// ─── 3D Color Coding ──────────────────────────────────────────────────────────

async function applyColorCoding() {
  if (!api) return;

  const colorMap: Record<string, string> = {};
  for (const r of results.values()) {
    for (const obj of r.passedObjects) colorMap[obj.guid] ??= '#4caf50';
    for (const obj of r.failedObjects) colorMap[obj.guid] = '#f44336'; // failures win
  }

  if (Object.keys(colorMap).length === 0) return;

  try {
    await api.colorCodeObjectsWithLegends({
      data: colorMap,
      legends: [
        { color: '#4caf50', label: 'Pass' },
        { color: '#f44336', label: 'Fail' },
      ],
    });
  } catch {
    try { await api.colorCodeObjects(colorMap); } catch { /* not supported */ }
  }
}

async function clearColorCoding() {
  if (!api) return;
  try { await api.colorCodeObjects({}); } catch { /* not supported */ }
}

// ─── Navigation ───────────────────────────────────────────────────────────────

async function gotoObject(guid: string) {
  if (!api) return;
  try {
    await api.deHighlightAllObjects();
    await api.gotoObject(guid);
    await api.highlightObject(guid);
  } catch { /* viewer not ready */ }
}

// ─── Export ───────────────────────────────────────────────────────────────────

function exportCSV() {
  const rows = ['Specification,Status,Applicable,Passed,Failed,GUID,Name,Failure Reasons'];

  for (const r of results.values()) {
    const spec = `"${r.specification.name.replace(/"/g, '""')}"`;

    if (r.failedObjects.length === 0 && r.passedObjects.length === 0) {
      rows.push(`${spec},${r.status},${r.applicableCount},${r.passedCount},${r.failedCount},,,`);
    }

    for (const obj of r.failedObjects) {
      const name    = `"${obj.name.replace(/"/g, '""')}"`;
      const reasons = `"${obj.failedRequirements.join('; ').replace(/"/g, '""')}"`;
      rows.push(`${spec},${r.status},${r.applicableCount},${r.passedCount},${r.failedCount},${obj.guid},${name},${reasons}`);
    }

    for (const obj of r.passedObjects) {
      const name = `"${obj.name.replace(/"/g, '""')}"`;
      rows.push(`${spec},${r.status},${r.applicableCount},${r.passedCount},${r.failedCount},${obj.guid},${name},`);
    }
  }

  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `ids-check-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function render() {
  const app = document.getElementById('app');
  if (!app) return;

  const totalFailed  = Array.from(results.values()).reduce((s, r) => s + r.failedCount, 0);
  const hasResults   = results.size > 0;
  const badgeClass   = totalFailed > 0 ? 'fail' : 'pass';
  const badgeText    = totalFailed > 0 ? `${totalFailed} failures` : 'All pass';

  app.innerHTML = `
    <div class="widget">
      <header>
        <h1>IFC Checker</h1>
        <div class="tabs">
          <button class="tab${activeTab === 'setup' ? ' active' : ''}" data-tab="setup">Setup</button>
          <button class="tab${activeTab === 'results' ? ' active' : ''}" data-tab="results">
            Results${hasResults ? `<span class="badge ${badgeClass}">${badgeText}</span>` : ''}
          </button>
        </div>
      </header>
      <main id="main-content">
        ${activeTab === 'setup' ? setupTabHTML() : resultsTabHTML()}
      </main>
      <footer id="status-bar" class="status-bar"></footer>
    </div>
  `;

  attachEvents();
}

function renderSetupSection() {
  if (activeTab !== 'setup') { render(); return; }
  const main = document.getElementById('main-content');
  if (main) { main.innerHTML = setupTabHTML(); attachEvents(); }
}

function setupTabHTML(): string {
  const fileOptions = idsList
    .map(f => `<option value="${f.id}">${escHtml(f.name)}</option>`)
    .join('');

  const specsHtml = ids
    ? ids.specifications.map((spec, i) => `
        <label class="spec-row">
          <input type="checkbox" data-spec="${i}" checked />
          <span class="spec-name">${escHtml(spec.name)}</span>
          <span class="spec-meta">${spec.requirements.length} req</span>
        </label>
        ${spec.description ? `<p class="spec-desc">${escHtml(spec.description)}</p>` : ''}
      `).join('')
    : '';

  const selBadge = scope === 'selected'
    ? `<span class="badge" id="sel-count">${selectedGuids.size} selected</span>`
    : '';

  return `
    <section>
      <h2>IDS Source</h2>
      ${idsList.length > 0 ? `
        <label for="ids-select">StreamBIM document</label>
        <select id="ids-select">
          <option value="">— choose an IDS file —</option>
          ${fileOptions}
        </select>
        <div class="divider">or</div>
      ` : ''}
      <label for="ids-file">Upload local IDS file</label>
      <input type="file" id="ids-file" accept=".ids,.xml" />
      ${ids ? `<p class="loaded">✓ ${escHtml(ids.title)} — ${ids.specifications.length} specification(s)</p>` : ''}
    </section>

    ${ids ? `
      <section>
        <h2>Specifications</h2>
        <div class="spec-list">${specsHtml}</div>
      </section>

      <section>
        <h2>Scope</h2>
        <div class="scope-toggle">
          <label class="scope-option">
            <input type="radio" name="scope" value="all" ${scope === 'all' ? 'checked' : ''} />
            All objects in model
          </label>
          <label class="scope-option">
            <input type="radio" name="scope" value="selected" ${scope === 'selected' ? 'checked' : ''} />
            Selected objects only ${selBadge}
          </label>
          ${scope === 'selected' ? `<button id="clear-sel" class="btn-text">Clear selection</button>` : ''}
        </div>
      </section>

      <div class="actions">
        <button id="run-btn" class="btn-primary" ${running ? 'disabled' : ''}>
          ${running ? 'Running…' : 'Run IDS Checks'}
        </button>
      </div>
    ` : ''}
  `;
}

function resultsTabHTML(): string {
  if (results.size === 0) {
    return `<p class="empty">Run checks on the Setup tab to see results here.</p>`;
  }

  const all            = Array.from(results.values());
  const totalApplicable = all.reduce((s, r) => s + r.applicableCount, 0);
  const totalPassed    = all.reduce((s, r) => s + r.passedCount, 0);
  const totalFailed    = all.reduce((s, r) => s + r.failedCount, 0);
  const passRate       = totalApplicable > 0
    ? Math.round((totalPassed / totalApplicable) * 100)
    : 0;

  const cards = all.map((r, i) => {
    const icon   = r.status === 'pass' ? '✓' : r.status === 'error' ? '⚠' : '✗';
    const cls    = r.status;
    const stats  = `${r.passedCount} ✓  ${r.failedCount} ✗`;

    const failedRows = r.failedObjects.map(obj => `
      <div class="obj-row fail" data-guid="${obj.guid}">
        <span class="obj-name">${escHtml(obj.name)}</span>
        <span class="obj-guid">${obj.guid.slice(0, 8)}…</span>
        <ul class="reasons">${obj.failedRequirements.map(rr => `<li>${escHtml(rr)}</li>`).join('')}</ul>
      </div>
    `).join('');

    const passedRows = r.passedObjects.map(obj => `
      <div class="obj-row pass" data-guid="${obj.guid}">
        <span class="obj-name">${escHtml(obj.name)}</span>
        <span class="obj-guid">${obj.guid.slice(0, 8)}…</span>
      </div>
    `).join('');

    return `
      <div class="result-card ${cls}">
        <div class="result-header" data-toggle="${i}">
          <span class="result-icon">${icon}</span>
          <span class="result-title">${escHtml(r.specification.name)}</span>
          <span class="result-stats">${stats}</span>
          <span class="chevron" id="chev-${i}">▶</span>
        </div>
        <div class="result-body" id="body-${i}" hidden>
          ${r.errorMessage ? `<p class="error-msg">${escHtml(r.errorMessage)}</p>` : ''}
          ${r.applicableCount === 0 ? '<p class="muted">No applicable objects found in model</p>' : ''}
          ${failedRows ? `<div class="obj-list"><h4>Failed (${r.failedCount})</h4>${failedRows}</div>` : ''}
          ${passedRows ? `
            <details class="passed-details">
              <summary>Passed (${r.passedCount})</summary>
              <div class="obj-list">${passedRows}</div>
            </details>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="summary">
      <div class="stat">
        <span class="stat-value">${all.length}</span>
        <span class="stat-label">Specs</span>
      </div>
      <div class="stat">
        <span class="stat-value">${totalApplicable}</span>
        <span class="stat-label">Objects</span>
      </div>
      <div class="stat ${totalFailed > 0 ? 'fail' : 'pass'}">
        <span class="stat-value">${totalFailed}</span>
        <span class="stat-label">Failures</span>
      </div>
      <div class="stat">
        <span class="stat-value">${passRate}%</span>
        <span class="stat-label">Pass rate</span>
      </div>
    </div>
    <div class="result-actions">
      <button id="export-btn" class="btn-secondary">Export CSV</button>
      <button id="clear-colors-btn" class="btn-text">Clear 3D colours</button>
    </div>
    <div class="result-list">${cards}</div>
  `;
}

function attachEvents() {
  // Tab switching
  document.querySelectorAll<HTMLElement>('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab as 'setup' | 'results';
      render();
    });
  });

  // IDS from StreamBIM
  document.getElementById('ids-select')?.addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    if (v) loadIDSFromServer(v);
  });

  // IDS from local file
  document.getElementById('ids-file')?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) loadIDSFromFile(file);
  });

  // Scope radios
  document.querySelectorAll<HTMLInputElement>('input[name="scope"]').forEach(radio => {
    radio.addEventListener('change', () => {
      scope = radio.value as 'all' | 'selected';
      if (scope === 'all') selectedGuids.clear();
      renderSetupSection();
    });
  });

  // Clear selection
  document.getElementById('clear-sel')?.addEventListener('click', () => {
    selectedGuids.clear();
    renderSetupSection();
  });

  // Run checks
  document.getElementById('run-btn')?.addEventListener('click', runChecks);

  // Export
  document.getElementById('export-btn')?.addEventListener('click', exportCSV);

  // Clear 3D colours
  document.getElementById('clear-colors-btn')?.addEventListener('click', clearColorCoding);

  // Result card expand/collapse
  document.querySelectorAll<HTMLElement>('[data-toggle]').forEach(header => {
    header.addEventListener('click', () => {
      const idx  = header.dataset.toggle;
      const body = document.getElementById(`body-${idx}`);
      const chev = document.getElementById(`chev-${idx}`);
      if (body) {
        const isHidden = body.toggleAttribute('hidden');
        if (chev) chev.textContent = isHidden ? '▶' : '▼';
      }
    });
  });

  // Object click → navigate in 3D
  document.querySelectorAll<HTMLElement>('[data-guid]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const guid = el.dataset.guid;
      if (guid) gotoObject(guid);
    });
  });
}

// ─── Status bar ───────────────────────────────────────────────────────────────

let statusTimer: ReturnType<typeof setTimeout> | null = null;

function log(msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  console[type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'log'](`[IFC Checker] ${msg}`);

  const bar = document.getElementById('status-bar');
  if (!bar) return;

  if (statusTimer) clearTimeout(statusTimer);
  bar.textContent = msg;
  bar.className   = `status-bar ${type}`;

  if (type === 'success' || type === 'info') {
    statusTimer = setTimeout(() => {
      const b = document.getElementById('status-bar');
      if (b) { b.textContent = ''; b.className = 'status-bar'; }
    }, 5000);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
