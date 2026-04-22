const app = document.getElementById('app')!;
let selectedElements: Map<string, any> = new Map();
let selectedObjectInfoMap: Map<string, any> = new Map();
let activeTab: 'properties' | 'checks' = 'properties';
let expandedGroups: Set<string> = new Set();

function toggleGroup(groupId: string) {
  if (expandedGroups.has(groupId)) {
    expandedGroups.delete(groupId);
  } else {
    expandedGroups.add(groupId);
  }
  renderUI();
}

function switchTab(tab: 'properties' | 'checks') {
  activeTab = tab;
  renderUI();
}

function renderUI() {
  app.innerHTML = `
    <div style="padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; height: 100vh;">
      <h1 style="margin: 0 0 20px 0; font-size: 24px;">StreamBIM Element Inspector</h1>

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

  // Attach event handlers using addEventListener
  const tabButtons = app.querySelectorAll('[data-tab]');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tab = (button as HTMLButtonElement).dataset.tab as 'properties' | 'checks';
      switchTab(tab);
    });
  });

  const groupButtons = app.querySelectorAll('[data-group-id]');
  groupButtons.forEach(button => {
    button.addEventListener('click', () => {
      const groupId = (button as HTMLButtonElement).dataset.groupId;
      if (groupId) toggleGroup(groupId);
    });
  });
}

function renderPropertiesTab(): string {
  if (selectedElements.size === 0) {
    return '<div style="color: #999; padding: 16px; text-align: center;">Click on an element in StreamBIM to inspect it</div>';
  }

  return `
    <div style="margin-bottom: 16px;">
      <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #333;">Selected Elements (${selectedElements.size})</h2>
    </div>
    ${Array.from(selectedElements.entries()).map(([guid]: [string, any]) => {
      const objInfo = selectedObjectInfoMap.get(guid);
      return `
        <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #ddd;">
          <div style="margin-bottom: 12px; padding: 10px 12px; background: #f0f0f0; border-radius: 4px;">
            <strong style="color: #0066cc; font-size: 14px;">Element ${selectedElements.size > 1 ? '(' + Array.from(selectedElements.keys()).indexOf(guid) + 1 + ')' : ''}</strong>
            <div style="color: #666; font-size: 11px; margin-top: 4px; font-family: monospace;">GUID: ${guid}</div>
          </div>
          ${renderElementProperties(objInfo)}
        </div>
      `;
    }).join('')}
  `;
}

function renderElementProperties(objInfo: any): string {
  if (!objInfo) return '<div style="color: #999;">No information available</div>';

  let html = '';
  let groupIndex = 0;

  // Check if data has groups structure
  if (Array.isArray(objInfo.groups)) {
    html += objInfo.groups.map((group: any) => {
      const groupId = `group-${groupIndex++}`;
      const isExpanded = expandedGroups.has(groupId);
      const props = group.content?.properties || [];
      return `
        <div style="margin-bottom: 12px;">
          <button data-group-id="${groupId}" style="width: 100%; padding: 10px 12px; background: #e8f4f8; border: 1px solid #0066cc; border-left: 4px solid #0066cc; border-radius: 2px; cursor: pointer; text-align: left; font-size: 13px; color: #0066cc; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
            <span>${group.label} (${props.length})</span>
            <span style="transform: rotate(${isExpanded ? '180deg' : '0deg'}); transition: transform 0.2s;">▼</span>
          </button>
          ${isExpanded ? `
            <div style="padding: 8px; border-left: 2px solid #e0e0e0; margin-top: 4px;">
              ${props.map((prop: any) => `
                <div style="margin-bottom: 8px; padding: 6px 8px; background: #fafafa; border-radius: 3px; font-size: 12px;">
                  <div style="margin-bottom: 2px;">
                    <strong style="color: #333;">${prop.key}:</strong>
                    <span style="color: #0066cc; font-family: monospace;">${formatValue(prop.value, prop.unit)}</span>
                  </div>
                  ${prop.measure ? `<div style="color: #999; font-size: 11px;">📏 ${prop.measure}${prop.unit ? ' (' + prop.unit + ')' : ''}</div>` : ''}
                  ${prop.valueType ? `<div style="color: #999; font-size: 11px;">Type: ${prop.valueType}</div>` : ''}
                </div>
              `).join('')}
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
  return '<div style="color: #999; padding: 16px; text-align: center;">Checks will be available soon</div>';
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
  app.addEventListener('click', (e) => {
    e.stopPropagation();
  }, true);
}

async function main() {
  try {
    app.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #666;">
        <p>Initializing widget...</p>
      </div>
    `;

    // Prevent clicks from propagating to parent
    setupGlobalClickHandler();

    // Load StreamBIM library
    const StreamBIM = await loadStreamBIMLibrary();

    // Connect to parent StreamBIM instance
    await StreamBIM.connect({
      pickedObject: (element: any) => {
        console.log('Element selected:', element);

        // If Shift is not held, clear previous selections
        if (!element.shiftKey) {
          selectedElements.clear();
          selectedObjectInfoMap.clear();
        }

        // Add or replace the selection
        selectedElements.set(element.guid, element);

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
