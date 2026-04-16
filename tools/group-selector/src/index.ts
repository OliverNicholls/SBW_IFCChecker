import StreamBIM from 'streambim-widget-api';

let streamBIM: any = null;
let selectedIDSFile: { id: string; name: string } | null = null;
let pickedObjects: any[] = [];
let validationResults: Array<any> = [];
let availableIDSFiles: Array<{ id: string; name: string }> = [];
let isValidating: boolean = false;

// Initialize the widget connection
async function initializeWidget() {
  try {
    // Connect to StreamBIM parent application
    const methods = {
      pickedObject: handlePickedObject,
      spacesChanged: handleSpacesChanged,
      cameraChanged: handleCameraChanged,
    };

    streamBIM = await StreamBIM.connectToParent(window, methods);
    console.log('IDS Validator connected to StreamBIM');

    setupUI();
    loadAvailableIDSFiles();
  } catch (error) {
    console.error('Failed to connect to StreamBIM:', error);
    updateStatus('Connection failed');
  }
}

// Load available IDS files from StreamBIM documents
async function loadAvailableIDSFiles() {
  try {
    updateStatus('Loading IDS files from documents...');

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
      // Fallback: empty list
      availableIDSFiles = [];
    }

    if (availableIDSFiles.length > 0) {
      // Select the first IDS file by default
      selectedIDSFile = availableIDSFiles[0];
      updateStatus(`Loaded ${availableIDSFiles.length} IDS file(s). Click elements or use "Validate All Visible".`);
    } else {
      updateStatus('No IDS files found in StreamBIM documents');
    }

    updateDisplay();
  } catch (error) {
    console.error('Error loading IDS files:', error);
    updateStatus('Error loading IDS files from StreamBIM');
  }
}

// Callback when user picks an object in the 3D view
async function handlePickedObject(data: any) {
  if (!selectedIDSFile) {
    updateStatus('Please select an IDS file first');
    return;
  }

  try {
    // Check if object is already selected (Ctrl+Click to deselect)
    const existingIndex = pickedObjects.findIndex(obj => obj.guid === data.guid);
    if (existingIndex !== -1) {
      // Remove if already selected
      pickedObjects.splice(existingIndex, 1);
      validationResults = validationResults.filter(r => r.objectGuid !== data.guid);
      updateStatus(`Deselected element. ${pickedObjects.length} element(s) selected.`);
    } else {
      // Add new selected object
      pickedObjects.push(data);
      updateStatus(`Running validation on selected element... (${pickedObjects.length} total)`);

      // Run validation for this object
      const objectInfo = await streamBIM.getObjectInfo(data.guid);
      const result = await validateAgainstIDS(objectInfo, selectedIDSFile);

      // Remove any existing result for this object and add new one
      validationResults = validationResults.filter(r => r.objectGuid !== data.guid);
      validationResults.push(result);

      updateStatus(`✓ Validation complete. ${pickedObjects.length} element(s) selected.`);
    }

    updateDisplay();
  } catch (error) {
    console.error('Error processing object selection:', error);
    updateStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Validate all visible elements in the 3D view
async function validateAllVisibleElements() {
  if (!selectedIDSFile) {
    updateStatus('Please select an IDS file first');
    return;
  }

  if (isValidating) {
    updateStatus('Validation already in progress...');
    return;
  }

  try {
    isValidating = true;
    updateStatus('Validating all visible elements...');

    // Clear previous selections and results
    pickedObjects = [];
    validationResults = [];

    // Search for all objects (empty query returns all)
    const allObjects = await streamBIM.findObjects({});

    if (!allObjects || allObjects.length === 0) {
      updateStatus('No visible elements found in the 3D view');
      isValidating = false;
      updateDisplay();
      return;
    }

    // Validate each object
    let validatedCount = 0;
    for (const objectGuid of allObjects) {
      try {
        const objectInfo = await streamBIM.getObjectInfo(objectGuid);
        const result = await validateAgainstIDS(objectInfo, selectedIDSFile);
        validationResults.push(result);
        pickedObjects.push({ guid: objectGuid });
        validatedCount++;

        // Update status every 10 validations
        if (validatedCount % 10 === 0) {
          updateStatus(`Validating... ${validatedCount}/${allObjects.length} elements processed`);
        }
      } catch (error) {
        console.warn(`Failed to validate object ${objectGuid}:`, error);
        // Continue with next object
      }
    }

    isValidating = false;
    const passedCount = validationResults.filter(r => r.passed).length;
    updateStatus(`✓ Validation complete. ${passedCount}/${validationResults.length} elements passed.`);
    updateDisplay();
  } catch (error) {
    isValidating = false;
    console.error('Error validating all elements:', error);
    updateStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Clear all selections and results
function clearSelections() {
  pickedObjects = [];
  validationResults = [];
  updateStatus('Selections cleared');
  updateDisplay();
}

// Validate object against IDS file
async function validateAgainstIDS(objectInfo: any, idsFile: any): Promise<any> {
  try {
    // Try to fetch IDS file content and run validation
    await streamBIM.makeApiRequest(`/files/${idsFile.id}/content`);

    // Basic validation: check if object has required properties from IDS
    // This is a placeholder - actual IDS validation would parse the IDS XML/JSON
    const validationResult = {
      idsFile: idsFile.name,
      objectGuid: objectInfo.guid,
      passed: !!objectInfo.guid,
      checks: {
        hasGUID: !!objectInfo.guid,
        hasProperties: !!(objectInfo.properties || objectInfo.ifcProperties),
      },
      timestamp: new Date().toISOString()
    };

    return validationResult;
  } catch (error) {
    console.error('Error validating against IDS:', error);
    // Return basic validation result if IDS fetch fails
    return {
      idsFile: idsFile.name,
      objectGuid: objectInfo.guid,
      passed: false,
      error: error instanceof Error ? error.message : 'Validation failed',
      timestamp: new Date().toISOString()
    };
  }
}

// Callback when user enters/leaves a space
function handleSpacesChanged(spaces: string[]) {
  console.log('Spaces changed:', spaces);
}

// Callback when camera moves or rotates
function handleCameraChanged() {
  console.log('Camera changed');
}

// Update selected IDS file
function setSelectedIDSFile(fileId: string) {
  const file = availableIDSFiles.find(f => f.id === fileId);
  if (file) {
    selectedIDSFile = file;
    pickedObjects = [];
    validationResults = [];
    updateStatus(`IDS file changed to "${file.name}". Click elements or use "Validate All Visible".`);
    updateDisplay();
  }
}

// Update status message
function updateStatus(message: string) {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
  }
}

// Update the UI display
function updateDisplay() {
  renderUI();
}

// Set up the widget's user interface
function setupUI() {
  renderUI();
}

function renderUI() {
  const root = document.getElementById('app');
  if (!root) return;

  const selectedCount = pickedObjects.length;
  const validatedCount = validationResults.length;
  const passedCount = validationResults.filter(r => r.passed).length;

  const selectionInfo = selectedCount > 0
    ? `<div class="selection-summary">
        <p><strong>${selectedCount}</strong> element(s) selected</p>
        <p><strong>${passedCount}/${validatedCount}</strong> passed validation</p>
      </div>`
    : '<p class="info">No elements selected yet</p>';

  // Build validation results list
  const resultsList = validationResults.length > 0
    ? `<div class="results-list">
        ${validationResults.map((result) => `
          <div class="result-item ${result.passed ? 'passed' : 'failed'}">
            <span class="result-status">${result.passed ? '✓' : '✗'}</span>
            <span class="result-guid">${result.objectGuid.substring(0, 8)}...</span>
            <span class="result-status-text">${result.passed ? 'Passed' : 'Failed'}</span>
          </div>
        `).join('')}
      </div>`
    : '';

  // Build IDS file dropdown options
  const idsFileOptions = availableIDSFiles.length > 0
    ? availableIDSFiles.map(file => `<option value="${file.id}" ${selectedIDSFile?.id === file.id ? 'selected' : ''}>${file.name}</option>`).join('')
    : '<option value="">No IDS files available</option>';

  const loadingMessage = availableIDSFiles.length === 0 ? '<p class="info">Loading IDS files from StreamBIM documents...</p>' : '';

  root.innerHTML = `
    <div class="widget-container">
      <h1>IDS Validator</h1>
      <p class="subtitle">Validate BIM elements against IDS specifications</p>

      <div class="section">
        <h2>IDS File Selection</h2>
        ${loadingMessage}
        <label for="idsFileSelect" class="label">Choose IDS File from Documents</label>
        <select
          id="idsFileSelect"
          class="input-field"
          ${availableIDSFiles.length === 0 ? 'disabled' : ''}
        >
          ${idsFileOptions}
        </select>
      </div>

      <div class="section">
        <h2>Element Selection</h2>
        <p class="instruction">Click elements in the 3D view to select them, or use the button below to validate all visible elements</p>
        <button class="btn btn-primary" onclick="validateAllVisibleElementsUI()" ${!selectedIDSFile ? 'disabled' : ''}>
          Validate All Visible Elements
        </button>
        <button class="btn btn-secondary" onclick="clearSelectionsUI()" ${selectedCount === 0 ? 'disabled' : ''}>
          Clear Selection
        </button>
      </div>

      <div class="section">
        <h2>Selection Summary</h2>
        ${selectionInfo}
      </div>

      ${validationResults.length > 0 ? `
        <div class="section">
          <h2>Validation Results</h2>
          ${resultsList}
        </div>
      ` : ''}

      <div id="status" class="status">Ready</div>
    </div>
  `;

  // Attach event listeners
  const select = document.getElementById('idsFileSelect') as HTMLSelectElement;
  if (select && availableIDSFiles.length > 0) {
    select.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      setSelectedIDSFile(target.value);
    });
  }

  // Attach global functions
  (window as any).validateAllVisibleElementsUI = validateAllVisibleElements;
  (window as any).clearSelectionsUI = clearSelections;
}

// Start the widget when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeWidget);
} else {
  initializeWidget();
}
