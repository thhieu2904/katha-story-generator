'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/features/auth/useAuth';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';
import {
  createAccount,
  deleteAccount,
  listAccounts,
  type Account,
  type AccountRole,
} from '../api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

type ListState = 'loading' | 'ready' | 'error';

export function ReaderAccountsPage() {
  const { copy, language } = useUiCopy();
  const { user } = useAuth();
  const [appRole, setAppRole] = useState<AccountRole>('reader');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formResult, setFormResult] = useState<Account | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [listState, setListState] = useState<ListState>('loading');
  const [listError, setListError] = useState<string | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);

  const loadAccounts = useCallback(async (signal?: AbortSignal) => {
    try {
      setAccounts(await listAccounts(signal));
      setListState('ready');
    } catch (caughtError) {
      if (signal?.aborted) return;
      const message =
        caughtError instanceof ApiError &&
        caughtError.status === 503 &&
        caughtError.message.includes('not configured')
          ? copy.supabaseAdminNotConfigured
          : copy.readerListFailed;
      setListError(message);
      setListState('error');
    }
  }, [copy.readerListFailed, copy.supabaseAdminNotConfigured]);

  useEffect(() => {
    const controller = new AbortController();
    void listAccounts(controller.signal)
      .then((loadedAccounts) => {
        setAccounts(loadedAccounts);
        setListState('ready');
      })
      .catch((caughtError: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          caughtError instanceof ApiError &&
          caughtError.status === 503 &&
          caughtError.message.includes('not configured')
            ? copy.supabaseAdminNotConfigured
            : copy.readerListFailed;
        setListError(message);
        setListState('error');
      });
    return () => controller.abort();
  }, [copy.readerListFailed, copy.supabaseAdminNotConfigured]);

  function clearFormFeedback() {
    setFormError(null);
    setFormResult(null);
  }

  function validate(): string | null {
    if (!displayName.trim()) return copy.readerNameRequired;
    if (!email.trim()) return copy.readerEmailRequired;
    if (!EMAIL_PATTERN.test(email.trim())) return copy.readerEmailInvalid;
    if (!password) return copy.readerPasswordRequired;
    if (password.length < MIN_PASSWORD_LENGTH) return copy.readerPasswordTooShort;
    if (!passwordConfirmation) return copy.readerPasswordConfirmationRequired;
    if (password !== passwordConfirmation) return copy.readerPasswordsDoNotMatch;
    return null;
  }

  function createErrorMessage(caughtError: unknown): string {
    if (!(caughtError instanceof ApiError)) return copy.readerCreateFailed;
    if (caughtError.status === 409) return copy.readerAccountAlreadyExists;
    if (caughtError.status === 400) return copy.readerAccountRejected;
    if (caughtError.status === 503 && caughtError.message.includes('not configured')) {
      return copy.supabaseAdminNotConfigured;
    }
    return copy.readerAccountUnavailable;
  }

  function formatAccountDate(value: string | null) {
    if (!value) return copy.readerNeverSignedIn;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return copy.readerNeverSignedIn;
    return new Intl.DateTimeFormat(language === 'km' ? 'km-KH' : 'vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    clearFormFeedback();
    setDeleteFeedback(null);
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const response = await createAccount({
        display_name: displayName.trim(),
        email: email.trim(),
        password,
        app_role: appRole,
      });
      setFormResult(response);
      setAccounts((current) => [response, ...current.filter((item) => item.id !== response.id)]);
      setListState('ready');
      setDisplayName('');
      setEmail('');
      setPassword('');
      setPasswordConfirmation('');
      setAppRole('reader');
    } catch (caughtError) {
      setFormError(createErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!accountToDelete || deletingId) return;
    const target = accountToDelete;
    setDeletingId(target.id);
    setListError(null);
    setDeleteFeedback(null);
    try {
      await deleteAccount(target.id);
      setAccounts((current) => current.filter((item) => item.id !== target.id));
      setDeleteFeedback(
        formatCopy(copy.readerAccountDeleted, { email: target.email ?? target.id }),
      );
      setAccountToDelete(null);
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 404) {
        setAccounts((current) => current.filter((item) => item.id !== target.id));
        setListError(copy.readerAccountNotFound);
        setAccountToDelete(null);
      } else if (caughtError instanceof ApiError && caughtError.status === 403) {
        setListError(copy.cannotDeleteCurrentAccount);
        setAccountToDelete(null);
      } else if (
        caughtError instanceof ApiError &&
        caughtError.status === 503 &&
        caughtError.message.includes('not configured')
      ) {
        setListError(copy.supabaseAdminNotConfigured);
      } else {
        setListError(copy.readerDeleteFailed);
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
      <div className="max-w-3xl">
        <p className="katha-eyebrow text-xs font-bold uppercase tracking-[0.22em] text-katha-gold">
          {copy.accountsEyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.035em] text-katha-text sm:text-4xl">
          {copy.accountsTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-katha-text/55 sm:text-base">
          {copy.accountsSubtitle}
        </p>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(19rem,0.8fr)_minmax(0,1.4fr)]">
        <section className="katha-card overflow-hidden rounded-3xl border border-katha-text/10 bg-katha-text/[0.035] shadow-2xl sm:backdrop-blur-xl">
          <div className="border-b border-katha-text/10 bg-katha-field/45 px-5 py-4 sm:px-7">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-katha-text/45">
              {copy.readerRoleLabel}
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-katha-primary/25 bg-katha-primary/10 px-3 py-1 text-sm font-bold text-katha-primary-light">
                 {appRole === 'admin' ? copy.accountRoleAdmin : copy.accountRoleReader}
               </span>
              <span className="text-xs text-katha-text/42">app_role: {appRole}</span>
            </div>
          </div>

          <form aria-label={copy.createReaderAccount} className="space-y-5 p-5 sm:p-7" onSubmit={handleSubmit} noValidate>
            <fieldset disabled={submitting}>
              <legend className="mb-2 text-sm font-semibold text-katha-text/72">
                {copy.readerRoleLabel}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(['reader', 'admin'] as const).map((role) => {
                  const selected = appRole === role;
                  const label = role === 'admin' ? copy.accountRoleAdmin : copy.accountRoleReader;
                  return (
                    <label
                      key={role}
                      className={`cursor-pointer rounded-2xl border px-4 py-3 text-center text-sm font-bold transition ${
                        selected
                          ? 'border-katha-primary/50 bg-katha-primary/12 text-katha-primary-light ring-2 ring-katha-primary/10'
                          : 'border-katha-text/10 bg-katha-field/65 text-katha-text/60 hover:border-katha-text/20'
                      }`}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="account-role"
                        value={role}
                        checked={selected}
                        onChange={() => {
                          setAppRole(role);
                          clearFormFeedback();
                        }}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-xs leading-5 text-katha-text/45">
                {appRole === 'admin' ? copy.adminRoleHelp : copy.readerRoleHelp}
              </p>
            </fieldset>

            <div>
              <label className="mb-2 block text-sm font-semibold text-katha-text/72" htmlFor="reader-account-name">{copy.readerNameLabel}</label>
              <input
                id="reader-account-name"
                type="text"
                autoComplete="off"
                value={displayName}
                onChange={(event) => { setDisplayName(event.target.value); clearFormFeedback(); }}
                placeholder={copy.readerNamePlaceholder}
                disabled={submitting}
                aria-invalid={formError === copy.readerNameRequired}
                className="h-13 w-full rounded-2xl border border-katha-text/10 bg-katha-field/80 px-4 text-sm outline-none transition duration-200 placeholder:text-katha-text/24 hover:border-katha-text/20 focus:border-katha-gold/60 focus:bg-katha-field focus:ring-4 focus:ring-katha-gold/10 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-katha-text/72" htmlFor="reader-account-email">{copy.readerEmailLabel}</label>
              <input
                id="reader-account-email"
                type="email"
                autoComplete="off"
                inputMode="email"
                value={email}
                onChange={(event) => { setEmail(event.target.value); clearFormFeedback(); }}
                placeholder={copy.readerEmailPlaceholder}
                disabled={submitting}
                aria-invalid={formError === copy.readerEmailRequired || formError === copy.readerEmailInvalid}
                className="h-13 w-full rounded-2xl border border-katha-text/10 bg-katha-field/80 px-4 text-sm outline-none transition duration-200 placeholder:text-katha-text/24 hover:border-katha-text/20 focus:border-katha-gold/60 focus:bg-katha-field focus:ring-4 focus:ring-katha-gold/10 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-katha-text/72" htmlFor="reader-account-password">{copy.readerPasswordLabel}</label>
              <input
                id="reader-account-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => { setPassword(event.target.value); clearFormFeedback(); }}
                placeholder="••••••••"
                disabled={submitting}
                aria-describedby="reader-account-password-help"
                aria-invalid={formError === copy.readerPasswordRequired || formError === copy.readerPasswordTooShort}
                className="h-13 w-full rounded-2xl border border-katha-text/10 bg-katha-field/80 px-4 text-sm outline-none transition duration-200 placeholder:text-katha-text/24 hover:border-katha-text/20 focus:border-katha-gold/60 focus:bg-katha-field focus:ring-4 focus:ring-katha-gold/10 disabled:opacity-60"
              />
              <span id="reader-account-password-help" className="mt-2 block text-xs leading-5 text-katha-text/42">{copy.readerPasswordHelp}</span>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-katha-text/72" htmlFor="reader-account-password-confirmation">{copy.readerPasswordConfirmationLabel}</label>
              <input
                id="reader-account-password-confirmation"
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(event) => { setPasswordConfirmation(event.target.value); clearFormFeedback(); }}
                placeholder="••••••••"
                disabled={submitting}
                aria-invalid={formError === copy.readerPasswordConfirmationRequired || formError === copy.readerPasswordsDoNotMatch}
                className="h-13 w-full rounded-2xl border border-katha-text/10 bg-katha-field/80 px-4 text-sm outline-none transition duration-200 placeholder:text-katha-text/24 hover:border-katha-text/20 focus:border-katha-gold/60 focus:bg-katha-field focus:ring-4 focus:ring-katha-gold/10 disabled:opacity-60"
              />
            </div>

            {formError && <div role="alert" className="rounded-2xl border border-katha-error/25 bg-katha-error/10 px-4 py-3 text-sm text-katha-text">{formError}</div>}

            {formResult && (
              <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-katha-text">
                <p className="font-bold text-emerald-600 dark:text-emerald-300">
                  {formatCopy(copy.readerAccountCreated, { name: formResult.display_name ?? copy.readerUnnamed, email: formResult.email ?? formResult.id })}
                </p>
                <p className="mt-1 text-katha-text/60">{copy.readerReadyToSignIn}</p>
              </div>
            )}

            <button type="submit" disabled={submitting} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-katha-primary to-katha-primary-light px-5 text-sm font-black text-katha-on-solid shadow-xl shadow-katha-primary/20 transition hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0">
              {submitting && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-katha-on-solid/25 border-t-katha-on-solid" />}
              {submitting ? copy.creatingReaderAccount : copy.createReaderAccount}
            </button>
          </form>

          <div className="border-t border-katha-text/10 bg-katha-gold/[0.06] px-5 py-4 text-xs leading-5 text-katha-text/50 sm:px-7">{copy.accountsSecurityNote}</div>
        </section>

        <section className="katha-card min-w-0 overflow-hidden rounded-3xl border border-katha-text/10 bg-katha-text/[0.035] shadow-2xl sm:backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 border-b border-katha-text/10 px-5 py-5 sm:px-7">
            <div>
              <h2 className="text-lg font-black text-katha-text">{copy.readerListTitle}</h2>
              <p className="mt-1 text-xs text-katha-text/45">{formatCopy(copy.readerListCount, { total: accounts.length })}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setListState('loading');
                setListError(null);
                void loadAccounts();
              }}
              disabled={listState === 'loading'}
              className="rounded-xl border border-katha-text/10 px-3 py-2 text-xs font-bold text-katha-text/65 transition hover:bg-katha-text/[0.06] disabled:opacity-50"
            >
              {copy.retry}
            </button>
          </div>

          {deleteFeedback && <p role="status" className="mx-5 mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 sm:mx-7">{deleteFeedback}</p>}
          {listError && <p role="alert" className="mx-5 mt-5 rounded-2xl border border-katha-error/25 bg-katha-error/10 px-4 py-3 text-sm text-katha-text sm:mx-7">{listError}</p>}

          {listState === 'loading' ? (
            <div role="status" className="grid min-h-64 place-items-center p-8 text-sm text-katha-text/55">
              <span className="flex items-center gap-3"><span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-katha-primary/20 border-t-katha-primary" />{copy.readerListLoading}</span>
            </div>
          ) : listState === 'ready' && accounts.length === 0 ? (
            <div className="grid min-h-64 place-items-center p-8 text-center">
              <div>
                <div aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-2xl bg-katha-primary/10 text-xl">👤</div>
                <h3 className="mt-4 font-bold text-katha-text">{copy.readerListEmptyTitle}</h3>
                <p className="mt-2 text-sm text-katha-text/50">{copy.readerListEmptyBody}</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-katha-text/10" aria-label={copy.readerListTitle}>
              {accounts.map((account) => {
                const accountEmail = account.email ?? account.id;
                const accountName = account.display_name ?? copy.readerUnnamed;
                const accountRole =
                  account.app_role === 'admin' ? copy.accountRoleAdmin : copy.accountRoleReader;
                const isCurrentAccount = account.id === user?.id;
                return (
                  <li key={account.id} className="grid gap-4 px-5 py-5 sm:px-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-bold text-katha-text">{accountName}</p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                            account.app_role === 'admin'
                              ? 'bg-katha-gold/12 text-katha-gold'
                              : 'bg-katha-primary/10 text-katha-primary-light'
                          }`}
                        >
                          {accountRole}
                        </span>
                        {isCurrentAccount && (
                          <span className="rounded-full bg-katha-text/[0.07] px-2.5 py-1 text-[11px] font-bold text-katha-text/55">
                            {copy.currentAccountLabel}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm text-katha-text/60">{accountEmail}</p>
                      <dl className="mt-3 grid gap-2 text-xs text-katha-text/45 sm:grid-cols-2">
                        <div><dt className="font-semibold text-katha-text/55">{copy.readerCreatedAt}</dt><dd className="mt-0.5">{formatAccountDate(account.created_at)}</dd></div>
                        <div><dt className="font-semibold text-katha-text/55">{copy.readerLastSignIn}</dt><dd className="mt-0.5">{formatAccountDate(account.last_sign_in_at)}</dd></div>
                      </dl>
                    </div>
                    <button
                      type="button"
                      aria-label={
                        isCurrentAccount
                          ? copy.cannotDeleteCurrentAccount
                          : formatCopy(copy.deleteReader, { email: accountEmail })
                      }
                      onClick={() => { setAccountToDelete(account); setListError(null); setDeleteFeedback(null); }}
                      disabled={isCurrentAccount || deletingId === account.id}
                      className="rounded-xl border border-katha-error/25 bg-katha-error/[0.06] px-4 py-2.5 text-sm font-bold text-katha-error transition hover:bg-katha-error/12 disabled:opacity-50"
                    >
                      {deletingId === account.id ? copy.deletingReader : copy.deleteReaderAction}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {accountToDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 sm:backdrop-blur-sm" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-account-title" className="w-full max-w-md rounded-3xl border border-katha-text/10 bg-katha-surface p-6 shadow-2xl sm:p-7">
            <div aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-katha-error/12 text-xl">🗑️</div>
            <h2 id="delete-account-title" className="mt-5 text-xl font-black text-katha-text">{copy.deleteReaderTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-katha-text/60">
              {formatCopy(copy.deleteReaderConfirmation, {
                name: accountToDelete.display_name ?? copy.readerUnnamed,
                email: accountToDelete.email ?? accountToDelete.id,
                role:
                  accountToDelete.app_role === 'admin'
                    ? copy.accountRoleAdmin
                    : copy.accountRoleReader,
              })}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setAccountToDelete(null)} disabled={Boolean(deletingId)} className="rounded-xl border border-katha-text/10 px-4 py-2.5 text-sm font-bold text-katha-text/70 transition hover:bg-katha-text/[0.06] disabled:opacity-50">{copy.cancel}</button>
              <button type="button" onClick={() => void handleDelete()} disabled={Boolean(deletingId)} className="rounded-xl bg-katha-error px-4 py-2.5 text-sm font-black text-white transition hover:brightness-110 disabled:opacity-50">{deletingId ? copy.deletingReader : copy.deleteReaderAction}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
