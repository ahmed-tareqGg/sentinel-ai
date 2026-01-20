import { useEffect, useState } from "react";

/**
 * Live Logs pause/resume is FRONTEND ONLY.
 * - Stored in localStorage per browser
 * - Defaults to live=true
 */
export function useLiveLogsPauseState() {
  const [isLive, setIsLive] = useState<boolean>(() => {
    const saved = localStorage.getItem("live_logs_is_live");
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem("live_logs_is_live", JSON.stringify(isLive));
  }, [isLive]);

  const toggleLive = () => {
    setIsLive((v) => !v);
  };

  return {
    isLive,
    isLoading: false,
    error: null as string | null,
    toggleLive,
  };
}

