import React from "react";
import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { Hammer, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function DemoPageUnderConstruction() {
    const navigate = useNavigate();
    const { t } = useTranslation('demo');

    return (
        <DemoDashboardLayout>
            <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-4 animate-in fade-in duration-500">
                <div className="bg-yellow-100 dark:bg-yellow-900/30 p-8 rounded-full mb-6">
                    <Construction className="w-24 h-24 text-yellow-600 dark:text-yellow-500" />
                </div>

                <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent mb-4">
                    {t('construction.title')}
                </h1>

                <p className="text-lg text-muted-foreground max-w-md mb-8">
                    {t('construction.description')}
                </p>

                <Button
                    onClick={() => navigate(-1)}
                    variant="outline"
                    className="gap-2"
                >
                    <Hammer className="w-4 h-4" />
                    {t('construction.button')}
                </Button>
            </div>
        </DemoDashboardLayout>
    );
}
