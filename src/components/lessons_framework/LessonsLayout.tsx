import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, Clock, Target } from "lucide-react";

interface LessonsLayoutProps {
  children: ReactNode;
  title: string;
  ageGroup: string;
  description: string;
  level?: string;
}

export function LessonsLayout({ children, title, ageGroup, description, level }: LessonsLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
              <p className="text-lg text-gray-600">{description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="px-3 py-1 bg-blue-50 text-blue-700 border-blue-200">
              <Users className="w-3 h-3 mr-1" />
              Edades {ageGroup}
            </Badge>
            {level && (
              <Badge variant="outline" className="px-3 py-1 bg-purple-50 text-purple-700 border-purple-200">
                <Target className="w-3 h-3 mr-1" />
                {level}
              </Badge>
            )}
            <Badge variant="outline" className="px-3 py-1 bg-green-50 text-green-700 border-green-200">
              <Clock className="w-3 h-3 mr-1" />
              Interactivo
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
