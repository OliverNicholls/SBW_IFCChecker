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
      console.log('StreamBIM initialization: waiting for API injection...');

      // Wait for StreamBIM API to be injected (max 5 seconds)
      const StreamBIM = await this.waitForAPI(5000);
      if (!StreamBIM) {
        console.warn('StreamBIM API not injected - widget is not embedded in StreamBIM or API injection failed');
        return false;
      }

      console.log('✓ StreamBIM API found, available methods:', Object.keys(StreamBIM));

      // Try connectToParent first (for widget embedded in StreamBIM iframe)
      const connectMethod = StreamBIM.connectToParent || StreamBIM.connect;
      if (!connectMethod) {
        console.error('No connection method available on StreamBIM API');
        return false;
      }

      const connectMethodName = StreamBIM.connectToParent ? 'connectToParent' : 'connect';
      console.log(`Connecting via: ${connectMethodName}`);

      try {
        // Define all callbacks upfront
        const callbacks = {
          pickedObject: (result: any) => {
            console.log('Object picked:', result);
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
          },
          spacesChanged: (guids: string[]) => {
            console.log('Spaces changed:', guids);
            this.onSelectionChanged?.(guids);
          },
          cameraChanged: (state: any) => {
            console.log('Camera changed:', state);
          }
        };

        // Try connect() first (standard Penpal pattern), fall back to connectToParent
        console.log('Attempting to establish connection...');
        if (typeof StreamBIM.connect === 'function') {
          console.log('Using connect() method');
          await StreamBIM.connect(callbacks);
        } else if (typeof StreamBIM.connectToParent === 'function') {
          console.log('Using connectToParent() method');
          await StreamBIM.connectToParent(callbacks);
        } else {
          console.error('No suitable connection method found');
          return false;
        }

        this.api = StreamBIM;
        this.connected = true;
        console.log('✓ StreamBIM API connected successfully');
        return true;
      } catch (connectError) {
        console.error('❌ Failed to connect to StreamBIM:', connectError);
        return false;
      }
    } catch (error) {
      console.error('StreamBIM initialization error:', error);
      return false;
    }
  }

  private waitForAPI(timeoutMs: number): Promise<any> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = 100; // Check every 100ms

      const checkAPI = () => {
        const StreamBIM = (window as any).StreamBIM;
        if (StreamBIM) {
          resolve(StreamBIM);
          return;
        }

        if (Date.now() - startTime >= timeoutMs) {
          console.warn(`API injection timeout after ${timeoutMs}ms`);
          resolve(null);
          return;
        }

        setTimeout(checkAPI, checkInterval);
      };

      checkAPI();
    });
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

  onObjectPickedCallback(callback: (guid: string) => void): void {
    this.onObjectPicked = callback;
  }

  onSelectionChangedCallback(callback: (guids: string[]) => void): void {
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
