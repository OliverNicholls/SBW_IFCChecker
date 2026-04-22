declare module 'streambim-widget-api' {
  export function connectToParent(): Promise<any>;
  export function connectToChild(iframe: HTMLIFrameElement): Promise<any>;
  export function connectToWindow(window: Window): Promise<any>;
}
