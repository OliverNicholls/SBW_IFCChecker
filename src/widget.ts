import { IDSValidator } from './validator';

export class IDSCheckWidget {
  private container: HTMLElement;
  private validator: IDSValidator;

  constructor() {
    this.validator = new IDSValidator();
    this.container = this.createContainer();
    this.setupEventListeners();
  }

  private createContainer(): HTMLElement {
    const container = document.getElementById('app') || document.body;
    container.innerHTML = `
      <div class="ids-widget">
        <h1>IDS Checker</h1>
        <div class="widget-content">
          <div class="upload-section">
            <h2>Upload Files</h2>
            <div class="file-input-group">
              <input
                type="file"
                id="ifc-input"
                accept=".ifc,.ifcjson,.json"
                class="file-input"
              >
              <label for="ifc-input" class="file-label">IFC Model</label>
            </div>
            <div class="file-input-group">
              <input
                type="file"
                id="ids-input"
                accept=".ids,.xml"
                class="file-input"
              >
              <label for="ids-input" class="file-label">IDS Specification</label>
            </div>
            <button id="validate-btn" class="btn-validate">Validate</button>
          </div>
          <div class="results-section">
            <h2>Validation Results</h2>
            <div id="results" class="results-container"></div>
          </div>
        </div>
      </div>
      <style>
        .ids-widget {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .widget-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .upload-section, .results-section {
          padding: 16px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
        }
        .file-input-group {
          margin: 12px 0;
          display: flex;
          flex-direction: column;
        }
        .file-input {
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        .file-label {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }
        .btn-validate {
          margin-top: 16px;
          padding: 8px 16px;
          background: #0066cc;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-validate:hover {
          background: #0052a3;
        }
        .results-container {
          min-height: 100px;
          padding: 12px;
          background: #f5f5f5;
          border-radius: 4px;
        }
        .result-item {
          margin: 8px 0;
          padding: 8px;
          background: white;
          border-left: 4px solid #ccc;
          border-radius: 2px;
        }
        .result-item.success {
          border-left-color: #00aa00;
        }
        .result-item.warning {
          border-left-color: #ff9800;
        }
        .result-item.error {
          border-left-color: #f44336;
        }
      </style>
    `;
    return container;
  }

  private setupEventListeners(): void {
    const validateBtn = document.getElementById('validate-btn');
    const ifcInput = document.getElementById('ifc-input') as HTMLInputElement;
    const idsInput = document.getElementById('ids-input') as HTMLInputElement;

    validateBtn?.addEventListener('click', () => this.handleValidation(ifcInput, idsInput));
  }

  private async handleValidation(ifcInput: HTMLInputElement, idsInput: HTMLInputElement): Promise<void> {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    if (!ifcInput.files?.[0] || !idsInput.files?.[0]) {
      resultsDiv.innerHTML = '<div class="result-item error">Please upload both IFC and IDS files</div>';
      return;
    }

    try {
      resultsDiv.innerHTML = '<div class="result-item">Validating...</div>';
      const results = await this.validator.validate(ifcInput.files[0], idsInput.files[0]);
      this.displayResults(results, resultsDiv);
    } catch (error) {
      resultsDiv.innerHTML = `<div class="result-item error">Error: ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
    }
  }

  private displayResults(results: any, container: HTMLElement): void {
    const html = `
      <div class="result-summary">
        <p>Status: ${results.pass ? 'PASS' : 'FAIL'}</p>
        <p>Total Checks: ${results.totalChecks || 0}</p>
      </div>
      ${(results.failures || []).map((failure: any) => `
        <div class="result-item error">
          <strong>FAIL:</strong> ${failure.message}
        </div>
      `).join('')}
      ${(results.warnings || []).map((warning: any) => `
        <div class="result-item warning">
          <strong>WARNING:</strong> ${warning.message}
        </div>
      `).join('')}
    `;
    container.innerHTML = html;
  }
}
