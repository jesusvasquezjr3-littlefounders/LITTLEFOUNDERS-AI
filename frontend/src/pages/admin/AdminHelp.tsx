import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
    <div className="space-y-6 p-4 md:p-8 dark:bg-slate-950 dark:text-slate-50 min-h-screen">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
            <HelpCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold dark:text-slate-50">{t('help.title')}</h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">{t('help.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Welcome Banner */}
      <Alert className="border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 dark:border-blue-800">
        <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-base md:text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
          {t('help.welcome.title')}
        </AlertTitle>
        <AlertDescription className="ml-2 text-slate-700 dark:text-slate-300 space-y-2">
          <p>{t('help.welcome.message')}</p>
          <p className="text-sm italic border-l-4 border-blue-400 pl-3 py-1 bg-blue-50/50 dark:bg-blue-950/20">
            {t('help.welcome.responsibility')}
          </p>
        </AlertDescription>
      </Alert>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 dark:bg-slate-900 gap-2">
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
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-slate-50">
                <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                {t('help.docs.quickStart.title')}
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                {t('help.docs.quickStart.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {Array.from({ length: 5 }, (_, i) => i + 1).map((num) => (
                  <div key={num} className="flex gap-3 items-start p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
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
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-slate-50">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                {t('help.docs.overview.title')}
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                {t('help.docs.overview.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['lessons', 'characters', 'audio', 'users'].map((module) => (
                  <div key={module} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      {module === 'lessons' && <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-1" />}
                      {module === 'characters' && <Users className="w-5 h-5 text-green-600 dark:text-green-400 mt-1" />}
                      {module === 'audio' && <Video className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-1" />}
                      {module === 'users' && <Shield className="w-5 h-5 text-red-600 dark:text-red-400 mt-1" />}
                      <div className="space-y-2">
                        <h4 className="font-semibold dark:text-slate-50">
                          {t(`help.docs.modules.${module}.title`)}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {t(`help.docs.modules.${module}.description`)}
                        </p>
                        <Separator className="dark:bg-slate-700" />
                        <p className="text-xs text-slate-500 dark:text-slate-500">
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
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-slate-50">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                {t('help.docs.bestPractices.title')}
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                {t('help.docs.bestPractices.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {Array.from({ length: bestPracticesCount }, (_, i) => i + 1).map((num) => (
                  <li key={num} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
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
          <Card className="dark:bg-slate-900 dark:border-slate-800 border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-slate-50">
                <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                {t('help.docs.tips.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: tipsCount }, (_, i) => i + 1).map((num) => (
                  <Alert key={num} className="dark:bg-amber-950/20 dark:border-amber-800/50">
                    <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription className="ml-2 text-sm dark:text-slate-300">
                      <strong className="font-semibold">{t(`help.docs.tips.tip${num}.title`)}</strong>
                      {' - '}
                      {t(`help.docs.tips.tip${num}.description`)}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Glossary */}
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-slate-50">
                <Search className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                {t('help.docs.glossary.title')}
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                {t('help.docs.glossary.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: glossaryCount }, (_, i) => i + 1).map((num) => (
                  <div key={num} className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <h5 className="font-semibold text-sm text-blue-600 dark:text-blue-400 mb-1">
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
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-slate-50">
                <HelpCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                {t('help.faq.title')}
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                {t('help.faq.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full space-y-2">
                {/* Lessons FAQs */}
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-3 text-purple-600 dark:text-purple-400 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    {t('help.faq.categories.lessons')}
                  </h3>
                  {Array.from({ length: faqLessonsCount }, (_, i) => i + 1).map((num) => (
                    <AccordionItem key={`lesson-${num}`} value={`faq-lesson-${num}`} className="border-slate-200 dark:border-slate-700">
                      <AccordionTrigger className="hover:no-underline dark:text-slate-50 text-left">
                        {t(`help.faq.lessons.q${num}.question`)}
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-600 dark:text-slate-400 space-y-2">
                        <p>{t(`help.faq.lessons.q${num}.answer`)}</p>
                        {t(`help.faq.lessons.q${num}.example`, { defaultValue: '' }) && (
                          <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">
                            {t(`help.faq.lessons.q${num}.example`)}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </div>

                {/* Technical FAQs */}
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-3 text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    {t('help.faq.categories.technical')}
                  </h3>
                  {Array.from({ length: faqTechnicalCount }, (_, i) => i + 1).map((num) => (
                    <AccordionItem key={`tech-${num}`} value={`faq-tech-${num}`} className="border-slate-200 dark:border-slate-700">
                      <AccordionTrigger className="hover:no-underline dark:text-slate-50 text-left">
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
                  <h3 className="text-lg font-semibold mb-3 text-green-600 dark:text-green-400 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5" />
                    {t('help.faq.categories.general')}
                  </h3>
                  {Array.from({ length: faqGeneralCount }, (_, i) => i + 1).map((num) => (
                    <AccordionItem key={`general-${num}`} value={`faq-general-${num}`} className="border-slate-200 dark:border-slate-700">
                      <AccordionTrigger className="hover:no-underline dark:text-slate-50 text-left">
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
            <Card className="dark:bg-slate-900 dark:border-slate-800">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 dark:text-slate-50">
                    <PlayCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    {t('help.tutorials.createLesson.title')}
                  </CardTitle>
                  <Badge variant="secondary" className="dark:bg-slate-800">
                    {t('help.tutorials.difficulty.intermediate')}
                  </Badge>
                </div>
                <CardDescription className="dark:text-slate-400">
                  {t('help.tutorials.createLesson.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-4">
                  {Array.from({ length: tutorialStepsCreate }, (_, i) => i + 1).map((num) => (
                    <li key={num} className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-sm">
                        {num}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                          {t(`help.tutorials.createLesson.step${num}.title`)}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {t(`help.tutorials.createLesson.step${num}.description`)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <Alert className="dark:bg-slate-800 dark:border-slate-700">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <AlertTitle className="dark:text-slate-100">{t('help.tutorials.createLesson.tip.title')}</AlertTitle>
                  <AlertDescription className="dark:text-slate-300">
                    {t('help.tutorials.createLesson.tip.description')}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Tutorial 2: Edit Lesson */}
            <Card className="dark:bg-slate-900 dark:border-slate-800">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 dark:text-slate-50">
                    <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    {t('help.tutorials.editLesson.title')}
                  </CardTitle>
                  <Badge variant="secondary" className="dark:bg-slate-800">
                    {t('help.tutorials.difficulty.beginner')}
                  </Badge>
                </div>
                <CardDescription className="dark:text-slate-400">
                  {t('help.tutorials.editLesson.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-4">
                  {Array.from({ length: tutorialStepsEdit }, (_, i) => i + 1).map((num) => (
                    <li key={num} className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center text-yellow-700 dark:text-yellow-300 font-bold text-sm">
                        {num}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {t(`help.tutorials.editLesson.step${num}`)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* Tutorial 3: Manage Users */}
            <Card className="dark:bg-slate-900 dark:border-slate-800">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 dark:text-slate-50">
                    <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                    {t('help.tutorials.manageUsers.title')}
                  </CardTitle>
                  <Badge variant="secondary" className="dark:bg-slate-800">
                    {t('help.tutorials.difficulty.advanced')}
                  </Badge>
                </div>
                <CardDescription className="dark:text-slate-400">
                  {t('help.tutorials.manageUsers.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-4">
                  {Array.from({ length: tutorialStepsUsers }, (_, i) => i + 1).map((num) => (
                    <li key={num} className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-700 dark:text-green-300 font-bold text-sm">
                        {num}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {t(`help.tutorials.manageUsers.step${num}`)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <Alert variant="destructive" className="dark:bg-red-950/30 dark:border-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="dark:text-red-300">{t('help.tutorials.manageUsers.warning.title')}</AlertTitle>
                  <AlertDescription className="dark:text-red-300">
                    {t('help.tutorials.manageUsers.warning.description')}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Tutorial 4: History Rollback */}
            <Card className="dark:bg-slate-900 dark:border-slate-800">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 dark:text-slate-50">
                    <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    {t('help.tutorials.rollback.title')}
                  </CardTitle>
                  <Badge variant="secondary" className="dark:bg-slate-800">
                    {t('help.tutorials.difficulty.intermediate')}
                  </Badge>
                </div>
                <CardDescription className="dark:text-slate-400">
                  {t('help.tutorials.rollback.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-4">
                  {Array.from({ length: tutorialStepsRollback }, (_, i) => i + 1).map((num) => (
                    <li key={num} className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-700 dark:text-purple-300 font-bold text-sm">
                        {num}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm text-slate-700 dark:text-slate-300">
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
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-slate-50">
                <ListOrdered className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                {t('help.steps.title')}
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                {t('help.steps.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Array.from({ length: workflowSteps }, (_, i) => i + 1).map((num) => (
                <div key={num}>
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                        {num}
                      </div>
                    </div>
                    <div className="flex-1 pt-1">
                      <h4 className="font-semibold text-lg mb-2 dark:text-slate-50">
                        {t(`help.steps.workflow.step${num}.title`)}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        {t(`help.steps.workflow.step${num}.description`)}
                      </p>
                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-400">
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          <strong className="font-semibold">{t(`help.steps.workflow.step${num}.actionLabel`)}</strong>{' '}
                          {t(`help.steps.workflow.step${num}.action`)}
                        </p>
                      </div>
                    </div>
                  </div>
                  {num < workflowSteps && <Separator className="mt-6 dark:bg-slate-800" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Troubleshooting Tab */}
        <TabsContent value="troubleshooting" className="space-y-6">
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-slate-50">
                <Settings className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                {t('help.troubleshooting.title')}
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                {t('help.troubleshooting.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {Array.from({ length: troubleshootingCount }, (_, i) => i + 1).map((num) => (
                  <AccordionItem key={num} value={`trouble-${num}`} className="border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="hover:no-underline dark:text-slate-50 text-left">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                        {t(`help.troubleshooting.issue${num}.problem`)}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
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
      <Card className="border-2 border-blue-200 dark:border-blue-800 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-slate-50">
            <Heart className="w-5 h-5 text-red-500" />
            {t('help.support.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            {t('help.support.message')}
          </p>
          <div className="flex gap-3 flex-wrap">
            <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-300">
              {t('help.support.responsibility')}
            </Badge>
            <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-300">
              {t('help.support.quality')}
            </Badge>
            <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-300">
              {t('help.support.innovation')}
            </Badge>
            <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-300">
              {t('help.support.impact')}
            </Badge>
          </div>
          <Alert className="dark:bg-green-950/20 dark:border-green-800">
            <Heart className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="ml-2 text-sm dark:text-slate-300">
              {t('help.support.thankyou')}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};
