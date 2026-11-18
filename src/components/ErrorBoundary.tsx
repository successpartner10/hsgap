import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    let message = 'An unexpected application error occurred.';
    if (error instanceof Error) {
      try {
        const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
        if (parsed && parsed.error) {
          message = `${parsed.error}${parsed.path ? ` (${parsed.operationType || 'db'} on ${parsed.path})` : ''}`;
        } else {
          message = error.message;
        }
      } catch {
        message = error.message;
      }
    }
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('SignalGap ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#FECACA] rounded-[4px] p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-[4px] bg-[#FEF2F2] text-[#DC2626] shrink-0">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900">
                  Unable to Load Workspace
                </h1>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed break-words">
                  {this.state.message}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-[#0F172A] hover:bg-slate-800 text-white rounded-[4px] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reload SignalGap</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
