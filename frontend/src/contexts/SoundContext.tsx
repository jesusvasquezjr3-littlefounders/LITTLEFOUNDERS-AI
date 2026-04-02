import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Howl, Howler } from 'howler';
import { resolveAudioSrc } from '@/lib/assets';

// Define sound types based on our design
type SoundType =
    | 'ui_tap'
    | 'ui_toggle'
    | 'nav_slide'
    | 'auth_success'
    | 'auth_error'
    | 'auth_bye'
    | 'edu_success'
    | 'edu_error'
    | 'edu_complete'
    | 'edu_unlock';

interface SoundContextType {
    playSound: (type: SoundType) => void;
    playFile: (path: string) => void;
    mute: boolean;
    toggleMute: () => void;
    volume: number;
    setVolume: (vol: number) => void;
    playBGM: (path: string, options?: { volume?: number }) => void;
    stopBGM: (options?: { fade?: boolean, fadeDuration?: number }) => void;
    pauseBGM: () => void;
    resumeBGM: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

// Map SoundTypes to file paths
const SOUND_MAP: Record<SoundType, string> = {
    ui_tap: '/sounds/ui/tap.mp3',
    ui_toggle: '/sounds/ui/toggle.mp3',
    nav_slide: '/sounds/ui/tap.mp3', // Reusing tap as requested
    auth_success: '/sounds/auth/success.mp3',
    auth_error: '/sounds/auth/error.mp3',
    auth_bye: '/sounds/auth/bye.mp3',
    edu_success: '/sounds/edu/success.mp3',
    edu_error: '/sounds/edu/error.mp3',
    edu_complete: '/sounds/edu/lesson_complete.mp3',
    edu_unlock: '/sounds/edu/unlock.mp3',
};

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mute, setMute] = useState(() => {
        const stored = localStorage.getItem('sound_muted');
        return stored ? JSON.parse(stored) : false;
    });

    const [volume, setVolumeState] = useState(0.5);
    // Cache Howl instances
    const howls = useRef<Record<string, Howl>>({});

    useEffect(() => {
        Howler.mute(mute);
        localStorage.setItem('sound_muted', JSON.stringify(mute));
    }, [mute]);

    useEffect(() => {
        Howler.volume(volume);
    }, [volume]);

    const setVolume = (vol: number) => {
        setVolumeState(vol);
        Howler.volume(vol);
    };

    const toggleMute = () => {
        setMute((prev: boolean) => !prev);
    };

    const getHowl = useCallback((src: string) => {
        if (!howls.current[src]) {
            howls.current[src] = new Howl({
                src: [src],
                preload: true,
                volume: 1.0,
            });
        }
        return howls.current[src];
    }, []);

    const playSound = useCallback((type: SoundType) => {
        if (mute) return;
        const src = SOUND_MAP[type];
        if (src) {
            const sound = getHowl(src);
            sound.play();
        }
    }, [mute, getHowl]);

    // Cache for Howl instances keyed by bucket path (separate from local sound cache)
    const assetHowls = useRef<Record<string, Howl>>({});

    const playFile = useCallback((path: string) => {
        if (mute) return;
        // Local sounds (start with /) bypass signed URL resolution
        if (path.startsWith('/') || path.startsWith('http') || path.startsWith('blob:')) {
            getHowl(path).play();
            return;
        }
        // Supabase bucket path — resolve to signed URL first
        resolveAudioSrc(path).then((src) => {
            if (!assetHowls.current[path]) {
                assetHowls.current[path] = new Howl({ src: [src], preload: true, volume: 1.0 });
            }
            assetHowls.current[path].play();
        }).catch((err) => console.error('[SoundContext] playFile error:', path, err));
    }, [mute, getHowl]);

    // Preload UI sounds on mount
    useEffect(() => {
        getHowl(SOUND_MAP['ui_tap']);
        getHowl(SOUND_MAP['auth_success']);
        getHowl(SOUND_MAP['edu_success']);
    }, [getHowl]);

    // BGM Ref
    const bgmRef = useRef<Howl | null>(null);

    const playBGM = useCallback((path: string, options?: { volume?: number }) => {
        // Note: We do NOT check mute here. We want the BGM object to exist
        // so we can unmute it later if the user toggles sound.

        // Stop previous BGM if any
        if (bgmRef.current) {
            bgmRef.current.stop();
            bgmRef.current = null;
        }

        resolveAudioSrc(path).then((src) => {
            const bgm = new Howl({
                src: [src],
                loop: true,
                volume: options?.volume || 0.1,
                onloaderror: (_id, err) => console.error('BGM Load Error:', err),
            });
            bgmRef.current = bgm;
            bgm.play();
        }).catch((err) => console.error('[SoundContext] playBGM error:', path, err));
    }, []); // No dependency on mute.

    const stopBGM = useCallback((options?: { fade?: boolean, fadeDuration?: number }) => {
        if (!bgmRef.current) return;

        const currentBgm = bgmRef.current;

        if (options?.fade) {
            const duration = options.fadeDuration || 1000;
            // Fade out
            currentBgm.fade(currentBgm.volume(), 0, duration);
            setTimeout(() => {
                // Only stop if it's still the same BGM instance
                if (bgmRef.current === currentBgm) {
                    currentBgm.stop();
                    bgmRef.current = null;
                }
            }, duration);
        } else {
            currentBgm.stop();
            if (bgmRef.current === currentBgm) {
                bgmRef.current = null;
            }
        }
    }, []);

    const pauseBGM = useCallback(() => {
        bgmRef.current?.pause();
    }, []);

    const resumeBGM = useCallback(() => {
        // Only resume if not globally muted
        if (!mute && bgmRef.current && !bgmRef.current.playing()) {
            bgmRef.current.play();
        }
    }, [mute]);

    // Handle mute changes for BGM
    useEffect(() => {
        // If we have an active BGM track
        if (bgmRef.current) {
            if (mute) {
                bgmRef.current.mute(true);
            } else {
                bgmRef.current.mute(false);
                // Ensure it's playing if we just unmuted (and it wasn't stopped)
                // Note: checking 'playing()' might be false if it was blocked by autoplay
                // simply calling play() again is safe in Howler
                if (!bgmRef.current.playing()) {
                    bgmRef.current.play();
                }
            }
        }
    }, [mute]);

    // Handle global volume changes for BGM (relative to BGM volume)
    useEffect(() => {
        // Logic could be added here if we want global volume to affect BGM
        // For now, BGM has its own set volume on play
    }, [volume]);

    // Cleanup
    useEffect(() => {
        return () => {
            bgmRef.current?.stop();
        }
    }, []);

    return (
        <SoundContext.Provider value={{ playSound, playFile, mute, toggleMute, volume, setVolume, playBGM, stopBGM, pauseBGM, resumeBGM }}>
            {children}
        </SoundContext.Provider>
    );
};

export const useSound = () => {
    const context = useContext(SoundContext);
    if (context === undefined) {
        throw new Error('useSound must be used within a SoundProvider');
    }
    return context;
};
