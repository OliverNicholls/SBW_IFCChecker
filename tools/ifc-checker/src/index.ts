/**
 * IFC Checker Widget for StreamBIM
 * Loads IDS files from StreamBIM documents and validates IFC model compliance
 */

import { parseIDS, IDSDocument } from './ids-parser';
import { checkSpecification, SpecificationResult } from './checker';

// Global state
let streamBIM: any = null;
let idsDocument: IDSDocument | null = null;
let checkResults: Map<string, SpecificationResult> = new Map();
let pickedObjects: any[] = [];
let availableIDSFiles: Array<{ id: string; name: string }> = [];
let isChecking = false;

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
    loadAvailableIDSFiles();
  } catch (err) {
    console.error('Failed to connect to StreamBIM:', err);
    updateStatus('Failed to connect to StreamBIM', 'error');
  }
}

/**
 * Load available IDS files from StreamBIM documents
 */
async function loadAvailableIDSFiles() {
  try {
    updateStatus('Loading IDS files from documents...', 'info');

    try {
      // Try to fetch IDS files using makeApiRequest
      const response = await streamBIM.makeApiRequest('/files?type=ids');

      if (response && response.files && Array.isArray(response.files)) {
        availableIDSFiles = response.files.map((file: any) => ({
          id: file.id,
          name: file.name || file.id
        }));
      }
    } catch (error) {
      console.warn('makeApiRequest not available, trying alternative method:', error);
      availableIDSFiles = [];
    }

    if (availableIDSFiles.length > 0) {
      updateStatus(`Loaded ${availableIDSFiles.length} IDS file(s)`, 'success');
    } else {
      updateStatus('No IDS files found in StreamBIM documents', 'warn');
    }

    renderUI();
  } catch (error) {
    console.error('Error loading IDS files:', error);
    updateStatus('Error loading IDS files from StreamBIM', 'error');
  }
}

/**
 * Load selected IDS file
 */
async function loadSelectedIDS(fileId: string) {
  const file = availableIDSFiles.find(f => f.id === fileId);
  if (!file) return;

  updateStatus(`Loading IDS file: ${file.name}...`, 'info');

  try {
    const idsContent = await streamBIM.makeApiRequest(`/files/${file.id}/content`);
    idsDocument = parseIDS(typeof idsContent === 'string' ? idsContent : JSON.stringify(idsContent));

    // Reset selections and results
    pickedObjects = [];
    checkResults.clear();

    updateSpecsUI();
    updateStatus(`Loaded IDS: ${idsDocument.title} (${idsDocument.specifications.length} specifications)`, 'success');

    // Enable Run Checks button
    const runBtn = document.getElementById('runChecksBtn') as HTMLButtonElement;
    if (runBtn) runBtn.disabled = false;

    renderUI();
  } catch (err) {
    console.error('Failed to load IDS:', err);
    updateStatus(`Failed to load IDS: ${(err as Error).message}`, 'error');
  }
}

/**
 * Callback when user picks an object in the 3D view
 */
async function handlePickedObject(data: any) {
  if (!idsDocument) {
    updateStatus('Please load an IDS file first', 'warn');
    return;
  }

  // Check if object is already selected
  const existingIndex = pickedObjects.findIndex(obj => obj.guid === data.guid);
  if (existingIndex !== -1) {
    // Remove if already selected
    pickedObjects.splice(existingIndex, 1);
    updateStatus(`Deselected element. ${pickedObjects.length} element(s) selected.`, 'info');
  } else {
    // Add new selected object
    pickedObjects.push(data);
    updateStatus(`Selected element. ${pickedObjects.length} element(s) selected.`, 'info');
  }

  renderUI();
}

/**
 * Validate all visible elements
 */
async function validateAllVisibleElements() {
  if (!idsDocument || !streamBIM) {
    updateStatus('Please load an IDS file first', 'warn');
    return;
  }

  if (isChecking) {
    updateStatus('Validation already in progress...', 'warn');
    return;
  }

  try {
    isChecking = true;
    updateStatus('Finding all visible elements...', 'info');

    // Search for all objects (empty query returns all)
    const allObjects = await streamBIM.findObjects({});

    if (!allObjects || allObjects.length === 0) {
      updateStatus('No visible elements found in the 3D view', 'warn');
      isChecking = false;
      renderUI();
      return;
    }

    pickedObjects = allObjects.map(guid => ({ guid }));
    updateStatus(`Found ${allObjects.length} elements. Running checks...`, 'info');
    isChecking = false;
    renderUI();

    // Run the checks
    await runChecks();
  } catch (error) {
    isChecking = false;
    console.error('Error validating all elements:', error);
    updateStatus(`Error: ${(error as Error).message}`, 'error');
  }
}

/**
 * Clear selections
 */
function clearSelections() {
  pickedObjects = [];
  updateStatus('Selections cleared', 'info');
  renderUI();
}

/**
 * Render UI
 */
function renderUI() {
  if (!root) return;

  const selectedCount = pickedObjects.length;
  const idsFileOptions = availableIDSFiles.length > 0
    ? availableIDSFiles.map(file => `<option value="${file.id}">${file.name}</option>`).join('')
    : '<option value="">No IDS files available</option>';

  const selectionSummary = selectedCount > 0
    ? `<div class="selection-summary">
        <p><strong>${selectedCount}</strong> element(s) selected</p>
      </div>`
    : '<p class="info">No elements selected</p>';

  const specsUI = idsDocument ? `<div id="specsContainer" class="specs-container"></div>` : '<p class="empty-state">Load an IDS file to see specifications</p>';

  root.innerHTML = `
    <div class="widget-container">
      <h1>IFC Checker</h1>

      <div class="section">
        <h2>IDS File Selection</h2>
        <label for="idsFileSelect" class="label">Choose IDS File from StreamBIM Documents:</label>
        <select
          id="idsFileSelect"
          class="input-field"
          ${availableIDSFiles.length === 0 ? 'disabled' : ''}
        >
          <option value="">-- Select an IDS file --</option>
          ${idsFileOptions}
        </select>
      </div>

      ${idsDocument ? `
        <div class="section">
          <h2>Specifications (${idsDocument.specifications.length})</h2>
          ${specsUI}
        </div>
      ` : ''}

      <div class="section">
        <h2>Element Selection</h2>
        <p class="instruction">Click elements in the 3D view to select them, or use the button below to validate all visible elements</p>
        <button class="btn btn-primary" onclick="validateAllVisibleElementsUI()" ${!idsDocument ? 'disabled' : ''}>
          Validate All Visible Elements
        </button>
        <button class="btn btn-secondary" onclick="clearSelectionsUI()" ${selectedCount === 0 ? 'disabled' : ''}>
          Clear Selection
        </button>
      </div>

      ${selectedCount > 0 ? `
        <div class="section">
          <h2>Selection Summary</h2>
          ${selectionSummary}
          <button id="runChecksBtn" class="btn btn-primary" ${!idsDocument ? 'disabled' : ''}>Run Validation on Selected Elements</button>
        </div>
      ` : ''}

      <div class="section">
        <h2>Results</h2>
        <div id="results" class="results-container">
          <p class="empty-state">Run checks to see results</p>
        </div>
      </div>

      <div id="status" class="status"></div>
    </div>
  `;

  // Attach event listeners
  const select = document.getElementById('idsFileSelect') as HTMLSelectElement;
  if (select && availableIDSFiles.length > 0) {
    select.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      if (target.value) {
        loadSelectedIDS(target.value);
      }
    });
  }

  const runBtn = document.getElementById('runChecksBtn') as HTMLButtonElement;
  if (runBtn) {
    runBtn.addEventListener('click', runChecks);
  }

  // Expose global functions
  (window as any).validateAllVisibleElementsUI = validateAllVisibleElements;
  (window as any).clearSelectionsUI = clearSelections;
  (window as any).highlightGUID = highlightGUID;

  statusDiv = document.getElementById('status');
  resultsDiv = document.getElementById('results');

  // Update specs UI if IDS document is loaded
  if (idsDocument) {
    updateSpecsUI();
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
  if (!idsDocument || !streamBIM || pickedObjects.length === 0) {
    updateStatus('Please select at least one element', 'warn');
    return;
  }

  isChecking = true;
  checkResults.clear();

  const runBtn = document.getElementById('runChecksBtn') as HTMLButtonElement;
  if (runBtn) runBtn.disabled = true;

  // Get selected specs
  const checkboxes = document.querySelectorAll('input[data-spec-idx]:checked') as NodeListOf<HTMLInputElement>;
  const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.getAttribute('data-spec-idx') || '-1', 10));

  updateStatus(`Running ${selectedIndices.length} specification(s) on ${pickedObjects.length} element(s)...`, 'info');

  let completed = 0;
  for (const idx of selectedIndices) {
    const spec = idsDocument.specifications[idx];
    if (!spec) continue;

    try {
      const result = await checkSpecification(spec, streamBIM);

      // Filter results to only include picked objects
      const pickedGuids = new Set(pickedObjects.map(o => o.guid));
      result.failedObjects = result.failedObjects.filter(o => pickedGuids.has(o.guid));
      result.passedObjects = result.passedObjects.filter(o => pickedGuids.has(o.guid));
      result.failedCount = result.failedObjects.length;
      result.passedCount = result.passedObjects.length;

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

// Init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
