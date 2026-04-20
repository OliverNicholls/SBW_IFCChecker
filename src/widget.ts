import { IDSValidator } from './validator';
import { StreamBIMIntegration } from './streambim-integration';

export class IDSCheckWidget {
  private validator: IDSValidator;
  private streamBIM: StreamBIMIntegration;
  private lastValidationResult: any = null;

  constructor() {
    this.validator = new IDSValidator();
    this.streamBIM = new StreamBIMIntegration();
    this.createContainer();
    this.initializeStreamBIM();
    this.setupEventListeners();
  }

  private async initializeStreamBIM(): Promise<void> {
    const available = await this.streamBIM.initialize();
    if (available) {
      console.log('StreamBIM integration ready - object selection enabled');
      this.streamBIM.setOnObjectPicked((guid: string) => {
        this.onStreamBIMObjectPicked(guid);
      });
    }
  }

  private onStreamBIMObjectPicked(guid: string): void {
    // Highlight the picked object's validation issues
    if (this.lastValidationResult) {
      const allIssues = [...this.lastValidationResult.failures, ...this.lastValidationResult.warnings];
      const issues = allIssues.filter((issue: any) => issue.objectGuid === guid);

      if (issues.length > 0) {
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) {
          // Scroll to and highlight issues for this object
          const issueElements = resultsDiv.querySelectorAll(`[data-object-guid="${guid}"]`);
          issueElements.forEach(el => el.classList.add('highlighted'));
          issueElements[0]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }

  private createContainer(): void {
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
        .result-summary {
          margin-bottom: 20px;
          padding: 16px;
          background: white;
          border-radius: 4px;
        }
        .status-line {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 12px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          font-size: 14px;
          color: #666;
        }
        .results-group {
          margin-top: 16px;
        }
        .group-title {
          font-size: 14px;
          font-weight: 600;
          color: #333;
          margin: 12px 0 8px 0;
        }
        .result-item {
          margin: 6px 0;
          padding: 10px;
          background: white;
          border-left: 4px solid #ccc;
          border-radius: 2px;
          font-size: 13px;
          line-height: 1.4;
        }
        .result-item.success {
          border-left-color: #00aa00;
          background: #f0f8f0;
        }
        .result-item.warning {
          border-left-color: #ff9800;
          background: #fff9f0;
        }
        .result-item.error {
          border-left-color: #f44336;
          background: #fef0f0;
        }
        .rule-id {
          color: #999;
          font-size: 11px;
          margin-right: 8px;
        }
        .object-id {
          float: right;
          color: #999;
          font-size: 11px;
          background: rgba(0,0,0,0.05);
          padding: 2px 6px;
          border-radius: 2px;
        }
        .result-item.clickable {
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .result-item.clickable:hover {
          transform: translateX(4px);
          box-shadow: inset 2px 0 0 #0066cc;
        }
        .result-item.highlighted {
          background: rgba(0, 102, 204, 0.1) !important;
          border-left-width: 6px;
          border-left-color: #0066cc !important;
        }
      </style>
    `;
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
      this.lastValidationResult = results;
      this.displayResults(results, resultsDiv);

      // Highlight affected objects in StreamBIM if available
      if (this.streamBIM.isAvailable() && results.summary.affectedObjects.length > 0) {
        await this.streamBIM.highlightObjects(results.summary.affectedObjects);
      }
    } catch (error) {
      resultsDiv.innerHTML = `<div class="result-item error">Error: ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
    }
  }

  private displayResults(results: any, container: HTMLElement): void {
    const statusClass = results.pass ? 'success' : 'error';
    const statusText = results.pass ? '✓ PASSED' : '✗ FAILED';
    const streamBIMAvailable = this.streamBIM.isAvailable();

    const summaryHtml = `
      <div class="result-summary result-item ${statusClass}">
        <div class="status-line"><strong>Status:</strong> ${statusText}</div>
        <div class="stats-grid">
          <div>Total Rules: ${results.totalChecks || 0}</div>
          <div>Applicable: ${results.summary?.applicableRules || 0}</div>
          <div>Failed: ${results.summary?.failedRules || 0}</div>
          <div>Specifications: ${results.summary?.validSpecifications || 0}</div>
          ${streamBIMAvailable ? `<div>Affected Objects: ${results.summary?.affectedObjects?.length || 0}</div>` : ''}
        </div>
      </div>
    `;

    const failuresHtml = results.failures.length > 0 ? `
      <div class="results-group">
        <h3 class="group-title">Failures (${results.failures.length})</h3>
        ${results.failures.map((failure: any) => `
          <div class="result-item error ${failure.objectGuid ? 'clickable' : ''}"
               ${failure.objectGuid ? `data-object-guid="${failure.objectGuid}"` : ''}
               ${failure.objectGuid ? `title="Click to select in StreamBIM"` : ''}>
            ${failure.id ? `<span class="rule-id">[${failure.id}]</span>` : ''}
            ${failure.message}
            ${failure.objectGuid ? `<span class="object-id">(Object: ${failure.objectGuid.substring(0, 8)}...)</span>` : ''}
          </div>
        `).join('')}
      </div>
    ` : '';

    const warningsHtml = results.warnings.length > 0 ? `
      <div class="results-group">
        <h3 class="group-title">Warnings (${results.warnings.length})</h3>
        ${results.warnings.map((warning: any) => `
          <div class="result-item warning ${warning.objectGuid ? 'clickable' : ''}"
               ${warning.objectGuid ? `data-object-guid="${warning.objectGuid}"` : ''}
               ${warning.objectGuid ? `title="Click to select in StreamBIM"` : ''}>
            ${warning.id ? `<span class="rule-id">[${warning.id}]</span>` : ''}
            ${warning.message}
            ${warning.objectGuid ? `<span class="object-id">(Object: ${warning.objectGuid.substring(0, 8)}...)</span>` : ''}
          </div>
        `).join('')}
      </div>
    ` : '';

    container.innerHTML = summaryHtml + failuresHtml + warningsHtml;

    // Add click handlers for selectable issues
    if (streamBIMAvailable) {
      container.querySelectorAll('[data-object-guid]').forEach(el => {
        el.addEventListener('click', () => {
          const guid = el.getAttribute('data-object-guid');
          if (guid) {
            this.selectObjectInStreamBIM(guid);
          }
        });
      });
    }
  }

  private async selectObjectInStreamBIM(guid: string): Promise<void> {
    if (this.streamBIM.isAvailable()) {
      await this.streamBIM.highlightObjects([guid]);
    }
  }
}
