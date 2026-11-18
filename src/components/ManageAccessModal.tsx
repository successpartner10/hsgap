import React, { useState } from 'react';
import { ShieldCheck, Trash2, UserPlus, X } from 'lucide-react';
import { isBootstrappedAdminEmail } from '../hooks/useSignalGapAuth';
import type { AllowedEmailRecord, UserRole } from '../types/market';

interface ManageAccessModalProps {
  open: boolean;
  allowedEmails: AllowedEmailRecord[];
  onClose: () => void;
  onAddEmail: (email: string, role: UserRole) => Promise<void>;
  onUpdateRole: (email: string, role: UserRole) => Promise<void>;
  onRemoveEmail: (email: string) => Promise<void>;
}

export const ManageAccessModal: React.FC<ManageAccessModalProps> = ({
  open,
  allowedEmails,
  onClose,
  onAddEmail,
  onUpdateRole,
  onRemoveEmail,
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<UserRole>('member');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleaned = emailInput.trim().toLowerCase();
    if (!cleaned) return;
    setSubmitting(true);
    try {
      await onAddEmail(cleaned, roleInput);
      setEmailInput('');
      setRoleInput('member');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to add email');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-access-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-[4px] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2
              id="manage-access-title"
              className="text-base font-bold tracking-tight text-slate-900"
            >
              Manage Access
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Admins share the master watchlist. Members start with the 23 defaults and keep their own custom lists.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Manage Access"
            className="p-1.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-[4px] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-5 border-b border-slate-200 space-y-3 bg-slate-50/70"
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="user@gmail.com"
              aria-label="Allowed email address"
              className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400"
            />
            <select
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value as UserRole)}
              aria-label="User role"
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-slate-400 cursor-pointer"
            >
              <option value="member">Member (Personal List)</option>
              <option value="admin">Admin (Shared List)</option>
            </select>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#0F172A] hover:bg-slate-800 disabled:opacity-60 text-white rounded-[4px] transition-colors whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{submitting ? 'Saving...' : 'Allow Email'}</span>
            </button>
          </div>
          {formError && (
            <p className="text-xs text-[#DC2626] font-medium">{formError}</p>
          )}
        </form>

        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
          {allowedEmails.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Loading allowlist...
            </div>
          ) : (
            allowedEmails.map((entry) => {
              const lockedAdmin = isBootstrappedAdminEmail(entry.email);
              return (
                <div
                  key={entry.email}
                  className="px-5 py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {entry.email}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {entry.role === 'admin'
                        ? 'Shared admin watchlist + access control'
                        : 'Personal watchlist (starts from 23 defaults)'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {lockedAdmin ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] rounded-[4px]">
                        <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                        <span>Primary Admin</span>
                      </span>
                    ) : (
                      <>
                        <select
                          value={entry.role}
                          onChange={(e) =>
                            void onUpdateRole(entry.email, e.target.value as UserRole)
                          }
                          aria-label={`Role for ${entry.email}`}
                          className="px-2 py-1 text-[11px] font-medium bg-white border border-slate-200 rounded-[4px] text-slate-800 cursor-pointer"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => void onRemoveEmail(entry.email)}
                          aria-label={`Remove ${entry.email}`}
                          className="p-1.5 text-slate-400 hover:text-[#DC2626] border border-slate-200 hover:border-[#FECACA] rounded-[4px] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
