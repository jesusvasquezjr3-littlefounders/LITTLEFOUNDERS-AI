import { useUserLanguage } from "@/hooks/useUserLanguage";
import { ReactNode, useEffect } from "react";

// Este componente no renderiza nada visualmente, solo ejecuta el hook de sincronización
export const LanguageSyncWrapper = ({ children }: { children: ReactNode }) => {
    const { syncLanguagePreference, isAuthenticated } = useUserLanguage();

    useEffect(() => {
        if (isAuthenticated()) {
            syncLanguagePreference();
        }
    }, [syncLanguagePreference, isAuthenticated]);

    return <>{children}</>;
};
