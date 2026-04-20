export interface StreamBIMObject {
  guid: string;
  name?: string;
  type?: string;
}

export class StreamBIMIntegration {
  private api: any = null;
  private highlightedGuids: Set<string> = new Set();
  private selectedGuids: Set<string> = new Set();
  private onObjectPicked: ((guid: string) => void) | null = null;
  private onSelectionChanged: ((guids: string[]) => void) | null = null;

  async initialize(): Promise<boolean> {
    try {
      const StreamBIM = (window as any).StreamBIM || {};
      this.api = await StreamBIM.createStreamBIMAPI?.();

      if (!this.api) {
        console.warn('StreamBIM API not available - widget is not embedded in StreamBIM');
        return false;
      }

      this.setupCallbacks();
      console.log('StreamBIM API initialized successfully');
      return true;
    } catch (error) {
      console.warn('StreamBIM not available (running outside StreamBIM):', error);
      return false;
    }
  }

  private setupCallbacks(): void {
    if (!this.api) return;

    // Handle object picking from StreamBIM UI
    if (this.api.pickedObject) {
      this.api.pickedObject = (data: any) => {
        const guid = data?.guid || data?.id;
        if (guid) {
          if (this.selectedGuids.has(guid)) {
            this.selectedGuids.delete(guid);
          } else {
            this.selectedGuids.add(guid);
          }
          this.onObjectPicked?.(guid);
          this.onSelectionChanged?.(Array.from(this.selectedGuids));
        }
      };
    }
  }

  async highlightObjects(guids: string[]): Promise<void> {
    if (!this.api) return;

    this.highlightedGuids = new Set(guids);

    try {
      // Update highlighted objects in StreamBIM
      if (this.api.highlightedObjects !== undefined) {
        this.api.highlightedObjects = guids;
      }
    } catch (error) {
      console.warn('Failed to highlight objects in StreamBIM:', error);
    }
  }

  async clearHighlight(): Promise<void> {
    this.highlightedGuids.clear();
    await this.highlightObjects([]);
  }

  setOnObjectPicked(callback: (guid: string) => void): void {
    this.onObjectPicked = callback;
  }

  setOnSelectionChanged(callback: (guids: string[]) => void): void {
    this.onSelectionChanged = callback;
  }

  getSelectedGuids(): string[] {
    return Array.from(this.selectedGuids);
  }

  clearSelection(): void {
    this.selectedGuids.clear();
    this.onSelectionChanged?.(Array.from(this.selectedGuids));
  }

  isAvailable(): boolean {
    return this.api !== null;
  }

  getHighlightedGuids(): string[] {
    return Array.from(this.highlightedGuids);
  }
}
