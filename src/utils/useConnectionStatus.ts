import { useState, useEffect } from 'react';
import { ConnectionStatus, api } from '../lib/storage';

export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(api.getConnectionStatus);

  useEffect(() => {
    const unsubscribe = api.subscribeToConnectionStatus((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  return status;
}
