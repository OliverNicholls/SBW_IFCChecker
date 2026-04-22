declare const StreamBIM: any;

const app = document.getElementById('app')!;

async function main() {
  try {
    // Connect to parent StreamBIM instance
    const api = await StreamBIM.connect({
      // Define your widget methods here if needed
    });

    // Initialize your widget here
    app.innerHTML = `
      <div style="padding: 20px;">
        <h1>StreamBIM Widget Template</h1>
        <p>Connected to StreamBIM</p>
      </div>
    `;

    console.log('Widget initialized and connected to StreamBIM', api);
  } catch (error) {
    app.innerHTML = `
      <div style="padding: 20px; color: red;">
        <h1>Error</h1>
        <p>Failed to connect to StreamBIM: ${error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    `;
    console.error('Widget initialization failed:', error);
  }
}

main();
