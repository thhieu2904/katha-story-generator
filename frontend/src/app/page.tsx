'use client';

import { useEffect, useState } from 'react';
import { fetchHealth, type HealthResponse } from '@/lib/api';

type ConnectionState = 'loading' | 'connected' | 'error';

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('loading');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer mounted state to avoid synchronous setState in effect body
    const frame = requestAnimationFrame(() => setMounted(true));
    
    const checkHealth = async () => {
      try {
        const data = await fetchHealth();
        setHealth(data);
        setConnectionState('connected');
      } catch {
        setConnectionState('error');
      }
    };

    checkHealth();

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4">
      {/* Animated background gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-1/4 -left-1/4 h-[600px] w-[600px] rounded-full opacity-20 blur-[120px]"
          style={{
            background: 'radial-gradient(circle, oklch(0.65 0.15 250), transparent 70%)',
            animation: 'float 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -right-1/4 -bottom-1/4 h-[500px] w-[500px] rounded-full opacity-15 blur-[100px]"
          style={{
            background: 'radial-gradient(circle, oklch(0.75 0.15 150), transparent 70%)',
            animation: 'float 10s ease-in-out infinite reverse',
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-[80px]"
          style={{
            background: 'radial-gradient(circle, oklch(0.80 0.15 85), transparent 70%)',
            animation: 'float 12s ease-in-out infinite 2s',
          }}
        />
      </div>

      {/* Main content */}
      <div
        className={`relative z-10 flex flex-col items-center gap-8 transition-all duration-1000 ${
          mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}
      >
        {/* Logo & Title Section */}
        <div className="flex flex-col items-center gap-3 text-center">
          {/* Decorative icon */}
          <div
            className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, oklch(0.65 0.15 250), oklch(0.75 0.15 150))',
              boxShadow: '0 0 40px oklch(0.65 0.15 250 / 0.3)',
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
              <path d="M8 7h6" />
              <path d="M8 11h8" />
            </svg>
          </div>

          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, oklch(0.75 0.12 250), white 50%, oklch(0.75 0.15 150))',
              }}
            >
              Katha
            </span>
          </h1>

          <p className="text-khmer mt-1" style={{ color: 'oklch(0.85 0.08 250)' }}>
            កថា — កម្មវិធីបង្កើតរឿងព្រេងនិទាន AI
          </p>

          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/50">
            AI-powered bilingual story generator for Cambodian children — Khmer &amp; Vietnamese
          </p>
        </div>

        {/* Status Card */}
        <div
          className={`w-full max-w-sm rounded-2xl border p-6 backdrop-blur-xl transition-all duration-700 delay-300 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
          style={{
            background: 'oklch(0.22 0.015 250 / 0.6)',
            borderColor: 'oklch(0.35 0.03 250)',
            boxShadow: '0 8px 32px oklch(0 0 0 / 0.3), inset 0 1px 0 oklch(1 0 0 / 0.05)',
          }}
        >
          {/* Card Header */}
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
              System Status
            </h2>
            {connectionState === 'loading' && (
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: 'oklch(0.80 0.15 85)',
                    animation: 'pulse-dot 1.5s ease-in-out infinite',
                  }}
                />
                <span className="text-xs text-white/30">Connecting…</span>
              </div>
            )}
            {connectionState === 'connected' && (
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: 'oklch(0.72 0.17 150)',
                    boxShadow: '0 0 8px oklch(0.72 0.17 150 / 0.6)',
                  }}
                />
                <span className="text-xs" style={{ color: 'oklch(0.72 0.17 150)' }}>
                  {health?.status === 'healthy' ? 'All Systems Go' : 'Degraded'}
                </span>
              </div>
            )}
            {connectionState === 'error' && (
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: 'oklch(0.65 0.2 25)',
                    boxShadow: '0 0 8px oklch(0.65 0.2 25 / 0.6)',
                  }}
                />
                <span className="text-xs" style={{ color: 'oklch(0.65 0.2 25)' }}>
                  Offline
                </span>
              </div>
            )}
          </div>

          {/* Status Rows */}
          {connectionState === 'loading' && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div
                    className="h-3 rounded"
                    style={{
                      width: `${60 + i * 15}px`,
                      backgroundColor: 'oklch(0.3 0.01 250)',
                      animation: `shimmer 1.5s ease-in-out infinite ${i * 0.2}s`,
                    }}
                  />
                  <div
                    className="h-3 w-12 rounded"
                    style={{
                      backgroundColor: 'oklch(0.3 0.01 250)',
                      animation: `shimmer 1.5s ease-in-out infinite ${i * 0.2 + 0.1}s`,
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {connectionState === 'connected' && health && (
            <div className="space-y-3">
              <StatusRow
                label="Database"
                status={health.checks.database}
              />
              <StatusRow
                label="R2 Storage"
                status={health.checks.r2}
              />
              <div
                className="mt-4 border-t pt-4"
                style={{ borderColor: 'oklch(0.35 0.03 250)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Version</span>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      background: 'oklch(0.65 0.15 250 / 0.15)',
                      color: 'oklch(0.75 0.12 250)',
                    }}
                  >
                    v{health.version}
                  </span>
                </div>
              </div>
            </div>
          )}

          {connectionState === 'error' && (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: 'oklch(0.65 0.2 25 / 0.15)' }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="oklch(0.65 0.2 25)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="text-xs text-white/40">
                Backend API is not reachable.
                <br />
                <span className="text-white/25">
                  Start the server at{' '}
                  <code
                    className="rounded px-1.5 py-0.5 text-[10px]"
                    style={{ background: 'oklch(0.3 0.01 250)' }}
                  >
                    localhost:8000
                  </code>
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Footer tagline */}
        <p
          className={`text-[11px] text-white/20 transition-all duration-700 delay-500 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          Stories that bridge languages — built with ♥ for Cambodia
        </p>
      </div>

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-30px) scale(1.05);
          }
        }
        @keyframes pulse-dot {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
        @keyframes shimmer {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }
      `}</style>
    </main>
  );
}

function StatusRow({
  label,
  status,
}: {
  label: string;
  status: 'ok' | 'unavailable';
}) {
  const isOk = status === 'ok';

  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-2.5"
      style={{ background: 'oklch(0.20 0.01 250 / 0.5)' }}
    >
      <span className="text-sm text-white/60">{label}</span>
      <div className="flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: isOk ? 'oklch(0.72 0.17 150)' : 'oklch(0.65 0.2 25)',
            boxShadow: isOk
              ? '0 0 8px oklch(0.72 0.17 150 / 0.5)'
              : '0 0 8px oklch(0.65 0.2 25 / 0.5)',
          }}
        />
        <span
          className="text-xs font-medium"
          style={{ color: isOk ? 'oklch(0.72 0.17 150)' : 'oklch(0.65 0.2 25)' }}
        >
          {isOk ? 'Connected' : 'Unavailable'}
        </span>
      </div>
    </div>
  );
}
