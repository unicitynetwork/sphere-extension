import { useState, useEffect } from 'react';
import { AlertTriangle, Download, LogOut, Loader2 } from 'lucide-react';
import { BaseModal, Button } from '@/components/ui';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackupAndLogout: () => void;
  onLogoutWithoutBackup: () => void;
  isLoggingOut?: boolean;
}

export function LogoutConfirmModal({
  isOpen,
  onClose,
  onBackupAndLogout,
  onLogoutWithoutBackup,
  isLoggingOut = false,
}: LogoutConfirmModalProps) {
  const [logoutStatus, setLogoutStatus] = useState('Closing connections...');

  useEffect(() => {
    if (!isLoggingOut) {
      setLogoutStatus('Closing connections...');
      return;
    }
    const timer = setTimeout(() => {
      setLogoutStatus('Clearing wallet data...');
    }, 800);
    return () => clearTimeout(timer);
  }, [isLoggingOut]);

  return (
    <BaseModal isOpen={isOpen} onClose={isLoggingOut ? () => {} : onClose} size="sm" showOrbs={false}>
      <div className="relative px-6 py-5 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>
        <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Logout from Wallet?</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          All local data will be deleted. Make sure you have a backup to restore your wallet later.
        </p>
      </div>

      <div className="px-6 pb-6 pt-2 space-y-3">
        {isLoggingOut ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
            <span className="text-sm font-bold text-neutral-900 dark:text-white">Logging out...</span>
            <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 bg-orange-50 dark:bg-orange-900/20 px-3 py-2 rounded-lg border border-orange-200 dark:border-orange-700/30 text-xs">
              <div className="w-2 h-2 rounded-full bg-orange-500 dark:bg-orange-400 shrink-0 animate-pulse" />
              <span className="font-medium">{logoutStatus}</span>
            </div>
          </div>
        ) : (
          <>
            <Button icon={Download} fullWidth onClick={onBackupAndLogout}>
              Save Backup First
            </Button>

            <button
              onClick={onLogoutWithoutBackup}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 dark:text-red-400 text-sm font-semibold rounded-xl transition-colors active:scale-[0.98]"
            >
              <LogOut className="w-4 h-4" />
              Logout without backup
            </button>

            <button
              onClick={onClose}
              className="w-full py-3 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </BaseModal>
  );
}
