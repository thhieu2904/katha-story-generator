'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';
import { createReaderAccount, type ReaderAccountResponse } from '../api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export function ReaderAccountsPage() {
  const { copy } = useUiCopy();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReaderAccountResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function clearFeedback() {
    setError(null);
    setResult(null);
  }

  function validate(): string | null {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return copy.readerEmailRequired;
    if (!EMAIL_PATTERN.test(normalizedEmail)) return copy.readerEmailInvalid;
    if (!password) return copy.readerPasswordRequired;
    if (password.length < MIN_PASSWORD_LENGTH) return copy.readerPasswordTooShort;
    if (!passwordConfirmation) return copy.readerPasswordConfirmationRequired;
    if (password !== passwordConfirmation) return copy.readerPasswordsDoNotMatch;
    return null;
  }

  function requestErrorMessage(caughtError: unknown): string {
    if (!(caughtError instanceof ApiError)) return copy.readerCreateFailed;
    if (caughtError.status === 409) return copy.readerAccountAlreadyExists;
    if (caughtError.status === 400) return copy.readerAccountRejected;
    return copy.readerAccountUnavailable;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    clearFeedback();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const response = await createReaderAccount({
        email: email.trim(),
        password,
      });
      setResult(response);
      setEmail('');
      setPassword('');
      setPasswordConfirmation('');
    } catch (caughtError) {
      setError(requestErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
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

      <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.75fr)] lg:gap-7">
        <section className="katha-card overflow-hidden rounded-3xl border border-katha-text/10 bg-katha-text/[0.035] shadow-2xl backdrop-blur-xl">
          <div className="border-b border-katha-text/10 bg-katha-field/45 px-5 py-4 sm:px-7">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-katha-text/45">
              {copy.readerRoleLabel}
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-katha-primary/25 bg-katha-primary/10 px-3 py-1 text-sm font-bold text-katha-primary-light">
                {copy.readerRoleValue}
              </span>
              <span className="text-xs text-katha-text/42">app_role: reader</span>
            </div>
          </div>

          <form
            aria-label={copy.accountsTitle}
            className="space-y-5 p-5 sm:p-7"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="group block">
              <label
                className="mb-2 block text-sm font-semibold text-katha-text/72"
                htmlFor="reader-account-email"
              >
                {copy.readerEmailLabel}
              </label>
              <input
                id="reader-account-email"
                type="email"
                autoComplete="off"
                inputMode="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearFeedback();
                }}
                placeholder={copy.readerEmailPlaceholder}
                disabled={submitting}
                aria-invalid={error === copy.readerEmailRequired || error === copy.readerEmailInvalid}
                className="h-13 w-full rounded-2xl border border-katha-text/10 bg-katha-field/80 px-4 text-sm outline-none transition duration-200 placeholder:text-katha-text/24 hover:border-katha-text/20 focus:border-katha-gold/60 focus:bg-katha-field focus:ring-4 focus:ring-katha-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="group block">
              <label
                className="mb-2 block text-sm font-semibold text-katha-text/72"
                htmlFor="reader-account-password"
              >
                {copy.readerPasswordLabel}
              </label>
              <input
                id="reader-account-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearFeedback();
                }}
                placeholder="••••••••"
                disabled={submitting}
                aria-describedby="reader-account-password-help"
                aria-invalid={error === copy.readerPasswordRequired || error === copy.readerPasswordTooShort}
                className="h-13 w-full rounded-2xl border border-katha-text/10 bg-katha-field/80 px-4 text-sm outline-none transition duration-200 placeholder:text-katha-text/24 hover:border-katha-text/20 focus:border-katha-gold/60 focus:bg-katha-field focus:ring-4 focus:ring-katha-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span id="reader-account-password-help" className="mt-2 block text-xs leading-5 text-katha-text/42">
                {copy.readerPasswordHelp}
              </span>
            </div>

            <div className="group block">
              <label
                className="mb-2 block text-sm font-semibold text-katha-text/72"
                htmlFor="reader-account-password-confirmation"
              >
                {copy.readerPasswordConfirmationLabel}
              </label>
              <input
                id="reader-account-password-confirmation"
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(event) => {
                  setPasswordConfirmation(event.target.value);
                  clearFeedback();
                }}
                placeholder="••••••••"
                disabled={submitting}
                aria-invalid={
                  error === copy.readerPasswordConfirmationRequired ||
                  error === copy.readerPasswordsDoNotMatch
                }
                className="h-13 w-full rounded-2xl border border-katha-text/10 bg-katha-field/80 px-4 text-sm outline-none transition duration-200 placeholder:text-katha-text/24 hover:border-katha-text/20 focus:border-katha-gold/60 focus:bg-katha-field focus:ring-4 focus:ring-katha-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-2xl border border-katha-error/25 bg-katha-error/10 px-4 py-3 text-sm text-katha-text"
              >
                <span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-katha-error/15 text-xs font-black text-katha-error">
                  !
                </span>
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-katha-text"
              >
                <p className="font-bold text-emerald-600 dark:text-emerald-300">
                  {formatCopy(copy.readerAccountCreated, { email: result.email })}
                </p>
                <p className="mt-1 leading-5 text-katha-text/60">
                  {result.confirmation_required
                    ? copy.readerConfirmationRequired
                    : copy.readerReadyToSignIn}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-katha-primary to-katha-primary-light px-5 text-sm font-black text-katha-on-solid shadow-xl shadow-katha-primary/20 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-katha-primary/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto sm:min-w-56"
            >
              {submitting && (
                <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-katha-on-solid/25 border-t-katha-on-solid" />
              )}
              {submitting ? copy.creatingReaderAccount : copy.createReaderAccount}
            </button>
          </form>
        </section>

        <aside className="katha-card rounded-3xl border border-katha-gold/20 bg-katha-text/[0.035] p-5 shadow-xl sm:p-6">
          <div className="grid size-11 place-items-center rounded-2xl bg-katha-gold/12 text-xl" aria-hidden="true">
            🔐
          </div>
          <h2 className="mt-4 text-base font-bold text-katha-text">{copy.readerRoleValue}</h2>
          <p className="mt-2 text-sm leading-6 text-katha-text/55">{copy.readerRoleHelp}</p>
          <div className="mt-5 border-t border-katha-text/10 pt-5 text-xs leading-5 text-katha-text/45">
            {copy.accountsSecurityNote}
          </div>
        </aside>
      </div>
    </main>
  );
}
