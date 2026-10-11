import { createContext, useContext } from 'react';

interface ToastApi {
  notify: (message: string) => void;
}

// Outside a provider (a component rendered alone in a test), notifying does nothing.
export const ToastContext = createContext<ToastApi>({ notify: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
