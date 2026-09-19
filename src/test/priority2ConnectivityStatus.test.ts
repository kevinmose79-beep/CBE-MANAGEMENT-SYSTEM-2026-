import { describe, it, expect, beforeEach } from 'vitest';
import './setupLocalStorage';
import { api, ConnectionStatus } from '../lib/storage';

describe('Priority 2 — Accurate Connectivity Status and Recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    api.setConnectionStatus('online');
  });

  it('should export getConnectionStatus, setConnectionStatus, and subscribeToConnectionStatus in api', () => {
    expect(typeof api.getConnectionStatus).toBe('function');
    expect(typeof api.setConnectionStatus).toBe('function');
    expect(typeof api.subscribeToConnectionStatus).toBe('function');
  });

  it('should return initial connection status and notify subscribers upon subscription', () => {
    const statuses: ConnectionStatus[] = [];
    const unsubscribe = api.subscribeToConnectionStatus((status) => {
      statuses.push(status);
    });

    expect(statuses.length).toBeGreaterThanOrEqual(1);
    expect(statuses[0]).toBe('online');
    unsubscribe();
  });

  it('should notify subscribers when connection status changes', () => {
    const statuses: ConnectionStatus[] = [];
    const unsubscribe = api.subscribeToConnectionStatus((status) => {
      statuses.push(status);
    });

    api.setConnectionStatus('offline');
    api.setConnectionStatus('reconnecting');
    api.setConnectionStatus('syncing');
    api.setConnectionStatus('realtime_unavailable');
    api.setConnectionStatus('online');

    expect(statuses).toContain('offline');
    expect(statuses).toContain('reconnecting');
    expect(statuses).toContain('syncing');
    expect(statuses).toContain('realtime_unavailable');
    expect(statuses[statuses.length - 1]).toBe('online');

    unsubscribe();
  });

  it('should not notify unsubscribed listeners', () => {
    const statuses: ConnectionStatus[] = [];
    const unsubscribe = api.subscribeToConnectionStatus((status) => {
      statuses.push(status);
    });

    api.setConnectionStatus('offline');
    unsubscribe();

    api.setConnectionStatus('online');
    expect(statuses[statuses.length - 1]).toBe('offline');
  });
});
