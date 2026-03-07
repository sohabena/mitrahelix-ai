interface VSCodeAPI {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeAPI;

let api: VSCodeAPI | undefined;

function getApi(): VSCodeAPI {
  if (!api) {
    api = acquireVsCodeApi();
  }
  return api;
}

export function postMessage(message: unknown): void {
  getApi().postMessage(message);
}

export function getState<T>(): T | undefined {
  return getApi().getState() as T | undefined;
}

export function setState<T>(state: T): void {
  getApi().setState(state);
}

export function onMessage(callback: (message: unknown) => void): () => void {
  const handler = (event: MessageEvent) => {
    callback(event.data);
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
