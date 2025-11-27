import { useState } from "react";
import { useGoogleAnalytics } from "@/hooks/useGoogleAnalytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GoogleAnalyticsDemoProps {
  showDemo?: boolean;
}

/**
 * Demo component to showcase Google Analytics tracking
 * Only visible in development mode
 */
export const GoogleAnalyticsDemo = ({ showDemo = false }: GoogleAnalyticsDemoProps) => {
  const ga = useGoogleAnalytics();
  const [eventCount, setEventCount] = useState(0);

  if (!showDemo) return null;

  const handleTestEvent = (eventName: string) => {
    setEventCount((prev) => prev + 1);
    
    switch (eventName) {
      case "button_click":
        ga.trackButtonClick("Demo Button", { demo: true });
        break;
      case "lesson_start":
        ga.trackLessonStart("Demo Lesson", "demo-lesson-1");
        break;
      case "lesson_complete":
        ga.trackLessonComplete("Demo Lesson", "demo-lesson-1", 5000);
        break;
      case "task_complete":
        ga.trackTaskComplete("Demo Task", 100);
        break;
      case "purchase":
        ga.trackPurchase("Demo Item", 50);
        break;
      case "savings_goal":
        ga.trackSavingsGoal("Demo Goal", 1000, "created");
        break;
      case "game_play":
        ga.trackGamePlay("Demo Game", 500);
        break;
      case "custom_event":
        ga.trackCustomEvent("demo_custom_event", {
          custom_param: "demo_value",
          timestamp: new Date().toISOString(),
        });
        break;
      default:
        break;
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 w-96 shadow-lg z-50 border-2 border-blue-500">
      <CardHeader className="bg-blue-50">
        <CardTitle className="flex items-center justify-between">
          Google Analytics Demo
          <Badge variant="secondary">{eventCount} events</Badge>
        </CardTitle>
        <CardDescription>
          Test Google Analytics events (Dev Only)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTestEvent("button_click")}
          >
            Button Click
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTestEvent("lesson_start")}
          >
            Lesson Start
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTestEvent("lesson_complete")}
          >
            Lesson Complete
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTestEvent("task_complete")}
          >
            Task Complete
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTestEvent("purchase")}
          >
            Purchase
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTestEvent("savings_goal")}
          >
            Savings Goal
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTestEvent("game_play")}
          >
            Game Play
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTestEvent("custom_event")}
          >
            Custom Event
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mt-4 p-2 bg-gray-50 rounded">
          <p className="font-semibold mb-1">📊 Check Google Analytics:</p>
          <p>1. Go to Google Analytics Dashboard</p>
          <p>2. Navigate to Realtime view</p>
          <p>3. Click buttons to see events</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default GoogleAnalyticsDemo;

