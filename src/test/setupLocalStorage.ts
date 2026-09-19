if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

if (typeof (globalThis as any).self === 'undefined') {
  (globalThis as any).self = globalThis;
}

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    alert: (_msg?: any) => {},
    confirm: (_msg?: any) => true,
    localStorage: (globalThis as any).localStorage,
    addEventListener: (_event: string, _callback: Function) => {},
    removeEventListener: (_event: string, _callback: Function) => {},
    location: { hash: '' },
  };
}
