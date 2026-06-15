import React from "react";
import { Hammer, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function PageUnderConstruction() {
    const navigate = useNavigate();
    const { t } = useTranslation('common');

    return (
        <div className="corp flex flex-col items-center justify-center min-h-[80vh] text-center p-4 animate-in fade-in duration-500">
            <div className="corp-icon-chip rounded-full w-40 h-40 mb-6">
                <Construction className="w-24 h-24" />
            </div>

            <h1 className="corp-display corp-gradient-text text-3xl md:text-5xl font-bold mb-4">
                {t('in_development.title')}
            </h1>

            <p className="text-lg text-muted-foreground max-w-md mb-8">
                {t('in_development.description')}
            </p>

            <Button
                onClick={() => navigate(-1)}
                variant="outline"
                className="gap-2"
            >
                <Hammer className="w-4 h-4" />
                {t('buttons.back')}
            </Button>
        </div>
    );
}
