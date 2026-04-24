const app = document.getElementById('app')!;
let selectedElements: Map<string, any> = new Map();
let selectedObjectInfoMap: Map<string, any> = new Map();
let importedData: Map<string, any> = new Map();
let importedFileMeta: { ifc_file: string; generated_at: string } | null = null;
let activeTab: 'properties' | 'checks' = 'properties';
let expandedGroups: Set<string> = new Set();
let showMissingProperties: boolean = true;
let db: IDBDatabase | null = null;
let pinnedPsets: Set<string> = new Set();

function toggleGroup(groupId: string) {
  if (expandedGroups.has(groupId)) {
    expandedGroups.delete(groupId);
  } else {
    expandedGroups.add(groupId);
  }
  renderUI();
}

function togglePinPset(psetName: string) {
  if (pinnedPsets.has(psetName)) {
    pinnedPsets.delete(psetName);
  } else {
    pinnedPsets.add(psetName);
  }
  savePinnedPsets();
  renderUI();
}

function savePinnedPsets() {
  localStorage.setItem('pinnedPsets', JSON.stringify(Array.from(pinnedPsets)));
}

function loadPinnedPsets() {
  const saved = localStorage.getItem('pinnedPsets');
  if (saved) {
    try {
      pinnedPsets = new Set(JSON.parse(saved));
    } catch (e) {
      pinnedPsets = new Set();
    }
  }
}

function toggleMissingProperties() {
  showMissingProperties = !showMissingProperties;
  renderUI();
}

function switchTab(tab: 'properties' | 'checks') {
  activeTab = tab;
  renderUI();
}

async function clearImportedData() {
  if (!confirm('Are you sure you want to clear all imported JSON data?')) {
    return;
  }

  try {
    if (db) {
      const elementsStore = db.transaction('imported-elements', 'readwrite').objectStore('imported-elements');
      const metaStore = db.transaction('meta', 'readwrite').objectStore('meta');

      elementsStore.clear();
      metaStore.clear();
    }

    importedData.clear();
    importedFileMeta = null;
    selectedElements.clear();
    selectedObjectInfoMap.clear();

    // Clear highlights from the 3D view
    if (typeof (window as any).StreamBIM !== 'undefined' && (window as any).StreamBIM._parent) {
      (window as any).StreamBIM.deHighlightAllObjects().catch((err: any) => {
        console.warn('Could not clear highlights:', err);
      });
    }

    renderUI();
  } catch (error) {
    console.error('Error clearing imported data:', error);
    alert('Failed to clear imported data');
  }
}

function renderUI() {
  app.innerHTML = `
    <div style="padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; height: 100vh;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px;">BIM-spector</h1>
        <div style="display: flex; gap: 8px;">
          <button data-action="import-file" style="padding: 8px 12px; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">
            Import Checks
          </button>
          ${importedFileMeta ? `<button data-action="clear-json" style="padding: 8px 12px; background: #d32f2f; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">
            Clear JSON
          </button>` : ''}
        </div>
      </div>
      ${importedFileMeta ? `<div style="margin-bottom: 12px; padding: 8px 12px; background: #e8f4f8; border-radius: 4px; font-size: 12px; color: #0066cc;"><strong>${importedFileMeta.ifc_file}</strong> • ${importedFileMeta.generated_at} • ${importedData.size} elements</div>` : ''}

      <div style="background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; flex: 1; overflow: hidden;">
        <!-- Tabs -->
        <div style="display: flex; border-bottom: 1px solid #e0e0e0;">
          <button data-tab="properties" style="flex: 1; padding: 12px 16px; background: ${activeTab === 'properties' ? '#fff' : '#f5f5f5'}; border: none; border-bottom: ${activeTab === 'properties' ? '2px solid #0066cc' : 'none'}; cursor: pointer; font-size: 14px; font-weight: ${activeTab === 'properties' ? 'bold' : 'normal'}; color: ${activeTab === 'properties' ? '#0066cc' : '#666'}; transition: all 0.2s;">
            Properties
          </button>
          <button data-tab="checks" style="flex: 1; padding: 12px 16px; background: ${activeTab === 'checks' ? '#fff' : '#f5f5f5'}; border: none; border-bottom: ${activeTab === 'checks' ? '2px solid #0066cc' : 'none'}; cursor: pointer; font-size: 14px; font-weight: ${activeTab === 'checks' ? 'bold' : 'normal'}; color: ${activeTab === 'checks' ? '#0066cc' : '#666'}; transition: all 0.2s;">
            Checks
          </button>
        </div>

        <!-- Tab Content -->
        <div style="padding: 16px; overflow-y: auto; flex: 1;">
          ${activeTab === 'properties' ? renderPropertiesTab() : renderChecksTab()}
        </div>
      </div>

      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #eee; text-align: center;">
        <img src="./Tikab_Logo_Blue.png" alt="Tikab Logo" style="height: 40px; width: auto;">
      </div>
    </div>
  `;
}

function renderPropertiesTab(): string {
  if (selectedElements.size === 0) {
    return '<div style="color: #999; padding: 16px; text-align: center;">Click on an element in StreamBIM to inspect it</div>';
  }

  const hasMissingProps = Array.from(selectedElements.keys()).some(guid => {
    const importedEl = importedData.get(guid);
    return importedEl && Array.isArray(importedEl.checks) && importedEl.checks.length > 0;
  });

  return `
    <div style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="margin: 0; font-size: 16px; color: #333;">Selected Elements (${selectedElements.size})</h2>
        ${hasMissingProps ? `<button data-action="toggle-missing" style="padding: 4px 8px; background: #fff3e0; color: #ff9800; border: 1px solid #ff9800; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">
          ${showMissingProperties ? '✓' : '○'} Missing
        </button>` : ''}
      </div>
    </div>
    ${Array.from(selectedElements.entries()).map(([guid]: [string, any]) => {
      const objInfo = selectedObjectInfoMap.get(guid);
      return `
        <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #ddd;">
          <div style="margin-bottom: 12px; padding: 10px 12px; background: #f0f0f0; border-radius: 4px;">
            <strong style="color: #0066cc; font-size: 14px;">Element ${selectedElements.size > 1 ? '(' + Array.from(selectedElements.keys()).indexOf(guid) + 1 + ')' : ''}</strong>
            <div style="color: #666; font-size: 11px; margin-top: 4px; font-family: monospace;">GUID: ${guid}</div>
          </div>
          ${renderElementProperties(objInfo, guid)}
        </div>
      `;
    }).join('')}
  `;
}

function renderElementProperties(objInfo: any, guid?: string): string {
  if (!objInfo) return '<div style="color: #999;">No information available</div>';

  const checkLookup = new Map<string, any>();
  const importedEl = guid ? importedData.get(guid) : undefined;
  if (guid && importedEl) {
    if (Array.isArray(importedEl?.checks)) {
      for (const c of importedEl.checks) {
        if (c.property_set && c.property_name && c.result) {
          const bareKey = c.property_name.startsWith(c.property_set + '.')
            ? c.property_name.slice(c.property_set.length + 1)
            : c.property_name;
          checkLookup.set(`${c.property_set}::${bareKey}`, c);
        }
      }
    }
  }

  let html = '';
  let groupIndex = 0;

  // Build a set of all properties that exist in objInfo
  const existingProps = new Set<string>();

  // First, collect all missing properties by PropertySet
  const missingPropsLookup = new Map<string, any>();
  if (showMissingProperties && importedEl && Array.isArray(importedEl.checks)) {
    importedEl.checks.forEach((check: any) => {
      if (check.property_set && check.property_name) {
        const bareKey = check.property_name.startsWith(check.property_set + '.')
          ? check.property_name.slice(check.property_set.length + 1)
          : check.property_name;
        missingPropsLookup.set(`${check.property_set}::${bareKey}`, {
          key: bareKey,
          check: check,
          pset: check.property_set,
        });
      }
    });
  }

  // Check if data has groups structure
  if (Array.isArray(objInfo.groups)) {
    const sortedGroups = [...objInfo.groups].sort((a: any, b: any) => {
      const aIsPinned = pinnedPsets.has(a.label);
      const bIsPinned = pinnedPsets.has(b.label);

      if (aIsPinned !== bIsPinned) {
        return aIsPinned ? -1 : 1;
      }

      return a.label.localeCompare(b.label);
    });

    html += sortedGroups.map((group: any) => {
      const groupId = `group-${groupIndex++}`;
      const isExpanded = expandedGroups.has(groupId);
      const props = group.content?.properties || [];

      // Track existing properties
      props.forEach((prop: any) => {
        const propKey = `${group.label}::${prop.key}`;
        existingProps.add(propKey);
      });

      // Get missing properties for this PropertySet
      const groupMissingProps: any[] = [];
      if (showMissingProperties && importedEl && Array.isArray(importedEl.checks)) {
        importedEl.checks.forEach((check: any) => {
          if (check.property_set === group.label && check.property_name) {
            const bareKey = check.property_name.startsWith(check.property_set + '.')
              ? check.property_name.slice(check.property_set.length + 1)
              : check.property_name;
            const propKey = `${group.label}::${bareKey}`;
            if (!existingProps.has(propKey)) {
              groupMissingProps.push({
                key: bareKey,
                check: check,
              });
            }
          }
        });
      }

      const totalCount = props.length + groupMissingProps.length;

      const isPinned = pinnedPsets.has(group.label);
      return `
        <div style="margin-bottom: 12px;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <button data-group-id="${groupId}" style="flex: 1; padding: 10px 12px; background: ${isPinned ? '#fce4ec' : '#e8f4f8'}; border: 1px solid ${isPinned ? '#c2185b' : '#0066cc'}; border-left: 4px solid ${isPinned ? '#c2185b' : '#0066cc'}; border-radius: 2px; cursor: pointer; text-align: left; font-size: 13px; color: ${isPinned ? '#c2185b' : '#0066cc'}; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
              <span>${group.label} (${totalCount})</span>
              <span style="transform: rotate(${isExpanded ? '180deg' : '0deg'}); transition: transform 0.2s;">▼</span>
            </button>
            <button data-action="toggle-pin-pset" data-pset="${group.label}" style="padding: 8px 10px; background: ${isPinned ? '#c2185b' : '#f0f0f0'}; color: ${isPinned ? 'white' : '#666'}; border: 1px solid ${isPinned ? '#c2185b' : '#ddd'}; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; min-width: 40px; text-align: center; transition: all 0.2s;" title="${isPinned ? 'Unpin this property set' : 'Pin this property set'}">
              ${isPinned ? '📌' : '📍'}
            </button>
          </div>
          ${isExpanded ? `
            <div style="padding: 8px; border-left: 2px solid #e0e0e0; margin-top: 4px;">
              ${props.map((prop: any) => {
                const check = checkLookup.get(`${group.label}::${prop.key}`);
                const checkResult = check?.result?.toUpperCase();
                const statusIcon = checkResult === 'PASS'
                  ? '<span style="color: #4caf50; font-weight: bold; margin-left: 4px;" title="PASS">✓</span>'
                  : checkResult === 'FAIL'
                  ? '<span style="color: #d32f2f; font-weight: bold; margin-left: 4px;" title="FAIL">✗</span>'
                  : '';
                return `
                <div style="margin-bottom: 8px; padding: 6px 8px; background: #fafafa; border-radius: 3px; font-size: 12px;">
                  <div style="margin-bottom: 2px;">
                    <strong style="color: #333;">${prop.key}:</strong>
                    <span style="color: #0066cc; font-family: monospace;">${formatValue(prop.value, prop.unit)}</span>
                    ${statusIcon}
                  </div>
                  ${prop.measure ? `<div style="color: #999; font-size: 11px;">📏 ${prop.measure}${prop.unit ? ' (' + prop.unit + ')' : ''}</div>` : ''}
                  ${prop.valueType ? `<div style="color: #999; font-size: 11px;">Type: ${prop.valueType}</div>` : ''}
                  ${check ? `
                    <div style="margin-top: 4px; padding: 4px; background: ${checkResult === 'PASS' ? '#e8f5e9' : '#ffebee'}; border-radius: 2px;">
                      <div style="color: ${checkResult === 'PASS' ? '#2e7d32' : '#c62828'}; font-weight: bold; font-size: 11px; margin-bottom: 2px;">Result: ${checkResult}</div>
                      ${check.message ? `<div style="color: #666; font-size: 11px; margin-bottom: 2px;">${check.message}</div>` : ''}
                      ${check.reason ? `<div style="color: #666; font-size: 11px; margin-bottom: 2px;">${check.reason}</div>` : ''}
                      ${check.expected || check.actual ? `<div style="color: #999; font-size: 10px;">Expected: ${check.expected}, Got: ${check.actual}</div>` : ''}
                    </div>
                  ` : ''}
                </div>
              `;
              }).join('')}
              ${groupMissingProps.length > 0 ? `
                <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #e0e0e0;">
                  ${groupMissingProps.map((p: any) => {
                    return `
                    <div style="margin-bottom: 8px; padding: 6px 8px; background: #fafafa; border-left: 3px solid #ff9800; border-radius: 3px; font-size: 12px; opacity: 0.85;">
                      <div style="margin-bottom: 2px;">
                        <strong style="color: #333;">${p.key}:</strong>
                        <span style="color: #999; font-family: monospace;">—</span>
                        <span style="color: #ff9800; font-weight: bold; margin-left: 4px;" title="MISSING">⚠</span>
                      </div>
                      ${p.check.message ? `<div style="color: #999; font-size: 11px;">${p.check.message}</div>` : ''}
                      ${p.check.reason ? `<div style="color: #666; font-size: 11px; margin-bottom: 2px;">${p.check.reason}</div>` : ''}
                      ${p.check.expected || p.check.actual ? `<div style="color: #999; font-size: 10px;">Expected: ${p.check.expected}, Got: ${p.check.actual}</div>` : ''}
                      <div style="margin-top: 4px; padding: 4px; background: #fff3e0; border-radius: 2px;">
                        <div style="color: #e65100; font-weight: bold; font-size: 11px;">Result: MISSING</div>
                      </div>
                    </div>
                    `;
                  }).join('')}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // Show any additional top-level properties not in groups
  const groupProperties = new Set(['groups']);
  const additionalProps = Object.entries(objInfo)
    .filter(([key]: [string, any]) => !groupProperties.has(key))
    .filter(([_key, value]: [string, any]) => value !== null && value !== undefined && !Array.isArray(value));

  if (additionalProps.length > 0) {
    const groupId = `other-props-${groupIndex}`;
    const isExpanded = expandedGroups.has(groupId);
    html += `
      <div style="margin-bottom: 12px;">
        <button data-group-id="${groupId}" style="width: 100%; padding: 10px 12px; background: #f0f0f0; border: 1px solid #666; border-left: 4px solid #666; border-radius: 2px; cursor: pointer; text-align: left; font-size: 13px; color: #666; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
          <span>Other Properties (${additionalProps.length})</span>
          <span style="transform: rotate(${isExpanded ? '180deg' : '0deg'}); transition: transform 0.2s;">▼</span>
        </button>
        ${isExpanded ? `
          <div style="padding: 8px; border-left: 2px solid #e0e0e0; margin-top: 4px;">
            ${additionalProps.map(([key, value]: [string, any]) => `
              <div style="margin-bottom: 8px; padding: 6px 8px; background: #fafafa; border-radius: 3px; font-size: 12px;">
                <strong style="color: #333;">${key}:</strong>
                <span style="color: #666; font-family: monospace;">${typeof value === 'object' ? JSON.stringify(value) : formatValue(value)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  return html;
}

function formatValue(val: any, unit?: string): string {
  if (val === null || val === undefined) return 'N/A';
  if (typeof val === 'object') return JSON.stringify(val);
  const strVal = String(val);
  return unit ? `${strVal} ${unit}` : strVal;
}

function renderChecksTab(): string {
  if (importedData.size === 0) {
    return '<div style="color: #999; padding: 16px; text-align: center;">Import a JSON file to see checks</div>';
  }

  if (selectedElements.size === 0) {
    return `
      <div>
        <div style="margin-bottom: 16px; padding: 12px; background: #e8f4f8; border-left: 4px solid #0066cc; border-radius: 2px;">
          <strong style="color: #0066cc; font-size: 13px;">Imported Data</strong>
          <div style="color: #666; font-size: 12px; margin-top: 4px;">
            ${importedFileMeta ? `<div><strong>${importedFileMeta.ifc_file}</strong> • ${importedFileMeta.generated_at}</div>` : ''}
            <div style="margin-top: 4px;"><strong>${importedData.size} elements imported</strong></div>
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #333;">All Imported Elements</h3>
          <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px;">
            ${Array.from(importedData.entries()).map(([guid, element]: [string, any]) => {
              const checkCount = Array.isArray(element.checks) ? element.checks.length : 0;
              return `
                <div style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 12px;">
                  <div style="font-family: monospace; color: #0066cc; font-size: 11px; margin-bottom: 2px;">${guid}</div>
                  <div style="color: #666;"><strong>${checkCount}</strong> checks</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div style="color: #999; padding: 12px; text-align: center; font-size: 12px;">Select an element to see its specific checks</div>
      </div>
    `;
  }

  return `
    <div style="margin-bottom: 16px;">
      <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #333;">Checks (${selectedElements.size})</h2>
    </div>
    ${Array.from(selectedElements.entries()).map(([guid]: [string, any]) => {
      const importedElement = importedData.get(guid);
      return `
        <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #ddd;">
          <div style="margin-bottom: 12px; padding: 10px 12px; background: #f0f0f0; border-radius: 4px;">
            <strong style="color: #0066cc; font-size: 14px;">Element ${selectedElements.size > 1 ? '(' + Array.from(selectedElements.keys()).indexOf(guid) + 1 + ')' : ''}</strong>
            <div style="color: #666; font-size: 11px; margin-top: 4px; font-family: monospace;">GUID: ${guid}</div>
          </div>
          ${renderElementChecks(importedElement)}
        </div>
      `;
    }).join('')}
  `;
}

function renderElementChecks(importedElement: any): string {
  if (!importedElement) {
    return '<div style="color: #999; padding: 8px;">No check data for this element</div>';
  }

  if (!Array.isArray(importedElement.checks) || importedElement.checks.length === 0) {
    return '<div style="color: #999; padding: 8px;">No checks defined for this element</div>';
  }

  const passes = importedElement.checks.filter((c: any) => c.result?.toUpperCase() === 'PASS' || c.status === 'pass' || c.status === true);
  const failures = importedElement.checks.filter((c: any) => c.result?.toUpperCase() === 'FAIL' || c.status === 'fail' || c.status === false);

  let html = '';

  if (failures.length > 0) {
    html += `
      <div style="margin-bottom: 12px;">
        <div style="padding: 8px 12px; background: #ffebee; border-left: 4px solid #d32f2f; border-radius: 2px; margin-bottom: 8px;">
          <strong style="color: #d32f2f; font-size: 13px;">Failed (${failures.length})</strong>
        </div>
        ${failures.map((check: any) => `
          <div style="margin-bottom: 8px; padding: 8px; background: #fafafa; border-left: 2px solid #d32f2f; border-radius: 2px; font-size: 12px;">
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
              <span style="display: inline-block; width: 8px; height: 8px; background: #d32f2f; border-radius: 50%; margin-right: 6px;"></span>
              <strong style="color: #333;">${check.spec_name || check.rule || check.name || 'Unnamed check'}</strong>
            </div>
            ${check.requirement_ref ? `<div style="color: #999; font-size: 11px; margin-bottom: 2px;">Requirement: ${check.requirement_ref}</div>` : ''}
            ${check.reason ? `<div style="color: #666; margin-bottom: 4px;">${check.reason}</div>` : ''}
            ${check.expected_value ? `<div style="color: #999; font-size: 11px;">Expected: ${check.expected_value}, Got: ${check.actual_value}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  if (passes.length > 0) {
    html += `
      <div style="margin-bottom: 12px;">
        <div style="padding: 8px 12px; background: #e8f5e9; border-left: 4px solid #4caf50; border-radius: 2px; margin-bottom: 8px;">
          <strong style="color: #4caf50; font-size: 13px;">Passed (${passes.length})</strong>
        </div>
        ${passes.map((check: any) => `
          <div style="margin-bottom: 8px; padding: 8px; background: #fafafa; border-left: 2px solid #4caf50; border-radius: 2px; font-size: 12px;">
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
              <span style="display: inline-block; width: 8px; height: 8px; background: #4caf50; border-radius: 50%; margin-right: 6px;"></span>
              <strong style="color: #333;">${check.spec_name || check.rule || check.name || 'Unnamed check'}</strong>
            </div>
            ${check.requirement_ref ? `<div style="color: #999; font-size: 11px;">Requirement: ${check.requirement_ref}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  return html;
}

async function loadStreamBIMLibrary(): Promise<any> {
  // Check if StreamBIM is already available globally
  if (typeof (window as any).StreamBIM !== 'undefined') {
    console.log('StreamBIM API found globally');
    return (window as any).StreamBIM;
  }

  // Try to load from the public lib folder
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(/* @vite-ignore */ '../lib/streambim-widget-api.min.js', import.meta.url).href;
    script.onload = () => {
      const api = (window as any).StreamBIM;
      if (api) {
        console.log('StreamBIM API loaded from script');
        resolve(api);
      } else {
        reject(new Error('StreamBIM API not available after script load'));
      }
    };
    script.onerror = () => {
      reject(new Error('Failed to load StreamBIM API script'));
    };
    document.head.appendChild(script);
  });
}

function setupGlobalClickHandler() {
  // Stop propagation on clicks within the widget to prevent parent from closing
  // But allow button clicks to propagate for event delegation
  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const isButton = target.closest('[data-tab], [data-group-id], [data-action]');
    if (!isButton) {
      e.stopPropagation();
    }
  }, true);
}

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('bim-spector-db', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains('imported-elements')) {
        database.createObjectStore('imported-elements', { keyPath: 'global_id' });
      }
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta');
      }
    };
  });
}

function saveImportedData(elements: any[], meta: any): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized'));

    const elementsTransaction = db.transaction('imported-elements', 'readwrite');
    const metaTransaction = db.transaction('meta', 'readwrite');

    const elementsStore = elementsTransaction.objectStore('imported-elements');
    const metaStore = metaTransaction.objectStore('meta');

    elementsStore.clear();
    console.log(`Saving ${elements.length} elements to IndexedDB`);
    elements.forEach((el) => {
      elementsStore.add(el);
    });

    metaStore.put(meta, 'file-info');
    console.log('Meta saved to IndexedDB');

    let elementsComplete = false;
    let metaComplete = false;

    elementsTransaction.oncomplete = () => {
      console.log('Elements transaction complete');
      elementsComplete = true;
      if (metaComplete) {
        console.log('Both transactions complete, resolving');
        resolve();
      }
    };

    metaTransaction.oncomplete = () => {
      console.log('Meta transaction complete');
      metaComplete = true;
      if (elementsComplete) {
        console.log('Both transactions complete, resolving');
        resolve();
      }
    };

    elementsTransaction.onerror = () => {
      console.error('Elements transaction error:', elementsTransaction.error);
      reject(elementsTransaction.error);
    };

    metaTransaction.onerror = () => {
      console.error('Meta transaction error:', metaTransaction.error);
      reject(metaTransaction.error);
    };
  });
}

function loadImportedData(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized'));

    const elementsStore = db.transaction('imported-elements', 'readonly').objectStore('imported-elements');
    const metaStore = db.transaction('meta', 'readonly').objectStore('meta');

    const elementsRequest = elementsStore.getAll();
    const metaRequest = metaStore.get('file-info');

    let elementsLoaded = false;
    let metaLoaded = false;

    elementsRequest.onsuccess = () => {
      const elements = elementsRequest.result;
      console.log(`Loading ${elements.length} elements from IndexedDB`);
      elements.forEach((el) => {
        importedData.set(el.global_id, el);
      });
      console.log(`importedData now has ${importedData.size} items`);
      elementsLoaded = true;
      if (metaLoaded) {
        console.log('Load complete, importedData size:', importedData.size);
        resolve();
      }
    };

    metaRequest.onsuccess = () => {
      importedFileMeta = metaRequest.result || null;
      console.log('Meta loaded from IndexedDB:', importedFileMeta);
      metaLoaded = true;
      if (elementsLoaded) {
        console.log('Load complete, importedData size:', importedData.size);
        resolve();
      }
    };

    elementsRequest.onerror = () => {
      console.error('Elements load error:', elementsRequest.error);
      reject(elementsRequest.error);
    };

    metaRequest.onerror = () => {
      console.error('Meta load error:', metaRequest.error);
      reject(metaRequest.error);
    };
  });
}

function handleFileImport(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        console.log('File read, parsing JSON...');
        const json = JSON.parse(e.target?.result as string);
        console.log('JSON parsed, elements count:', json.elements?.length);

        if (!Array.isArray(json.elements)) {
          throw new Error('Invalid JSON: missing "elements" array');
        }

        const meta = {
          ifc_file: json.ifc_file || file.name,
          generated_at: json.generated_at || new Date().toISOString(),
        };

        console.log('Calling saveImportedData...');
        await saveImportedData(json.elements, meta);
        console.log('Save complete, clearing and reloading...');
        importedData.clear();
        await loadImportedData();
        console.log('Rendering UI, importedData size:', importedData.size);
        renderUI();
        resolve();
      } catch (error) {
        console.error('handleFileImport error:', error);
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

async function main() {
  try {
    app.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #666;">
        <p>Initializing widget...</p>
      </div>
    `;

    // Initialize IndexedDB
    db = await initDB();
    await loadImportedData();
    loadPinnedPsets();

    // Setup event delegation for persistent listeners
    app.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-tab], [data-group-id], [data-action]') as HTMLButtonElement;

      if (!button) return;

      if (button.dataset.tab) {
        switchTab(button.dataset.tab as 'properties' | 'checks');
      } else if (button.dataset.groupId) {
        toggleGroup(button.dataset.groupId);
      } else if (button.dataset.action === 'import-file') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;

          try {
            await handleFileImport(file);
            console.log('File imported successfully');
          } catch (err) {
            console.error('Import error:', err);
            alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        };
        input.click();
      } else if (button.dataset.action === 'clear-json') {
        clearImportedData();
      } else if (button.dataset.action === 'toggle-missing') {
        toggleMissingProperties();
      } else if (button.dataset.action === 'toggle-pin-pset') {
        const psetName = button.dataset.pset;
        if (psetName) {
          togglePinPset(psetName);
        }
      }
    }, false);

    // Prevent clicks from propagating to parent
    setupGlobalClickHandler();

    // Load StreamBIM library
    const StreamBIM = await loadStreamBIMLibrary();

    // Connect to parent StreamBIM instance
    await StreamBIM.connect({
      pickedObject: (element: any) => {
        console.log('Element selected:', element);

        // If Shift is not held, clear previous selections and highlights
        if (!element.shiftKey) {
          selectedElements.clear();
          selectedObjectInfoMap.clear();
          StreamBIM.deHighlightAllObjects().catch((err: any) => {
            console.warn('Could not clear highlights:', err);
          });
        }

        // Add the selection
        selectedElements.set(element.guid, element);

        // Highlight the selected object
        StreamBIM.highlightObject(element.guid).catch((err: any) => {
          console.warn('Could not highlight object:', err);
        });

        // Get detailed object information using the guid
        StreamBIM.getObjectInfo(element.guid)
          .then((objectInfo: any) => {
            console.log('Full Object info:', objectInfo);
            console.log('Object properties:', objectInfo?.properties);
            selectedObjectInfoMap.set(element.guid, objectInfo);
            renderUI();
          })
          .catch((err: any) => {
            console.error('Error getting object info:', err);
            renderUI();
          });
      }
    });

    renderUI();
    console.log('Widget initialized and connected to StreamBIM');
  } catch (error) {
    app.innerHTML = `
      <div style="padding: 20px; color: #d32f2f;">
        <h1>Error Initializing Widget</h1>
        <p style="margin: 8px 0;">${error instanceof Error ? error.message : 'Unknown error'}</p>
        <p style="margin: 8px 0; font-size: 12px; color: #999;">Check browser console for more details</p>
      </div>
    `;
    console.error('Widget initialization failed:', error);
  }
}

main();
