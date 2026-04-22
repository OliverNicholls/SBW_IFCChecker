const app = document.getElementById('app')!;
let selectedElements: Map<string, any> = new Map();
let selectedObjectInfoMap: Map<string, any> = new Map();

function renderUI() {
  app.innerHTML = `
    <div style="padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; height: 100vh;">
      <h1 style="margin: 0 0 20px 0; font-size: 24px;">StreamBIM Element Inspector</h1>

      <div style="background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1; overflow-y: auto;">
        ${selectedElements.size > 0 ? `
          <div style="margin-bottom: 16px;">
            <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #333;">Selected Elements (${selectedElements.size})</h2>
            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 14px;">
              ${Array.from(selectedElements.entries()).map(([guid]: [string, any]) => {
                const objInfo = selectedObjectInfoMap.get(guid);

                const formatValue = (val: any, unit?: string): string => {
                  if (val === null || val === undefined) return 'N/A';
                  if (typeof val === 'object') return JSON.stringify(val);
                  const strVal = String(val);
                  return unit ? `${strVal} ${unit}` : strVal;
                };

                const renderGroupedProperties = (): string => {
                  if (!objInfo) return '<div style="color: #999;">No information available</div>';

                  // Check if data has groups structure
                  if (Array.isArray(objInfo.groups)) {
                    return objInfo.groups.map((group: any) => {
                      const props = group.content?.properties || [];
                      return `
                        <div style="margin-bottom: 16px;">
                          <div style="background: #e8f4f8; padding: 10px 12px; border-left: 4px solid #0066cc; margin-bottom: 8px; border-radius: 2px;">
                            <strong style="color: #0066cc; font-size: 13px;">${group.label}</strong>
                            <span style="color: #999; font-size: 11px; margin-left: 8px;">(${props.length} properties)</span>
                          </div>
                          <div style="padding-left: 8px; border-left: 2px solid #e0e0e0;">
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
                        </div>
                      `;
                    }).join('');
                  }

                  // Fallback to flat property display
                  return Object.entries(objInfo)
                    .map(([key, value]: [string, any]) => {
                      return `
                        <div style="margin-bottom: 8px; padding: 6px 8px; background: #fafafa; border-radius: 3px;">
                          <strong style="color: #333;">${key}:</strong>
                          <span style="color: #0066cc;">${formatValue(value)}</span>
                        </div>
                      `;
                    })
                    .join('');
                };

                return `
                  <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #ddd;">
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow-x: auto;">
                      <div style="margin-bottom: 12px; padding: 10px 12px; background: #f0f0f0; border-radius: 4px;">
                        <strong style="color: #0066cc; font-size: 14px;">Element ${selectedElements.size > 1 ? '(' + Array.from(selectedElements.keys()).indexOf(guid) + 1 + ')' : ''}</strong>
                        <div style="color: #666; font-size: 11px; margin-top: 4px; font-family: monospace;">GUID: ${guid}</div>
                      </div>
                      ${renderGroupedProperties()}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : `
          <div style="color: #999; padding: 16px; text-align: center;">
            Click on an element in StreamBIM to inspect it
          </div>
        `}
      </div>

      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #eee; text-align: center;">
        <img src="./Tikab_Logo_Blue.png" alt="Tikab Logo" style="height: 40px; width: auto;">
      </div>
    </div>
  `;
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
