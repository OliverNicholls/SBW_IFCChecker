const app = document.getElementById('app')!;
let selectedElements: Map<string, any> = new Map();
let selectedObjectInfoMap: Map<string, any> = new Map();
let parentFileInfo: any = null;
let visibleModels: Map<string, any> = new Map();

function renderUI() {
  app.innerHTML = `
    <div style="padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <h1 style="margin: 0 0 20px 0; font-size: 24px;">StreamBIM Element Inspector</h1>

      <div style="background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        ${selectedElements.size > 0 ? `
          <div style="margin-bottom: 16px;">
            <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #333;">Selected Elements (${selectedElements.size})</h2>
            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 14px;">
              ${Array.from(selectedElements.entries()).map(([guid]: [string, any]) => {
                const objInfo = selectedObjectInfoMap.get(guid);
                const props = objInfo?.properties || {};
                const propKeys = Object.keys(props);
                return `
                  <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #ddd;">
                    <div style="font-family: monospace; overflow-x: auto; font-size: 13px;">
                      <strong style="color: #0066cc;">GUID:</strong> ${guid}<br>
                      ${objInfo?.layer ? `<strong>Layer:</strong> ${objInfo.layer}<br>` : ''}
                      ${propKeys.length > 0 ? `<strong style="display: block; margin-top: 8px;">IFC Properties:</strong>` : ''}
                      ${propKeys.map(key => `<div style="margin-left: 8px; margin-top: 4px;"><strong>${key}:</strong> ${props[key] || 'N/A'}</div>`).join('')}
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

        ${parentFileInfo ? `
          <div style="border-top: 1px solid #eee; padding-top: 16px;">
            <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #333;">Parent File</h2>
            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 14px;">
              <strong>Name:</strong> <span style="color: #0066cc;">${parentFileInfo.name || 'N/A'}</span><br>
              <strong>Path:</strong> <span style="word-break: break-all; color: #666;">${parentFileInfo.path || 'N/A'}</span><br>
              ${parentFileInfo.id ? `<strong>ID:</strong> ${parentFileInfo.id}` : ''}
            </div>
          </div>
        ` : ''}

        ${visibleModels.size > 0 ? `
          <div style="border-top: 1px solid #eee; padding-top: 16px;">
            <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #333;">Visible Models (${visibleModels.size})</h2>
            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 14px;">
              ${Array.from(visibleModels.values()).map((model: any) => `
                <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #ddd;">
                  <strong style="color: #0066cc;">${model.name || 'Unknown'}</strong><br>
                  <span style="color: #666; font-size: 13px;">${model.path || 'N/A'}</span>
                  ${model.id ? `<br><span style="color: #999; font-size: 12px;">ID: ${model.id}</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
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
            console.log('Object info:', objectInfo);
            selectedObjectInfoMap.set(element.guid, objectInfo);

            // Try to get parent file information
            if (StreamBIM.getParentFile) {
              return StreamBIM.getParentFile(element.guid).then((file: any) => {
                console.log('Parent file:', file);
                parentFileInfo = file;
                const modelKey = file?.id || file?.name || JSON.stringify(file);
                if (file && modelKey) {
                  visibleModels.set(modelKey, file);
                  console.log('Added to visible models:', modelKey, 'Total:', visibleModels.size);
                }
                renderUI();
              });
            } else {
              renderUI();
            }
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
