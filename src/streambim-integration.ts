export interface StreamBIMObjectData {
  guid: string;
  name?: string;
  type?: string;
  properties: Record<string, any>;
}

export class StreamBIMIntegration {
  private api: any = null;
  private connected: boolean = false;
  private selectedGuids: Set<string> = new Set();
  private onObjectPicked: ((guid: string) => void) | null = null;
  private onSelectionChanged: ((guids: string[]) => void) | null = null;

  async initialize(): Promise<boolean> {
    try {
      // Wait for StreamBIM to be available (up to 3 seconds)
      let StreamBIM = (window as any).StreamBIM;
      let attempts = 0;
      while (!StreamBIM && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 100));
        StreamBIM = (window as any).StreamBIM;
        attempts++;
      }

      if (!StreamBIM) {
        console.warn('StreamBIM not available - widget is not embedded in StreamBIM');
        console.warn('window.StreamBIM is undefined');
        return false;
      }

      console.log('StreamBIM API found, attempting connection...');
      await StreamBIM.connectToParent(window, {
        pickedObject: (result: any) => {
          const guid = result?.guid || result?.id;
          if (guid) {
            if (this.selectedGuids.has(guid)) {
              this.selectedGuids.delete(guid);
            } else {
              this.selectedGuids.add(guid);
            }
            this.onObjectPicked?.(guid);
            this.onSelectionChanged?.(Array.from(this.selectedGuids));
          }
        }
      });
      this.api = StreamBIM;
      this.connected = true;
      console.log('StreamBIM API connected successfully');
      return true;
    } catch (error) {
      console.warn('StreamBIM not available (running outside StreamBIM):', error);
      return false;
    }
  }

  async getObjectInfo(guid: string): Promise<StreamBIMObjectData> {
    if (!this.api) throw new Error('StreamBIM not connected');
    const info = await this.api.getObjectInfo(guid);
    return {
      guid,
      name: info.name,
      type: info.type,
      properties: info.properties || {}
    };
  }

  async getObjectsInfo(guids: string[]): Promise<StreamBIMObjectData[]> {
    if (!this.api) throw new Error('StreamBIM not connected');
    return Promise.all(guids.map(guid => this.getObjectInfo(guid)));
  }

  async getAllObjects(): Promise<StreamBIMObjectData[]> {
    if (!this.api) throw new Error('StreamBIM not connected');
    const results = await this.api.getObjectInfoForSearch({
      page: { limit: 5000, skip: 0 }
    });
    return results.map((r: any) => ({
      guid: r.guid,
      name: r.name,
      type: r.type,
      properties: r.properties || {}
    }));
  }

  async highlightObjects(guids: string[]): Promise<void> {
    if (!this.api) return;
    try {
      await this.api.deHighlightAllObjects();
      await Promise.all(guids.map(guid => this.api.highlightObject(guid)));
    } catch (error) {
      console.warn('Failed to highlight objects:', error);
    }
  }

  async clearHighlight(): Promise<void> {
    if (!this.api) return;
    try {
      await this.api.deHighlightAllObjects();
    } catch (error) {
      console.warn('Failed to clear highlight:', error);
    }
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
    return this.connected && this.api !== null;
  }
}
