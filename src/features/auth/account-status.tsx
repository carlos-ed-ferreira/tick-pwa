'use client';

import { FormEvent, useState } from 'react';
import { Button, Dialog } from '@/components/ui';
import { useAppContext } from '@/providers';

export function AccountStatus() {
  const {
    authMode,
    authUser,
    dictionary,
    isLoginConfigured,
    openAuthEntry,
    setAccountPassword,
    signOut,
  } = useAppContext();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  function closePasswordDialog() {
    setIsPasswordDialogOpen(false);
    setPassword('');
    setPasswordConfirmation('');
    setPasswordError(null);
    setPasswordSuccess(null);
    setIsSavingPassword(false);
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== passwordConfirmation) {
      setPasswordSuccess(null);
      setPasswordError(dictionary.auth.passwordMismatch);
      return;
    }

    setIsSavingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    const error = await setAccountPassword(password);

    if (error) {
      setPasswordError(error);
      setIsSavingPassword(false);
      return;
    }

    setPassword('');
    setPasswordConfirmation('');
    setPasswordSuccess(dictionary.auth.passwordUpdated);
    setIsSavingPassword(false);
  }

  if (authMode === 'authenticated') {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border px-3 py-1 text-sm text-muted">
            {authUser?.email || dictionary.auth.cloudModeBadge}
          </span>
          <Button
            className="min-h-9 px-3"
            disabled={!isLoginConfigured}
            onClick={() => setIsPasswordDialogOpen(true)}
          >
            {dictionary.auth.managePassword}
          </Button>
          <Button className="min-h-9 px-3" onClick={signOut}>
            {dictionary.auth.signOut}
          </Button>
        </div>

        <Dialog
          closeLabel={dictionary.dayEditor.close}
          open={isPasswordDialogOpen}
          title={dictionary.auth.passwordDialogTitle}
          onClose={closePasswordDialog}
        >
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            <p className="max-w-xl text-sm leading-6 text-muted">
              {dictionary.auth.passwordDialogDescription}
            </p>

            <form
              className="grid gap-4 sm:max-w-md"
              onSubmit={handlePasswordSubmit}
            >
              <label className="grid gap-1.5 text-sm text-muted">
                <span>{dictionary.auth.passwordLabel}</span>
                <input
                  autoComplete="new-password"
                  className="min-h-12 rounded-md border border-border bg-background px-3 text-base text-foreground outline-none transition focus:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                  disabled={isSavingPassword}
                  minLength={6}
                  placeholder={dictionary.auth.passwordPlaceholder}
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              <label className="grid gap-1.5 text-sm text-muted">
                <span>{dictionary.auth.confirmPasswordLabel}</span>
                <input
                  autoComplete="new-password"
                  className="min-h-12 rounded-md border border-border bg-background px-3 text-base text-foreground outline-none transition focus:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                  disabled={isSavingPassword}
                  minLength={6}
                  placeholder={dictionary.auth.confirmPasswordPlaceholder}
                  required
                  type="password"
                  value={passwordConfirmation}
                  onChange={(event) =>
                    setPasswordConfirmation(event.target.value)
                  }
                />
              </label>

              {passwordError ? (
                <p className="text-sm text-rose-600">{passwordError}</p>
              ) : null}

              {passwordSuccess ? (
                <p className="text-sm text-emerald-600">{passwordSuccess}</p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  className="min-h-11 px-4"
                  disabled={isSavingPassword}
                  type="submit"
                >
                  {isSavingPassword
                    ? dictionary.auth.savingPassword
                    : dictionary.auth.savePassword}
                </Button>
                <Button
                  className="min-h-11 bg-transparent px-4 shadow-none"
                  disabled={isSavingPassword}
                  onClick={closePasswordDialog}
                >
                  {dictionary.dayEditor.close}
                </Button>
              </div>
            </form>
          </div>
        </Dialog>
      </>
    );
  }

  if (authMode === 'guest') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border px-3 py-1 text-sm text-muted">
          {dictionary.auth.localModeBadge}
        </span>
        <Button
          className="min-h-9 px-3"
          disabled={!isLoginConfigured}
          onClick={openAuthEntry}
        >
          {dictionary.auth.switchToLogin}
        </Button>
      </div>
    );
  }

  return null;
}
