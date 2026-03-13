import { useNavigate } from 'react-router';

export function useSafeBack(fallbackPath: string) {
  const navigate = useNavigate();

  return () => {
    if (typeof window !== 'undefined') {
      const historyState = window.history.state as { idx?: number } | null;
      if (typeof historyState?.idx === 'number' && historyState.idx > 0) {
        navigate(-1);
        return;
      }
    }

    navigate(fallbackPath, { replace: true });
  };
}
