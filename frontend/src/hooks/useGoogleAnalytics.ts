import { useCallback } from "react";
import {
  trackEvent,
  trackCustomEvent,
  setUserId,
  setUserProperties,
  trackTiming,
} from "@/lib/googleAnalytics";

/**
 * Custom hook to easily use Google Analytics throughout the app
 * @returns Object with GA tracking functions
 */
export const useGoogleAnalytics = () => {
  const trackButtonClick = useCallback((buttonName: string, additionalData?: Record<string, any>) => {
    trackEvent("User Interaction", "Button Click", buttonName);
    if (additionalData) {
      trackCustomEvent("button_click", { button: buttonName, ...additionalData });
    }
  }, []);

  const trackLessonStart = useCallback((lessonTitle: string, lessonId: string) => {
    trackCustomEvent("lesson_start", {
      lesson_title: lessonTitle,
      lesson_id: lessonId,
    });
  }, []);

  const trackLessonComplete = useCallback((lessonTitle: string, lessonId: string, timeSpent: number) => {
    trackCustomEvent("lesson_complete", {
      lesson_title: lessonTitle,
      lesson_id: lessonId,
      time_spent_seconds: Math.round(timeSpent / 1000),
    });
  }, []);

  const trackTaskComplete = useCallback((taskName: string, taskValue: number) => {
    trackCustomEvent("task_complete", {
      task_name: taskName,
      task_value: taskValue,
    });
  }, []);

  const trackPurchase = useCallback((itemName: string, itemCost: number) => {
    trackCustomEvent("purchase", {
      currency: "coins",
      value: itemCost,
      items: [{ item_name: itemName, price: itemCost }],
    });
  }, []);

  const trackSavingsGoal = useCallback((goalName: string, goalAmount: number, action: "created" | "completed") => {
    trackCustomEvent("savings_goal", {
      goal_name: goalName,
      goal_amount: goalAmount,
      action,
    });
  }, []);

  const trackGamePlay = useCallback((gameName: string, score?: number) => {
    trackCustomEvent("game_play", {
      game_name: gameName,
      score: score || 0,
    });
  }, []);

  const trackUserLogin = useCallback((userId: string, userType: "parent" | "child") => {
    setUserId(userId);
    setUserProperties({ user_type: userType });
    trackCustomEvent("login", { user_type: userType });
  }, []);

  const trackUserLogout = useCallback(() => {
    setUserId(null);
    trackCustomEvent("logout");
  }, []);

  const trackError = useCallback((errorMessage: string, errorLocation: string) => {
    trackCustomEvent("error", {
      error_message: errorMessage,
      error_location: errorLocation,
    });
  }, []);

  const trackPageLoadTime = useCallback((pageName: string, loadTime: number) => {
    trackTiming("Page Load", pageName, loadTime);
  }, []);

  return {
    trackButtonClick,
    trackLessonStart,
    trackLessonComplete,
    trackTaskComplete,
    trackPurchase,
    trackSavingsGoal,
    trackGamePlay,
    trackUserLogin,
    trackUserLogout,
    trackError,
    trackPageLoadTime,
    trackEvent,
    trackCustomEvent,
    setUserId,
    setUserProperties,
  };
};

export default useGoogleAnalytics;

