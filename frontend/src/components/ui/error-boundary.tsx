import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center p-6 text-center bg-muted/30 rounded-lg border-2 border-dashed border-red-200">
                    <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
                    <h3 className="text-lg font-semibold text-red-700 mb-2">Algo salió mal</h3>
                    <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                        No pudimos cargar este componente.
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => this.setState({ hasError: false })}
                    >
                        Intentar de nuevo
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
