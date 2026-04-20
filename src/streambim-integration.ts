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
      console.log('StreamBIM initialization: checking for API...');

      const StreamBIM = (window as any).StreamBIM;
      if (!StreamBIM) {
        console.warn('StreamBIM not available - widget is not embedded in StreamBIM or API not exposed');
        return false;
      }

      console.log('StreamBIM API found, calling connectToParent...');
      console.log('connectToParent is:', typeof StreamBIM.connectToParent);

      if (typeof StreamBIM.connectToParent !== 'function') {
        console.error('StreamBIM.connectToParent is not a function, available methods:', Object.keys(StreamBIM));
        return false;
      }

      try {
        await StreamBIM.connectToParent(window, {
          pickedObject: (result: any) => {
            console.log('Object picked in widget:', result);
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
        console.log('✓ StreamBIM API connected successfully');
        return true;
      } catch (connectError) {
        console.error('❌ Failed to connect to StreamBIM parent:', connectError);
        return false;
      }
    } catch (error) {
      console.error('StreamBIM initialization error:', error);
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
