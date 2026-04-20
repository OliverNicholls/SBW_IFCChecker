declare module 'streambim-widget-api' {
  export interface PickedObjectData {
    guid?: string;
    id?: string;
    coordinate?: { x: number; y: number; z: number };
  }

  export interface StreamBIMAPI {
    highlightedObjects?: string[];
    pickedObject?: (data: PickedObjectData) => void;
    spacesChanged?: (guids: string[]) => void;
    cameraChanged?: (camera: any) => void;
  }

  export function createStreamBIMAPI(): Promise<StreamBIMAPI | null>;
}
