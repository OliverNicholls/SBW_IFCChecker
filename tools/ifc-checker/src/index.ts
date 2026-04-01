/**
 * IFC Checker Widget for StreamBIM
 * Loads IDS files and validates IFC model compliance
 */

import { parseIDS, IDSDocument } from './ids-parser';
import { checkSpecification, SpecificationResult } from './checker';

// Global state
let streamBIM: any = null;
let idsDocument: IDSDocument | null = null;
let checkResults: Map<string, SpecificationResult> = new Map();
let isChecking = false;
let idsUrl = '';

// UI element references
let root: HTMLElement | null = null;
let statusDiv: HTMLElement | null = null;
let resultsDiv: HTMLElement | null = null;

/**
 * Entry point
 */
async function init() {
  root = document.getElementById('app');
  if (!root) {
    console.error('Root element #app not found');
    return;
  }

  renderUI();

  try {
    streamBIM = await (window as any).StreamBIM.connectToParent(window, {
      pickedObject: handlePickedObject,
      spacesChanged: () => {},
      cameraChanged: () => {},
    });

    const projectId = await streamBIM.getProjectId();
    console.log('Connected to StreamBIM, project:', projectId);
    updateStatus('Connected to StreamBIM', 'success');
  } catch (err) {
    console.error('Failed to connect to StreamBIM:', err);
    updateStatus('Failed to connect to StreamBIM', 'error');
  }
}

/**
 * Render initial UI
 */
function renderUI() {
  if (!root) return;

  root.innerHTML = `
    <div class="widget-container">
      <h1>IFC Checker</h1>

      <div class="section">
        <h2>IDS File Configuration</h2>
        <div class="input-group">
          <label for="idsUrlInput">IDS File URL:</label>
          <input
            type="text"
            id="idsUrlInput"
            placeholder="https://example.com/requirements.ids"
            class="input-field"
          />
          <button id="loadIdsBtn" class="btn btn-primary">Load IDS File</button>
        </div>
      </div>

      <div class="section">
        <h2>Specifications</h2>
        <div id="specsContainer" class="specs-container">
          <p class="empty-state">Load an IDS file to see specifications</p>
        </div>
      </div>

      <div class="section">
        <div class="button-group">
          <button id="runChecksBtn" class="btn btn-primary" disabled>Run Checks</button>
          <button id="visualiseBtn" class="btn btn-success" disabled>Visualise Results</button>
          <button id="clearBtn" class="btn btn-secondary">Clear All</button>
        </div>
      </div>

      <div class="section">
        <h2>Results</h2>
        <div id="results" class="results-container">
          <p class="empty-state">Run checks to see results</p>
        </div>
      </div>

      <div id="status" class="status"></div>
    </div>
  `;

  root.querySelector('#loadIdsBtn')?.addEventListener('click', loadIDS);
  root.querySelector('#runChecksBtn')?.addEventListener('click', runChecks);
  root.querySelector('#visualiseBtn')?.addEventListener('click', visualiseResults);
  root.querySelector('#clearBtn')?.addEventListener('click', clearAll);

  statusDiv = document.getElementById('status');
  resultsDiv = document.getElementById('results');
}

/**
 * Load IDS file from URL
 */
async function loadIDS() {
  const input = document.getElementById('idsUrlInput') as HTMLInputElement;
  const url = input?.value?.trim();

  if (!url) {
    updateStatus('Please enter an IDS file URL', 'error');
    return;
  }

  idsUrl = url;
  updateStatus('Loading IDS file...', 'info');

  try {
    let idsContent: string;

    // Try to fetch via StreamBIM API first (for authenticated access to StreamBIM documents)
    if (url.includes('/pgw/')) {
      try {
        const response = await streamBIM.makeApiRequest({
          url,
          method: 'GET',
          accept: 'application/xml',
        });
        idsContent = typeof response === 'string' ? response : JSON.stringify(response);
      } catch (err) {
        console.warn('Failed to fetch via StreamBIM API, trying direct fetch:', err);
        const resp = await fetch(url);
        idsContent = await resp.text();
      }
    } else {
      // Direct fetch for external URLs (CORS may apply)
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      idsContent = await resp.text();
    }

    idsDocument = parseIDS(idsContent);

    // Update UI
    updateSpecsUI();
    updateStatus(`Loaded IDS: ${idsDocument.title} (${idsDocument.specifications.length} specifications)`, 'success');

    // Enable Run Checks button
    const runBtn = document.getElementById('runChecksBtn') as HTMLButtonElement;
    if (runBtn) runBtn.disabled = false;
  } catch (err) {
    console.error('Failed to load IDS:', err);
    updateStatus(`Failed to load IDS: ${(err as Error).message}`, 'error');
  }
}

/**
 * Update specs list in UI
 */
function updateSpecsUI() {
  const container = document.getElementById('specsContainer');
  if (!container || !idsDocument) return;

  container.innerHTML = idsDocument.specifications
    .map((spec, idx) => `
      <div class="spec-item">
        <label class="spec-checkbox">
          <input type="checkbox" data-spec-idx="${idx}" checked />
          <span class="spec-name">${spec.name}</span>
          <span class="spec-count">${spec.applicability.length} applicability, ${spec.requirements.length} requirements</span>
        </label>
        ${spec.description ? `<p class="spec-description">${spec.description}</p>` : ''}
      </div>
    `)
    .join('');
}

/**
 * Run checks on selected specifications
 */
async function runChecks() {
  if (!idsDocument || !streamBIM) return;

  isChecking = true;
  checkResults.clear();

  const runBtn = document.getElementById('runChecksBtn') as HTMLButtonElement;
  const visBtn = document.getElementById('visualiseBtn') as HTMLButtonElement;
  if (runBtn) runBtn.disabled = true;
  if (visBtn) visBtn.disabled = true;

  // Get selected specs
  const checkboxes = document.querySelectorAll('input[data-spec-idx]:checked') as NodeListOf<HTMLInputElement>;
  const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.getAttribute('data-spec-idx') || '-1', 10));

  updateStatus(`Running ${selectedIndices.length} specification(s)...`, 'info');

  let completed = 0;
  for (const idx of selectedIndices) {
    const spec = idsDocument.specifications[idx];
    if (!spec) continue;

    try {
      const result = await checkSpecification(spec, streamBIM);
      checkResults.set(spec.name, result);
      completed++;
      updateStatus(`Progress: ${completed}/${selectedIndices.length}`, 'info');
    } catch (err) {
      console.error(`Error checking specification '${spec.name}':`, err);
    }
  }

  isChecking = false;
  updateResultsUI();
  updateStatus(`Completed ${completed} specification checks`, 'success');

  if (runBtn) runBtn.disabled = false;
  if (checkResults.size > 0 && visBtn) visBtn.disabled = false;
}

/**
 * Update results display
 */
function updateResultsUI() {
  if (!resultsDiv) return;

  if (checkResults.size === 0) {
    resultsDiv.innerHTML = '<p class="empty-state">No results to display</p>';
    return;
  }

  const results = Array.from(checkResults.values());
  const html = results
    .map((result, idx) => {
      const statusClass = result.status === 'pass' ? 'status-pass' : result.status === 'error' ? 'status-error' : 'status-fail';
      const statusIcon = result.status === 'pass' ? '✓' : result.status === 'error' ? '⚠' : '✗';

      return `
        <div class="result-card ${statusClass}">
          <div class="result-header" onclick="document.getElementById('result-body-${idx}').toggleAttribute('hidden')">
            <span class="result-status">${statusIcon}</span>
            <span class="result-name">${result.specification.name}</span>
            <span class="result-counts">Pass: ${result.passedCount} | Fail: ${result.failedCount}</span>
          </div>
          <div class="result-body" id="result-body-${idx}" hidden>
            ${result.errorMessage ? `<p class="error-message">${result.errorMessage}</p>` : ''}
            ${result.applicableCount > 0 ? `<p>Applicable objects: ${result.applicableCount}</p>` : ''}
            ${result.failedObjects.length > 0 ? `
              <div class="failed-objects">
                <h4>Failed Objects:</h4>
                <ul>
                  ${result.failedObjects
                    .map(
                      obj => `
                    <li class="failed-object">
                      <span class="guid" onclick="window.highlightGUID('${obj.guid}', event)">${obj.guid.substring(0, 8)}...</span>
                      <span class="name">${obj.name}</span>
                      <div class="failure-reasons">
                        ${obj.failedRequirements.map(r => `<span class="reason">${r}</span>`).join('')}
                      </div>
                    </li>
                  `
                    )
                    .join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    })
    .join('');

  resultsDiv.innerHTML = html;
}

/**
 * Highlight a GUID in the 3D view
 */
async function highlightGUID(guid: string, event: Event) {
  event.stopPropagation();
  if (!streamBIM) return;

  try {
    await streamBIM.deHighlightAllObjects();
    await streamBIM.gotoObject(guid);
    await streamBIM.highlightObject(guid);
  } catch (err) {
    console.error('Failed to highlight object:', err);
  }
}

/**
 * Apply color coding to the 3D model
 */
async function visualiseResults() {
  if (!streamBIM || checkResults.size === 0) return;

  updateStatus('Applying color coding...', 'info');

  try {
    const colorMap: Record<string, string> = {};
    const legends: Record<string, string> = {
      f44336: 'Failed',
      '4caf50': 'Passed',
    };

    // Build color map from all results
    for (const result of checkResults.values()) {
      // Red for failed
      for (const obj of result.failedObjects) {
        colorMap[obj.guid] = 'f44336';
      }
      // Green for passed
      for (const obj of result.passedObjects) {
        colorMap[obj.guid] = '4caf50';
      }
    }

    if (Object.keys(colorMap).length > 0) {
      await streamBIM.colorCodeObjectsWithLegends({
        data: colorMap,
        legends,
      });
      updateStatus(`Color-coded ${Object.keys(colorMap).length} objects`, 'success');
    } else {
      updateStatus('No objects to color code', 'warn');
    }
  } catch (err) {
    console.error('Failed to apply color coding:', err);
    updateStatus(`Failed to apply color coding: ${(err as Error).message}`, 'error');
  }
}

/**
 * Clear all results and color coding
 */
async function clearAll() {
  idsDocument = null;
  checkResults.clear();
  idsUrl = '';

  const input = document.getElementById('idsUrlInput') as HTMLInputElement;
  if (input) input.value = '';

  const runBtn = document.getElementById('runChecksBtn') as HTMLButtonElement;
  const visBtn = document.getElementById('visualiseBtn') as HTMLButtonElement;
  if (runBtn) runBtn.disabled = true;
  if (visBtn) visBtn.disabled = true;

  renderUI();

  try {
    await streamBIM?.colorCodeObjectsWithLegends({ data: {} });
    await streamBIM?.deHighlightAllObjects();
  } catch (err) {
    console.warn('Error clearing visualization:', err);
  }

  updateStatus('Cleared all', 'info');
}

/**
 * Update status message
 */
function updateStatus(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  if (!statusDiv) return;

  statusDiv.textContent = message;
  statusDiv.className = `status status-${type}`;

  if (type === 'error' || type === 'warn') {
    console.warn(message);
  } else {
    console.log(message);
  }
}

/**
 * Callback: Object picked in 3D view (if needed in future)
 */
function handlePickedObject(data: any) {
  console.log('Picked object:', data);
}

// Expose highlightGUID to window so onclick can call it
(window as any).highlightGUID = highlightGUID;

// Init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
