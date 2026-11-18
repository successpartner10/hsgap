import React from 'react';
import { LogOut, ShieldAlert, TrendingUp } from 'lucide-react';
import type { AuthStatus } from '../hooks/useSignalGapAuth';

interface AuthGateProps {
  status: AuthStatus;
  userEmail: string | null | undefined;
  authError: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  status,
  userEmail,
  authError,
  onSignIn,
  onSignOut,
}) => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-slate-900">
              SignalGap
            </span>
          </div>
          <span className="text-xs font-medium text-slate-500">
            Cross-Asset Sentiment &amp; 2-Week Heikin-Ashi
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-[4px] p-6 space-y-5">
          {status === 'loading' || status === 'checking' ? (
            <div className="py-8 text-center space-y-2">
              <div className="w-6 h-6 mx-auto border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-700">
                {status === 'checking'
                  ? 'Verifying account access & syncing watchlist...'
                  : 'Loading SignalGap...'}
              </p>
            </div>
          ) : status === 'unauthorized' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] rounded-[4px] shrink-0">
                  <ShieldAlert className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-slate-900">
                    Access Not Enabled
                  </h1>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Signed in as{' '}
                    <span className="font-semibold text-slate-900">
                      {userEmail || 'Unknown'}
                    </span>
                    . Ask an administrator to add this email under{' '}
                    <span className="font-semibold text-slate-900">
                      Manage Access
                    </span>
                    .
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onSignOut}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#0F172A] hover:bg-slate-800 text-white rounded-[4px] transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sign Out &amp; Switch Account</span>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669]">
                  <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Synced Multi-Device Terminal</span>
                </div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  Sign in to SignalGap
                </h1>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Sync your FX, Stocks, Crypto, and Commodities lists seamlessly across Android and Linux desktop browsers.
                </p>
              </div>

              {authError && (
                <div className="px-3 py-2 text-xs text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-[4px]">
                  {authError}
                </div>
              )}

              <button
                type="button"
                onClick={onSignIn}
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 text-xs font-semibold bg-[#0F172A] hover:bg-slate-800 text-white rounded-[4px] transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
