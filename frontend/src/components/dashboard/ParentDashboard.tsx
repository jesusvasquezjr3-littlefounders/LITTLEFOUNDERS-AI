import React from "react";
import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";
import { motion, type Variants } from "framer-motion";

interface ParentDashboardProps {
  user: any;
}

export function ParentDashboard({ user }: ParentDashboardProps) {
  const { t } = useTranslation('common');

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 12 },
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
      <motion.div
        className="corp-icon-chip w-24 h-24 mb-6"
        variants={{ hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: [0.34, 1.56, 0.64, 1] } } }}
      >
        <Construction className="w-12 h-12" />
      </motion.div>

      <motion.h1 className="corp-h1 mb-4" variants={item}>
        <span className="corp-gradient-text">{t('in_development.title', '¡Página en Construcción!')}</span>
      </motion.h1>

      <motion.p className="corp-body-lg max-w-md mb-8" variants={item}>
        {t('in_development.description', 'Pronto tendremos un nuevo y mejorado panel para ti.')}
      </motion.p>
    </motion.div>
  );
}
