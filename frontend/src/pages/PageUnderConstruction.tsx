import React from "react";
import { Hammer, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

export default function PageUnderConstruction() {
    const navigate = useNavigate();
    const { t } = useTranslation('common');

    const container = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.1 },
        },
    };

    const item = {
        hidden: { opacity: 0, y: 10 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
        },
    };

    return (
        <motion.div
            className="corp flex flex-col items-center justify-center min-h-[80vh] text-center p-4"
            variants={container}
            initial="hidden"
            animate="visible"
        >
            <motion.div className="corp-icon-chip rounded-full w-40 h-40 mb-6" variants={{ hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: [0.34, 1.56, 0.64, 1] } } }}>
                <Construction className="w-24 h-24" />
            </motion.div>

            <motion.h1 className="corp-h1 corp-gradient-text mb-4" variants={item}>
                {t('in_development.title')}
            </motion.h1>

            <motion.p className="corp-subtitle max-w-md mb-8" variants={item}>
                {t('in_development.description')}
            </motion.p>

            <motion.div variants={item}>
                <Button
                    onClick={() => navigate(-1)}
                    variant="outline"
                    className="gap-2"
                >
                    <Hammer className="w-4 h-4" />
                    {t('buttons.back')}
                </Button>
            </motion.div>
        </motion.div>
    );
}
