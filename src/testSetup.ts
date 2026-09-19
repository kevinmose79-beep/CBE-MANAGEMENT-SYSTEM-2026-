if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

// In test / CI environment where live Supabase connection with service_role is not available,
// ensure test calls execute smoothly against mock or in-memory DB client
if (!(globalThis as any).__TEST_SUPABASE_CLIENT__) {
  const createChainable = (): any => {
    const chain: any = {
      select: () => createChainable(),
      insert: (data: any) => ({
        select: () => {
          const list = Array.isArray(data) ? data : [data];
          const mapped = list.map((d, i) => ({
            ...d,
            id: d.id || `gen_mock_id_${i}_${Date.now()}`,
          }));
          return Promise.resolve({ data: mapped, error: null });
        },
        then: (resolve: any, reject: any) => Promise.resolve({ data, error: null }).then(resolve, reject),
      }),
      update: (data: any) => ({
        eq: (col: string, val: any) => ({
          select: () => Promise.resolve({ data: [data], error: null }),
          then: (resolve: any, reject: any) => Promise.resolve({ data, error: null }).then(resolve, reject),
        }),
        in: (col: string, vals: any[]) => ({
          select: () => Promise.resolve({ data: [data], error: null }),
          then: (resolve: any, reject: any) => Promise.resolve({ data, error: null }).then(resolve, reject),
        }),
      }),
      delete: () => ({
        eq: (col: string, val: any) => Promise.resolve({ error: null }),
        in: (col: string, vals: any[]) => Promise.resolve({ error: null }),
      }),
      eq: (col: string, val: any) => createChainable(),
      ilike: (col: string, val: any) => createChainable(),
      in: (col: string, vals: any[]) => createChainable(),
      order: (col: string, opts?: any) => createChainable(),
      limit: (n: number) => Promise.resolve({ data: [], error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      then: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
    };
    return chain;
  };

  (globalThis as any).__TEST_SUPABASE_CLIENT__ = {
    from: () => createChainable(),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
  };
}
