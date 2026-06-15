import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  BookOpen,
  HelpCircle,
  GraduationCap,
  ListOrdered,
  Heart,
  Shield,
  Zap,
  Users,
  FileText,
  Video,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Lightbulb,
  Search,
  Settings,
  PlayCircle,
} from 'lucide-react';

export const AdminHelp: React.FC = () => {
  const { t } = useTranslation('admin');
  const [activeTab, setActiveTab] = useState('welcome');

  // Get arrays lengths from translations
  const bestPracticesCount = 8;
  const faqLessonsCount = 5;
  const faqTechnicalCount = 5;
  const faqGeneralCount = 3;
  const tutorialStepsCreate = 10;
  const tutorialStepsEdit = 8;
  const tutorialStepsUsers = 6;
  const tutorialStepsRollback = 7;
  const workflowSteps = 5;
  const tipsCount = 5;
  const troubleshootingCount = 6;
  const glossaryCount = 10;

  return (
    <div className="space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="corp-panel p-6 md:p-8 flex items-center gap-4">
        <div className="corp-icon-chip w-12 h-12 flex-shrink-0">
          <HelpCircle className="w-6 h-6" />
        </div>
        <div>
          <h1 className="corp-display text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{t('help.title')}</h1>
          <p className="mt-1 text-sm md:text-base text-slate-500 dark:text-slate-400">{t('help.subtitle')}</p>
        </div>
      </div>

      {/* Welcome Banner */}
      <div className="corp-panel-subtle p-5 md:p-6">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-300 mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <p className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">
              {t('help.welcome.title')}
            </p>
            <p className="text-slate-600 dark:text-slate-400">{t('help.welcome.message')}</p>
            <p className="text-sm italic border-l-4 border-indigo-400 dark:border-indigo-500 pl-3 py-1 text-slate-600 dark:text-slate-400">
              {t('help.welcome.responsibility')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 bg-slate-100 dark:bg-[#0d1426] gap-2">
          <TabsTrigger value="welcome" className="gap-2">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">{t('help.tabs.documentation')}</span>
          </TabsTrigger>
          <TabsTrigger value="faq" className="gap-2">
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">{t('help.tabs.faq')}</span>
          </TabsTrigger>
          <TabsTrigger value="tutorials" className="gap-2">
            <GraduationCap className="w-4 h-4" />
            <span className="hidden sm:inline">{t('help.tabs.tutorials')}</span>
          </TabsTrigger>
          <TabsTrigger value="steps" className="gap-2">
            <ListOrdered className="w-4 h-4" />
            <span className="hidden sm:inline">{t('help.tabs.steps')}</span>
          </TabsTrigger>
          <TabsTrigger value="troubleshooting" className="gap-2">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">{t('help.tabs.troubleshooting')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Documentation Tab */}
        <TabsContent value="welcome" className="space-y-6">
          {/* Quick Start Guide */}
          <Card className="corp-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                {t('help.docs.quickStart.title')}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                {t('help.docs.quickStart.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {Array.from({ length: 5 }, (_, i) => i + 1).map((num) => (
                  <div key={num} className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 dark:bg-[#0d1426]">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                      {num}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {t(`help.docs.quickStart.step${num}`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* System Overview */}
          <Card className="corp-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                {t('help.docs.overview.title')}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                {t('help.docs.overview.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['lessons', 'characters', 'audio', 'users'].map((module) => (
                  <div key={module} className="corp-panel-subtle p-4">
                    <div className="flex items-start gap-3">
                      {module === 'lessons' && <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-300 mt-1" />}
                      {module === 'characters' && <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-1" />}
                      {module === 'audio' && <Video className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-1" />}
                      {module === 'users' && <Shield className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-1" />}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-slate-900 dark:text-white">
                          {t(`help.docs.modules.${module}.title`)}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {t(`help.docs.modules.${module}.description`)}
                        </p>
                        <Separator className="bg-slate-200 dark:bg-white/10" />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t(`help.docs.modules.${module}.details`)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Best Practices */}
          <Card className="corp-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                {t('help.docs.bestPractices.title')}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                {t('help.docs.bestPractices.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {Array.from({ length: bestPracticesCount }, (_, i) => i + 1).map((num) => (
                  <li key={num} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <ChevronRight className="w-5 h-5 text-indigo-600 dark:text-indigo-300 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                        {t(`help.docs.bestPractices.practice${num}.title`)}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {t(`help.docs.bestPractices.practice${num}.description`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Tips & Tricks */}
          <Card className="corp-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Lightbulb className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                {t('help.docs.tips.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: tipsCount }, (_, i) => i + 1).map((num) => (
                  <div key={num} className="corp-panel-subtle p-3 flex items-start gap-3">
                    <Lightbulb className="h-4 w-4 text-indigo-600 dark:text-indigo-300 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      <strong className="font-semibold text-slate-900 dark:text-white">{t(`help.docs.tips.tip${num}.title`)}</strong>
                      {' - '}
                      {t(`help.docs.tips.tip${num}.description`)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Glossary */}
          <Card className="corp-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Search className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                {t('help.docs.glossary.title')}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                {t('help.docs.glossary.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: glossaryCount }, (_, i) => i + 1).map((num) => (
                  <div key={num} className="corp-panel-subtle p-3">
                    <h5 className="font-semibold text-sm text-indigo-600 dark:text-indigo-300 mb-1">
                      {t(`help.docs.glossary.term${num}.name`)}
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {t(`help.docs.glossary.term${num}.definition`)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ Tab */}
        <TabsContent value="faq" className="space-y-6">
          <Card className="corp-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                {t('help.faq.title')}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                {t('help.faq.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full space-y-2">
                {/* Lessons FAQs */}
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-3 text-slate-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                    {t('help.faq.categories.lessons')}
                  </h3>
                  {Array.from({ length: faqLessonsCount }, (_, i) => i + 1).map((num) => (
                    <AccordionItem key={`lesson-${num}`} value={`faq-lesson-${num}`} className="border-slate-200 dark:border-white/10">
                      <AccordionTrigger className="hover:no-underline text-slate-900 dark:text-white text-left">
                        {t(`help.faq.lessons.q${num}.question`)}
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-600 dark:text-slate-400 space-y-2">
                        <p>{t(`help.faq.lessons.q${num}.answer`)}</p>
                        {t(`help.faq.lessons.q${num}.example`, { defaultValue: '' }) && (
                          <div className="mt-2 p-2 bg-slate-100 dark:bg-[#0d1426] rounded text-xs font-mono">
                            {t(`help.faq.lessons.q${num}.example`)}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </div>

                {/* Technical FAQs */}
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-3 text-slate-900 dark:text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                    {t('help.faq.categories.technical')}
                  </h3>
                  {Array.from({ length: faqTechnicalCount }, (_, i) => i + 1).map((num) => (
                    <AccordionItem key={`tech-${num}`} value={`faq-tech-${num}`} className="border-slate-200 dark:border-white/10">
                      <AccordionTrigger className="hover:no-underline text-slate-900 dark:text-white text-left">
                        {t(`help.faq.technical.q${num}.question`)}
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-600 dark:text-slate-400">
                        {t(`help.faq.technical.q${num}.answer`)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </div>

                {/* General FAQs */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-slate-900 dark:text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                    {t('help.faq.categories.general')}
                  </h3>
                  {Array.from({ length: faqGeneralCount }, (_, i) => i + 1).map((num) => (
                    <AccordionItem key={`general-${num}`} value={`faq-general-${num}`} className="border-slate-200 dark:border-white/10">
                      <AccordionTrigger className="hover:no-underline text-slate-900 dark:text-white text-left">
                        {t(`help.faq.general.q${num}.question`)}
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-600 dark:text-slate-400">
                        {t(`help.faq.general.q${num}.answer`)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </div>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tutorials Tab */}
        <TabsContent value="tutorials" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* Tutorial 1: Create Lesson */}
            <Card className="corp-card">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                    <PlayCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                    {t('help.tutorials.createLesson.title')}
                  </CardTitle>
                  <span className="corp-badge corp-badge--warning">
                    {t('help.tutorials.difficulty.intermediate')}
                  </span>
                </div>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  {t('help.tutorials.createLesson.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-4">
                  {Array.from({ length: tutorialStepsCreate }, (_, i) => i + 1).map((num) => (
                    <li key={num} className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                        {num}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                          {t(`help.tutorials.createLesson.step${num}.title`)}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {t(`help.tutorials.createLesson.step${num}.description`)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="corp-panel-subtle p-3 flex items-start gap-3">
                  <Lightbulb className="h-4 w-4 text-indigo-600 dark:text-indigo-300 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('help.tutorials.createLesson.tip.title')}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {t('help.tutorials.createLesson.tip.description')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tutorial 2: Edit Lesson */}
            <Card className="corp-card">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                    <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                    {t('help.tutorials.editLesson.title')}
                  </CardTitle>
                  <span className="corp-badge corp-badge--success">
                    {t('help.tutorials.difficulty.beginner')}
                  </span>
                </div>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  {t('help.tutorials.editLesson.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-4">
                  {Array.from({ length: tutorialStepsEdit }, (_, i) => i + 1).map((num) => (
                    <li key={num} className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                        {num}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {t(`help.tutorials.editLesson.step${num}`)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* Tutorial 3: Manage Users */}
            <Card className="corp-card">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                    <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                    {t('help.tutorials.manageUsers.title')}
                  </CardTitle>
                  <span className="corp-badge corp-badge--danger">
                    {t('help.tutorials.difficulty.advanced')}
                  </span>
                </div>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  {t('help.tutorials.manageUsers.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-4">
                  {Array.from({ length: tutorialStepsUsers }, (_, i) => i + 1).map((num) => (
                    <li key={num} className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                        {num}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {t(`help.tutorials.manageUsers.step${num}`)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10 p-3 flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{t('help.tutorials.manageUsers.warning.title')}</p>
                    <p className="text-sm text-rose-700/90 dark:text-rose-300/90">
                      {t('help.tutorials.manageUsers.warning.description')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tutorial 4: History Rollback */}
            <Card className="corp-card">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                    <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                    {t('help.tutorials.rollback.title')}
                  </CardTitle>
                  <span className="corp-badge corp-badge--warning">
                    {t('help.tutorials.difficulty.intermediate')}
                  </span>
                </div>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  {t('help.tutorials.rollback.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-4">
                  {Array.from({ length: tutorialStepsRollback }, (_, i) => i + 1).map((num) => (
                    <li key={num} className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                        {num}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {t(`help.tutorials.rollback.step${num}`)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Step-by-Step Tab */}
        <TabsContent value="steps" className="space-y-6">
          <Card className="corp-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <ListOrdered className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                {t('help.steps.title')}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                {t('help.steps.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Array.from({ length: workflowSteps }, (_, i) => i + 1).map((num) => (
                <div key={num}>
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white font-bold shadow-lg">
                        {num}
                      </div>
                    </div>
                    <div className="flex-1 pt-1">
                      <h4 className="font-semibold text-lg mb-2 text-slate-900 dark:text-white">
                        {t(`help.steps.workflow.step${num}.title`)}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        {t(`help.steps.workflow.step${num}.description`)}
                      </p>
                      <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border-l-4 border-indigo-400 dark:border-indigo-500">
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          <strong className="font-semibold">{t(`help.steps.workflow.step${num}.actionLabel`)}</strong>{' '}
                          {t(`help.steps.workflow.step${num}.action`)}
                        </p>
                      </div>
                    </div>
                  </div>
                  {num < workflowSteps && <Separator className="mt-6 bg-slate-200 dark:bg-white/10" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Troubleshooting Tab */}
        <TabsContent value="troubleshooting" className="space-y-6">
          <Card className="corp-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                {t('help.troubleshooting.title')}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                {t('help.troubleshooting.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {Array.from({ length: troubleshootingCount }, (_, i) => i + 1).map((num) => (
                  <AccordionItem key={num} value={`trouble-${num}`} className="border-slate-200 dark:border-white/10">
                    <AccordionTrigger className="hover:no-underline text-slate-900 dark:text-white text-left">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-300 flex-shrink-0" />
                        {t(`help.troubleshooting.issue${num}.problem`)}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        <p className="font-semibold text-slate-900 dark:text-white mb-2">
                          {t(`help.troubleshooting.issue${num}.solution.title`)}
                        </p>
                        <p className="mb-3">{t(`help.troubleshooting.issue${num}.solution.description`)}</p>
                        <ol className="space-y-2 list-decimal list-inside pl-2">
                          {Array.from({ length: 5 }, (_, i) => i + 1).map((stepNum) => {
                            const stepText = t(`help.troubleshooting.issue${num}.solution.step${stepNum}`, { defaultValue: '' });
                            return stepText ? (
                              <li key={stepNum} className="text-xs">{stepText}</li>
                            ) : null;
                          })}
                        </ol>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Support Card */}
      <Card className="corp-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Heart className="w-5 h-5 text-rose-500" />
            {t('help.support.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            {t('help.support.message')}
          </p>
          <div className="flex gap-3 flex-wrap">
            <span className="corp-badge corp-badge--brand">
              {t('help.support.responsibility')}
            </span>
            <span className="corp-badge corp-badge--brand">
              {t('help.support.quality')}
            </span>
            <span className="corp-badge corp-badge--brand">
              {t('help.support.innovation')}
            </span>
            <span className="corp-badge corp-badge--brand">
              {t('help.support.impact')}
            </span>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 p-3 flex items-start gap-3">
            <Heart className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {t('help.support.thankyou')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
