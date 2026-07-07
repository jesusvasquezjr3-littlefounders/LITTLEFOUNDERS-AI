import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation('common');

  useEffect(() => {
    console.error(
      t('common:notFound.console_error'),
      location.pathname
    );
  }, [location.pathname, t]);

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.1 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <div className="corp min-h-screen relative overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white dark:from-[#0b1124] dark:via-[#070b14] dark:to-[#070b14]">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-indigo-400/12 dark:bg-indigo-600/12 blur-[120px] pointer-events-none" />
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <motion.div
          className="w-full max-w-md text-center space-y-6"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          <motion.p
            className="corp-gradient-text text-7xl sm:text-8xl leading-none"
            variants={{ hidden: { opacity: 0, scale: 0.7 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] } } }}
          >
            404
          </motion.p>
          <motion.div className="space-y-3" variants={item}>
            <h1 className="corp-h3">
              {t('common:notFound.title')}
            </h1>
            <p className="corp-body">
              {t('common:notFound.message')}
            </p>
          </motion.div>
          <motion.div variants={item}>
            <a
              href="/"
              className="corp-btn-primary inline-flex items-center justify-center h-11 px-6 rounded-xl text-sm font-semibold"
            >
              {t('common:notFound.back_home')}
            </a>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
