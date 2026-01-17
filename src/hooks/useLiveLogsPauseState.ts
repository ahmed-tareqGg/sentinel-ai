import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/backend/client';

interface SystemSetting {
    id: string;
    key: string;
    value: boolean;
    updated_at: string;
}

export function useLiveLogsPauseState() {
    // Initialize from localStorage if available, default to true
    const [isLive, setIsLive] = useState(() => {
        const saved = localStorage.getItem('live_logs_is_live');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [isLoading, setIsLoading] = useState(false); // No loading state needed for local
    const [error, setError] = useState<string | null>(null);

    // Sync with backend on mount (optional, one-way sync for now)
    useEffect(() => {
        const fetchRemoteState = async () => {
            try {
                const { data, error } = await supabase
                    .from('system_settings')
                    .select('value')
                    .eq('key', 'live_logs_paused')
                    .maybeSingle();

                if (data && !error) {
                    const remoteLive = !data.value;
                    if (remoteLive !== isLive) {
                        setIsLive(remoteLive);
                        localStorage.setItem('live_logs_is_live', JSON.stringify(remoteLive));
                    }
                }
            } catch (e) {
                console.warn('Backend sync failed, using local state only');
            }
        };
        fetchRemoteState();
    }, []);

    const toggleLive = async () => {
        const newIsLive = !isLive;
        const pausedValue = !newIsLive;

        // Update Local State & Storage immediately
        setIsLive(newIsLive);
        localStorage.setItem('live_logs_is_live', JSON.stringify(newIsLive));

        // Try updating backend in background (fire & forget)
        try {
            await supabase
                .from('system_settings')
                .upsert({
                    key: 'live_logs_paused',
                    value: pausedValue,
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'key'
                });
        } catch (err) {
            // Silently fail for backend, keep local state
            console.warn('Failed to sync pause state to backend:', err);
        }
    };

    return {
        isLive,
        isLoading,
        error,
        toggleLive,
    };
}
