const app = document.getElementById('app')!;
let selectedElement: any = null;
let parentFileInfo: any = null;

function renderUI() {
  app.innerHTML = `
    <div style="padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <h1 style="margin: 0 0 20px 0; font-size: 24px;">StreamBIM Element Inspector</h1>

      <div style="background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        ${selectedElement ? `
          <div style="margin-bottom: 16px;">
            <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #333;">Selected Element</h2>
            <div style="background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 14px; font-family: monospace; overflow-x: auto;">
              <strong>GlobalId:</strong> ${selectedElement.globalId || 'N/A'}<br>
              <strong>Name:</strong> ${selectedElement.name || 'N/A'}<br>
              <strong>Type:</strong> ${selectedElement.type || 'N/A'}
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

async function main() {
  try {
    app.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #666;">
        <p>Initializing widget...</p>
      </div>
    `;

    // Load StreamBIM library
    const StreamBIM = await loadStreamBIMLibrary();

    // Connect to parent StreamBIM instance
    const api = await StreamBIM.connect({
      onElementSelected: (element: any) => {
        console.log('Element selected:', element);
        selectedElement = element;

        // Try to get parent file information
        if (api.getParentFile) {
          api.getParentFile(element.globalId)
            .then((file: any) => {
              console.log('Parent file:', file);
              parentFileInfo = file;
              renderUI();
            })
            .catch((err: any) => {
              console.error('Error getting parent file:', err);
              parentFileInfo = element.file || null;
              renderUI();
            });
        } else {
          // If parent file API isn't available, extract from element if possible
          parentFileInfo = element.file || null;
          renderUI();
        }
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
