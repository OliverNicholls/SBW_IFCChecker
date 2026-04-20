declare module 'streambim-widget-api' {
  export interface ConnectCallbacks {
    pickedObject?: (result: { guid: string; point?: number[] }) => void;
    spacesChanged?: (guids: string[]) => void;
    cameraChanged?: (state: any) => void;
    didExpand?: () => void;
    didContract?: () => void;
  }

  export interface ObjectInfo {
    properties: Record<string, any>;
    name?: string;
    type?: string;
  }

  export interface SearchResult {
    guid: string;
    properties: Record<string, any>;
    name?: string;
    type?: string;
  }

  export interface StreamBIMAPI {
    connect(callbacks?: ConnectCallbacks): Promise<void>;
    getObjectInfo(guid: string): Promise<ObjectInfo>;
    getObjectInfoForSearch(query: any): Promise<SearchResult[]>;
    findObjects(query: any): Promise<string[]>;
    highlightObject(guid: string): Promise<void>;
    deHighlightObject(guid: string): Promise<void>;
    deHighlightAllObjects(): Promise<void>;
  }

  declare const StreamBIM: StreamBIMAPI;
  export default StreamBIM;
}
