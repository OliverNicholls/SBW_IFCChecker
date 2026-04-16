declare module 'streambim-widget-api' {
  interface PickedObjectData {
    guid: string;
    position: [number, number, number];
  }

  interface ObjectSearchQuery {
    rules?: Array<{
      psetName?: string;
      propKey?: string;
      value?: any;
    }>;
    paging?: {
      pageSize?: number;
      pageIndex?: number;
    };
    sorting?: Array<{
      prop: string;
      ascending?: boolean;
    }>;
  }

  interface ObjectInfo {
    [key: string]: any;
    guid?: string;
    properties?: Record<string, any>;
    ifcProperties?: Record<string, any>;
  }

  interface StreamBIMCallbacks {
    pickedObject?: (data: PickedObjectData) => void;
    spacesChanged?: (spaces: string[]) => void;
    cameraChanged?: (camera: any) => void;
  }

  interface StreamBIMAPI {
    connectToParent(window: Window, callbacks: StreamBIMCallbacks): Promise<StreamBIMAPI>;
    connectToChild(iframe: HTMLIFrameElement, callbacks: any): Promise<any>;
    getObjectInfo(guid: string): Promise<ObjectInfo>;
    getObjectInfoForSearch(query: ObjectSearchQuery): Promise<ObjectInfo[]>;
    applyObjectSearch(query: ObjectSearchQuery, replace?: boolean): Promise<any>;
    highlightObject(guid: string): Promise<void>;
    deHighlightObject(guid: string): Promise<void>;
    deHighlightAllObjects(): Promise<void>;
    findObjects(query: ObjectSearchQuery): Promise<string[]>;
    valuesForObjectProperty(prop: string): Promise<any[]>;
  }

  const StreamBIM: {
    connectToParent(window: Window, callbacks: StreamBIMCallbacks): Promise<StreamBIMAPI>;
    connectToChild(iframe: HTMLIFrameElement, callbacks: any): Promise<any>;
  };

  export default StreamBIM;
}
