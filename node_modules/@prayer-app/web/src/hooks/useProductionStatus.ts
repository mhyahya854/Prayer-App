import type { ApiHealthResponse, RuntimeResponse } from '@prayer-app/core';
import { useEffect, useState } from 'react';

import { fetchApiHealth, fetchRuntimeStatus } from '@/src/lib/api/client';

interface ProductionStatusState {
  error: string | null;
  health: ApiHealthResponse | null;
  isLoading: boolean;
  runtime: RuntimeResponse | null;
}

export function useProductionStatus(enabled = true) {
  const [state, setState] = useState<ProductionStatusState>({
    error: null,
    health: null,
    isLoading: true,
    runtime: null,
  });
  useEffect(() => {
    if (!enabled) {
      setState({
        error: null,
        health: null,
        isLoading: false,
        runtime: null,
      });
      return;
    }

    let isMounted = true;

    async function loadStatus() {
      try {
        const [health, runtime] = await Promise.all([fetchApiHealth(), fetchRuntimeStatus()]);

        if (isMounted) {
          setState({
            error: null,
            health,
            isLoading: false,
            runtime,
          });
        }
      } catch (error) {
        if (isMounted) {
          setState({
            error: error instanceof Error ? error.message : 'Unable to reach the API.',
            health: null,
            isLoading: false,
            runtime: null,
          });
        }
      }
    }

    void loadStatus();

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  return state;
}
