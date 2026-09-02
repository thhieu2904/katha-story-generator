'use client';

import Image from 'next/image';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';

interface HistoryPoint {
  id: string;
  x: number;
  y: number;
  image: { src: string; alt: string } | null;
}

interface BranchDecoration {
  x: number;
  y: number;
  rotation: number;
  size: number;
  flower?: 'gold' | 'coral';
  pendants?: boolean;
}

interface HistoryBranch {
  id: string;
  stage: number;
  side: 'left' | 'right';
  path: string;
  twigs: ReadonlyArray<string>;
  decorations: ReadonlyArray<BranchDecoration>;
  start: number;
  end: number;
  points: ReadonlyArray<HistoryPoint>;
}

const HISTORY_BRANCHES: ReadonlyArray<HistoryBranch> = [
  {
    id: 'stage-1',
    stage: 1,
    side: 'left',
    path: 'M 500 735 C 465 722, 442 698, 409 676 C 366 647, 325 632, 279 615 C 237 599, 199 580, 164 552',
    twigs: [
      'M 410 677 C 386 640, 360 610, 329 584',
      'M 327 632 C 291 653, 254 664, 216 652',
      'M 254 606 C 222 581, 196 551, 178 518',
    ],
    decorations: [
      { x: 392, y: 658, rotation: -18, size: 0.68 },
      { x: 299, y: 616, rotation: -24, size: 0.82, flower: 'coral' },
      { x: 220, y: 646, rotation: -5, size: 0.68 },
      { x: 169, y: 548, rotation: -32, size: 0.98, flower: 'gold', pendants: true },
    ],
    start: 0.1,
    end: 0.27,
    points: [{ id: 'stage-1-point-1', x: 280, y: 615, image: null }],
  },
  {
    id: 'stage-2',
    stage: 2,
    side: 'right',
    path: 'M 501 658 C 544 642, 573 609, 616 585 C 663 559, 710 559, 756 535 C 798 513, 829 485, 859 451',
    twigs: [
      'M 617 585 C 644 548, 670 518, 702 492',
      'M 707 560 C 748 580, 786 587, 822 574',
      'M 778 524 C 811 498, 838 465, 855 427',
    ],
    decorations: [
      { x: 620, y: 568, rotation: 18, size: 0.68 },
      { x: 715, y: 548, rotation: 22, size: 0.82, flower: 'gold' },
      { x: 810, y: 568, rotation: 4, size: 0.66 },
      { x: 856, y: 447, rotation: 34, size: 1, flower: 'coral', pendants: true },
    ],
    start: 0.22,
    end: 0.4,
    points: [{ id: 'stage-2-point-1', x: 746, y: 541, image: null }],
  },
  {
    id: 'stage-3',
    stage: 3,
    side: 'left',
    path: 'M 493 574 C 454 560, 427 531, 390 502 C 349 471, 302 456, 259 430 C 219 405, 190 372, 157 333',
    twigs: [
      'M 391 502 C 364 465, 335 438, 301 413',
      'M 304 458 C 270 479, 235 491, 199 483',
      'M 235 414 C 209 383, 188 349, 174 313',
    ],
    decorations: [
      { x: 385, y: 484, rotation: -17, size: 0.66 },
      { x: 286, y: 443, rotation: -23, size: 0.83, flower: 'gold' },
      { x: 204, y: 477, rotation: -4, size: 0.64 },
      { x: 157, y: 328, rotation: -34, size: 1.02, flower: 'coral', pendants: true },
    ],
    start: 0.35,
    end: 0.53,
    points: [{ id: 'stage-3-point-1', x: 260, y: 430, image: null }],
  },
  {
    id: 'stage-4',
    stage: 4,
    side: 'right',
    path: 'M 494 488 C 533 474, 559 442, 598 413 C 641 381, 689 370, 731 340 C 770 312, 800 275, 834 228',
    twigs: [
      'M 599 413 C 626 376, 656 347, 690 322',
      'M 683 373 C 721 393, 760 400, 798 388',
      'M 752 325 C 785 295, 812 261, 830 216',
    ],
    decorations: [
      { x: 603, y: 395, rotation: 17, size: 0.67 },
      { x: 703, y: 359, rotation: 22, size: 0.84, flower: 'coral' },
      { x: 790, y: 382, rotation: 3, size: 0.64 },
      { x: 834, y: 224, rotation: 35, size: 1.02, flower: 'gold', pendants: true },
    ],
    start: 0.48,
    end: 0.66,
    points: [{ id: 'stage-4-point-1', x: 720, y: 348, image: null }],
  },
  {
    id: 'stage-5',
    stage: 5,
    side: 'left',
    path: 'M 496 402 C 460 388, 441 354, 409 327 C 373 296, 332 277, 297 247 C 266 221, 247 190, 220 155',
    twigs: [
      'M 409 327 C 384 292, 360 265, 330 238',
      'M 330 277 C 294 296, 260 305, 226 294',
      'M 280 230 C 257 202, 240 173, 227 139',
    ],
    decorations: [
      { x: 403, y: 310, rotation: -16, size: 0.68 },
      { x: 313, y: 262, rotation: -23, size: 0.84, flower: 'coral' },
      { x: 231, y: 289, rotation: -4, size: 0.63 },
      { x: 220, y: 151, rotation: -34, size: 1, flower: 'gold', pendants: true },
    ],
    start: 0.61,
    end: 0.79,
    points: [{ id: 'stage-5-point-1', x: 300, y: 250, image: null }],
  },
  {
    id: 'stage-6',
    stage: 6,
    side: 'right',
    path: 'M 501 316 C 533 301, 551 269, 580 242 C 614 211, 652 199, 686 177 C 717 157, 742 130, 768 99',
    twigs: [
      'M 580 242 C 602 209, 626 184, 655 162',
      'M 648 202 C 682 219, 715 225, 748 216',
      'M 703 168 C 729 143, 750 115, 762 86',
    ],
    decorations: [
      { x: 576, y: 226, rotation: 16, size: 0.68 },
      { x: 669, y: 189, rotation: 21, size: 0.84, flower: 'gold' },
      { x: 739, y: 211, rotation: 1, size: 0.62 },
      { x: 768, y: 95, rotation: 34, size: 0.98, flower: 'coral', pendants: true },
    ],
    start: 0.74,
    end: 0.94,
    points: [{ id: 'stage-6-point-1', x: 682, y: 180, image: null }],
  },
];

const GOLDEN_LEAF_LAYOUT = [
  [-29, -2, -68, 0.68],
  [-21, -21, -40, 0.58],
  [-5, -32, -10, 0.66],
  [13, -29, 20, 0.58],
  [29, -13, 54, 0.66],
  [29, 8, 96, 0.54],
  [11, 16, 143, 0.52],
  [-12, 14, -145, 0.52],
] as const;

const TREE_TOP_DECORATIONS: ReadonlyArray<BranchDecoration> = [
  { x: 451, y: 91, rotation: -23, size: 0.82, flower: 'coral', pendants: true },
  { x: 501, y: 48, rotation: 0, size: 0.96, flower: 'gold', pendants: true },
  { x: 553, y: 88, rotation: 24, size: 0.84, flower: 'coral', pendants: true },
  { x: 480, y: 133, rotation: -12, size: 0.62 },
  { x: 527, y: 132, rotation: 13, size: 0.62 },
];

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothStep(value: number) {
  const bounded = clamp(value);
  return bounded * bounded * (3 - 2 * bounded);
}

function progressBetween(progress: number, start: number, end: number) {
  return smoothStep((progress - start) / (end - start));
}

function setStyleProperty(
  element: HTMLElement | SVGElement,
  property: `--museum-${string}`,
  value: number | string,
) {
  const nextValue = typeof value === 'number' ? value.toFixed(4) : value;
  if (element.style.getPropertyValue(property) !== nextValue) {
    element.style.setProperty(property, nextValue);
  }
}

function GoldenSprig({
  x,
  y,
  rotation,
  size,
  flower,
  pendants = false,
}: BranchDecoration) {
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${rotation}) scale(${size})`}
      aria-hidden="true"
    >
      <path
        d="M -31 9 C -20 4, -11 -2, 0 -9 C 10 -4, 20 1, 32 8 M 0 -8 C -2 -19, -2 -27, -5 -35 M -8 -3 C -17 -10, -22 -17, -24 -23 M 10 -3 C 18 -10, 24 -16, 27 -22"
        fill="none"
        stroke="#d99819"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {pendants && (
        <g opacity="0.92">
          <path d="M -21 8 C -20 20, -18 29, -15 38" fill="none" stroke="#d7981c" strokeWidth="1.4" />
          <path d="M 4 10 C 4 24, 2 33, 4 44" fill="none" stroke="#e9af26" strokeWidth="1.4" />
          <path d="M 25 7 C 26 18, 24 27, 20 36" fill="none" stroke="#d7981c" strokeWidth="1.4" />
          <circle cx="-15" cy="39" r="3.8" fill="#f4bd2d" stroke="#a75d0d" strokeWidth="1" />
          <circle cx="4" cy="45" r="3.5" fill="#ffd960" stroke="#a75d0d" strokeWidth="1" />
          <circle cx="20" cy="37" r="3.8" fill="#eca51b" stroke="#a75d0d" strokeWidth="1" />
        </g>
      )}

      {GOLDEN_LEAF_LAYOUT.map(([leafX, leafY, rotation, leafScale], leafIndex) => (
        <use
          key={`${leafX}-${leafY}`}
          href="#museum-gold-leaf"
          transform={`translate(${leafX} ${leafY}) rotate(${rotation}) scale(${leafScale})`}
          opacity={0.76 + (leafIndex % 3) * 0.08}
        />
      ))}

      {flower && (
        <use
          href={flower === 'coral' ? '#museum-coral-flower' : '#museum-gold-flower'}
          transform="translate(0 -7) scale(0.68)"
        />
      )}
    </g>
  );
}

export function KhmerHistoryTreePrototype() {
  const { copy } = useUiCopy();
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const progressLabelRef = useRef<HTMLSpanElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [compactView, setCompactView] = useState(false);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  useEffect(() => {
    const sticky = stickyRef.current;
    if (!sticky) return;
    const stickyElement: HTMLDivElement = sticky;

    const reducedMotionQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    const branchGroups = Array.from(
      stickyElement.querySelectorAll<SVGGElement>('[data-tree-branch-group]'),
    ).map((element) => ({
      element,
      start: Number(element.dataset.start),
      end: Number(element.dataset.end),
      nodes: Array.from(element.querySelectorAll<SVGGElement>('[data-tree-node]')),
    }));
    const trunkGuide = stickyElement.querySelector<SVGPathElement>('[data-tree-trunk-guide]');
    const growthTip = stickyElement.querySelector<SVGGElement>('[data-tree-growth-tip]');
    const canPositionGrowthTip = Boolean(
      trunkGuide
      && growthTip
      && typeof trunkGuide.getTotalLength === 'function'
      && typeof trunkGuide.getPointAtLength === 'function',
    );
    const trunkGuideLength = canPositionGrowthTip ? trunkGuide?.getTotalLength() ?? 0 : 0;

    function paintProgress(progress: number) {
      const rootProgress = progressBetween(progress, 0, 0.14);
      const trunkProgress = progressBetween(progress, 0.01, 0.88);
      const crownProgress = progressBetween(progress, 0.82, 1);

      setStyleProperty(stickyElement, '--museum-root-opacity', 0.3 + rootProgress * 0.45);
      setStyleProperty(stickyElement, '--museum-root-offset', 1 - rootProgress);
      setStyleProperty(stickyElement, '--museum-trunk-offset', 1 - trunkProgress);
      setStyleProperty(stickyElement, '--museum-crown-opacity', crownProgress);
      setStyleProperty(stickyElement, '--museum-crown-offset', 1 - crownProgress);
      setStyleProperty(stickyElement, '--museum-header-opacity', clamp(1 - progress * 2.8));
      setStyleProperty(stickyElement, '--museum-header-offset', `${-progress * 18}px`);
      setStyleProperty(stickyElement, '--museum-scroll-hint-opacity', clamp(1 - progress * 7));
      setStyleProperty(stickyElement, '--museum-progress-height', `${Math.max(progress * 100, 3)}%`);

      if (growthTip && canPositionGrowthTip && trunkGuide) {
        const showGrowthTip = trunkProgress > 0.015 && trunkProgress < 0.99;
        const nextOpacity = showGrowthTip ? '1' : '0';
        if (growthTip.style.opacity !== nextOpacity) {
          growthTip.style.opacity = nextOpacity;
        }

        if (showGrowthTip) {
          const tipPathProgress = clamp(trunkProgress + 0.052);
          const tipPoint = trunkGuide.getPointAtLength(trunkGuideLength * tipPathProgress);
          const tipScale = 0.48 + (1 - trunkProgress) * 0.72;
          const nextTransform = `translate(${tipPoint.x.toFixed(2)} ${tipPoint.y.toFixed(2)}) scale(${tipScale.toFixed(4)})`;
          if (growthTip.getAttribute('transform') !== nextTransform) {
            growthTip.setAttribute('transform', nextTransform);
          }
        }
      }

      const progressLabel = progressLabelRef.current;
      const nextLabel = `${Math.round(progress * 100)}%`;
      if (progressLabel && progressLabel.textContent !== nextLabel) {
        progressLabel.textContent = nextLabel;
      }

      branchGroups.forEach(({ element, start, end, nodes }) => {
        const branchProgress = progressBetween(progress, start, end);
        const twigProgress = progressBetween(branchProgress, 0.34, 0.92);
        const nodeProgress = progressBetween(branchProgress, 0.62, 1);
        const isInteractive = nodeProgress > 0.92;

        setStyleProperty(element, '--museum-branch-offset', 1 - branchProgress);
        setStyleProperty(element, '--museum-twig-offset', 1 - twigProgress);
        setStyleProperty(element, '--museum-node-opacity', nodeProgress);
        setStyleProperty(element, '--museum-node-scale', 0.7 + nodeProgress * 0.3);
        setStyleProperty(
          element,
          '--museum-node-pointer-events',
          isInteractive ? 'auto' : 'none',
        );

        nodes.forEach((node) => {
          const nextTabIndex = isInteractive ? '0' : '-1';
          if (node.getAttribute('tabindex') !== nextTabIndex) {
            node.setAttribute('tabindex', nextTabIndex);
          }

          if (isInteractive) {
            node.removeAttribute('aria-hidden');
          } else if (node.getAttribute('aria-hidden') !== 'true') {
            node.setAttribute('aria-hidden', 'true');
          }
        });
      });
    }

    function syncCompactView() {
      const nextCompactView = window.innerWidth < 640;
      setCompactView((currentCompactView) =>
        currentCompactView === nextCompactView ? currentCompactView : nextCompactView,
      );
    }

    function measureProgress() {
      const section = sectionRef.current;
      if (!section) return;

      if (reducedMotionQuery?.matches) {
        paintProgress(1);
        return;
      }

      const headerOffset = 64;
      const rect = section.getBoundingClientRect();
      const stickyHeight = Math.max(window.innerHeight - headerOffset, 1);
      const travelDistance = Math.max(rect.height - stickyHeight, 1);
      const nextProgress = clamp((headerOffset - rect.top) / travelDistance);

      paintProgress(nextProgress);
    }

    function scheduleMeasurement() {
      if (animationFrameRef.current !== null) return;
      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        measureProgress();
      });
    }

    function handleResize() {
      syncCompactView();
      scheduleMeasurement();
    }

    syncCompactView();
    measureProgress();
    window.addEventListener('scroll', scheduleMeasurement, { passive: true });
    window.addEventListener('resize', handleResize);
    reducedMotionQuery?.addEventListener?.('change', scheduleMeasurement);

    return () => {
      window.removeEventListener('scroll', scheduleMeasurement);
      window.removeEventListener('resize', handleResize);
      reducedMotionQuery?.removeEventListener?.('change', scheduleMeasurement);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedPointId(null);
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const activePointId = selectedPointId ?? hoveredPointId;
  const activeBranch = HISTORY_BRANCHES.find((branch) =>
    branch.points.some((point) => point.id === activePointId),
  );
  const activePoint = activeBranch?.points.find((point) => point.id === activePointId);
  const compactBranchTransform = compactView ? 'translate(250 0) scale(0.5 1)' : undefined;

  function displayTreeX(x: number) {
    return compactView ? 500 + (x - 500) * 0.5 : x;
  }

  function pointLabel(branch: HistoryBranch) {
    return formatCopy(copy.museumHistoryStagePlaceholder, {
      stage: String(branch.stage).padStart(2, '0'),
    });
  }

  function togglePoint(pointId: string) {
    setSelectedPointId((currentPointId) => currentPointId === pointId ? null : pointId);
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby="museum-history-tree-title"
      className="relative mt-16 min-h-[500svh] motion-reduce:min-h-0 sm:mt-24"
    >
      <div
        ref={stickyRef}
        className="sticky top-16 h-[calc(100svh-4rem)] min-h-[560px] overflow-hidden border-y border-katha-gold/20 bg-katha-surface [contain:layout_paint_style] motion-reduce:relative motion-reduce:top-auto motion-reduce:h-[calc(100svh-4rem)]"
        onClick={() => setSelectedPointId(null)}
        style={{
          backgroundImage: [
            'radial-gradient(circle at 50% 72%, color-mix(in oklab, var(--color-katha-gold) 16%, transparent), transparent 34%)',
            'radial-gradient(circle at 12% 20%, color-mix(in oklab, var(--color-katha-heritage) 9%, transparent), transparent 28%)',
            'linear-gradient(180deg, color-mix(in oklab, var(--color-katha-surface-light) 98%, var(--color-katha-primary) 2%), var(--color-katha-surface))',
          ].join(', '),
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:url('/khmer-kbach-pattern.svg')] [background-size:180px_180px]" />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 px-5 pt-5 text-center will-change-[opacity,transform] sm:pt-7"
          style={{
            opacity: 'var(--museum-header-opacity, 1)',
            transform: 'translateY(var(--museum-header-offset, 0px))',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-katha-gold sm:text-xs">
            {copy.museumHistoryEyebrow}
          </p>
          <h2
            id="museum-history-tree-title"
            className="mx-auto mt-1.5 max-w-3xl text-xl font-bold tracking-tight text-katha-text sm:text-3xl"
          >
            {copy.museumHistoryTitle}
          </h2>
          <p className="mx-auto mt-1.5 max-w-xl text-[11px] leading-5 text-katha-text/55 sm:text-sm">
            {copy.museumHistoryPrototypeNotice}
          </p>
          <p
            className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-katha-primary-light motion-reduce:hidden sm:text-xs"
            style={{ opacity: 'var(--museum-scroll-hint-opacity, 1)' }}
          >
            {copy.museumHistoryScrollHint} ↓
          </p>
        </div>

        <svg
          viewBox={compactView ? '270 0 460 900' : '0 0 1000 900'}
          preserveAspectRatio="xMidYMax meet"
          className="absolute inset-0 h-full w-full"
          aria-label={copy.museumHistoryTreeAriaLabel}
          role="group"
        >
          <defs>
            <linearGradient id="museum-tree-trunk" x1="0" y1="0.5" x2="1" y2="0.5">
              <stop offset="0" stopColor="#7d4109" />
              <stop offset="0.2" stopColor="#b96b0f" />
              <stop offset="0.48" stopColor="#f2b82a" />
              <stop offset="0.67" stopColor="#ffe071" />
              <stop offset="0.84" stopColor="#ca7a12" />
              <stop offset="1" stopColor="#6d3508" />
            </linearGradient>
            <linearGradient id="museum-tree-branch" x1="0" y1="0.5" x2="1" y2="0.35">
              <stop offset="0" stopColor="#8f4c0b" />
              <stop offset="0.46" stopColor="#d88814" />
              <stop offset="1" stopColor="#f4bd32" />
            </linearGradient>
            <linearGradient id="museum-tree-branch-right" x1="0" y1="0.5" x2="1" y2="0.3">
              <stop offset="0" stopColor="#8a470a" />
              <stop offset="0.42" stopColor="#d48712" />
              <stop offset="0.78" stopColor="#f2b82a" />
              <stop offset="1" stopColor="#ffe17a" />
            </linearGradient>
            <linearGradient id="museum-tree-branch-left" x1="1" y1="0.5" x2="0" y2="0.3">
              <stop offset="0" stopColor="#8a470a" />
              <stop offset="0.42" stopColor="#d48712" />
              <stop offset="0.78" stopColor="#f2b82a" />
              <stop offset="1" stopColor="#ffe17a" />
            </linearGradient>
            <linearGradient id="museum-tree-leaf-gold" x1="0.2" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor="#fff3ad" />
              <stop offset="0.35" stopColor="#f4ca49" />
              <stop offset="0.72" stopColor="#d8941c" />
              <stop offset="1" stopColor="#9a540d" />
            </linearGradient>
            <g id="museum-gold-leaf">
              <path
                d="M 0 -19 C 10 -15, 15 -7, 12 2 C 10 10, 4 16, 0 21 C -4 16, -10 11, -12 4 C -16 -6, -11 -15, 0 -19 Z"
                fill="url(#museum-tree-leaf-gold)"
                stroke="#8f4c0c"
                strokeWidth="1"
              />
              <path d="M 0 -15 C -1 -5, 0 7, 0 17" fill="none" stroke="#9e5b10" strokeWidth="0.9" opacity="0.7" />
              <path d="M -5 -13 C 0 -12, 5 -7, 7 -2" fill="none" stroke="#fff0a0" strokeWidth="1.1" opacity="0.5" />
            </g>
            <g id="museum-gold-flower">
              {[0, 72, 144, 216, 288].map((rotation) => (
                <ellipse
                  key={rotation}
                  cx="0"
                  cy="-10"
                  rx="7.5"
                  ry="13"
                  transform={`rotate(${rotation})`}
                  fill="#ffd74d"
                  stroke="#e59a16"
                  strokeWidth="1.1"
                />
              ))}
              <circle r="7" fill="#e4562c" />
              <circle r="3" fill="#9d2f1e" />
            </g>
            <g id="museum-coral-flower">
              {[0, 72, 144, 216, 288].map((rotation) => (
                <ellipse
                  key={rotation}
                  cx="0"
                  cy="-9"
                  rx="6.8"
                  ry="11.5"
                  transform={`rotate(${rotation})`}
                  fill="#ed7132"
                  stroke="#ae361e"
                  strokeWidth="1"
                />
              ))}
              <circle r="6.5" fill="#ffd653" />
              <circle r="2.8" fill="#8d2b18" />
            </g>
            <mask id="museum-trunk-reveal" maskUnits="userSpaceOnUse" x="400" y="70" width="210" height="810">
              <path
                data-tree-trunk-guide
                d="M 500 854 C 483 812, 491 778, 482 743 C 472 705, 500 674, 487 638 C 475 600, 505 566, 490 528 C 478 491, 506 454, 493 416 C 482 380, 509 344, 500 306 C 492 267, 510 229, 504 191 C 501 158, 502 131, 505 104"
                pathLength={1}
                fill="none"
                stroke="white"
                strokeWidth="116"
                strokeLinecap="round"
                strokeDasharray="1"
                style={{ strokeDashoffset: 'var(--museum-trunk-offset, 1)' }}
              />
            </mask>
            <filter id="museum-tree-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <ellipse
            cx="500"
            cy="858"
            rx="292"
            ry="23"
            fill="color-mix(in oklab, #d79518 20%, transparent)"
            style={{ opacity: 'var(--museum-root-opacity, 0.3)' }}
          />

          <g transform={compactBranchTransform}>
            {[
              'M 484 831 C 435 820, 393 838, 347 851 C 301 865, 248 864, 194 853',
              'M 516 832 C 565 822, 607 840, 654 853 C 703 866, 756 864, 810 851',
              'M 475 840 C 438 849, 404 867, 366 880',
              'M 525 840 C 561 850, 596 868, 634 881',
              'M 463 846 C 428 842, 395 845, 359 857',
              'M 537 846 C 572 842, 607 846, 642 858',
            ].map((path) => (
              <g key={path}>
                <path
                  d={path}
                  pathLength={1}
                  fill="none"
                  stroke="#6f3708"
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeDasharray="1"
                  style={{ strokeDashoffset: 'var(--museum-root-offset, 1)' }}
                  opacity={0.62}
                />
                <path
                  d={path}
                  pathLength={1}
                  fill="none"
                  stroke="url(#museum-tree-branch)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray="1"
                  style={{ strokeDashoffset: 'var(--museum-root-offset, 1)' }}
                  opacity={0.92}
                />
              </g>
            ))}
          </g>

          <g mask="url(#museum-trunk-reveal)">
            <path
              d="M 442 856 C 457 815, 461 780, 452 745 C 443 708, 466 676, 458 641 C 448 602, 473 568, 461 530 C 451 491, 477 454, 467 416 C 457 378, 482 343, 478 304 C 474 265, 491 228, 493 190 C 493 157, 496 129, 502 101 C 511 128, 516 158, 513 194 C 510 231, 526 268, 518 307 C 510 346, 531 382, 520 422 C 509 460, 530 498, 517 538 C 505 576, 527 613, 514 651 C 502 689, 525 724, 517 760 C 509 795, 523 824, 558 856 Z"
              fill="url(#museum-tree-trunk)"
              stroke="#6f3608"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="M 476 832 C 482 789, 470 754, 481 715 C 492 677, 475 645, 487 607 C 500 569, 480 535, 491 496 C 502 458, 484 423, 495 386 C 507 347, 490 315, 500 277 C 508 244, 499 210, 505 176 C 508 151, 506 128, 504 112"
              fill="none"
              stroke="#fff0a0"
              strokeWidth="6"
              strokeLinecap="round"
              opacity="0.72"
            />
            <path
              d="M 523 836 C 508 793, 526 758, 509 718 C 494 682, 516 646, 501 610 C 487 572, 512 537, 498 500 C 484 463, 510 427, 497 389 C 486 352, 508 318, 499 282 C 493 247, 511 216, 505 183"
              fill="none"
              stroke="#95500b"
              strokeWidth="8"
              strokeLinecap="round"
              opacity="0.56"
            />
          </g>

          <g
            data-tree-growth-tip
            className="pointer-events-none opacity-0"
            aria-hidden="true"
          >
            <path
              d="M 0 -44 C 24 -25, 28 2, 0 30 C -28 2, -24 -25, 0 -44 Z"
              fill="url(#museum-tree-trunk)"
              stroke="#8a480a"
              strokeWidth="1.5"
            />
            <path
              d="M -7 -29 C 2 -17, 5 -2, 0 18"
              fill="none"
              stroke="#fff0a0"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.68"
            />
          </g>

          <g transform={compactBranchTransform}>
            {[
              'M 504 166 C 486 139, 466 112, 451 87',
              'M 504 164 C 505 124, 503 84, 501 47',
              'M 505 165 C 527 138, 545 112, 554 86',
              'M 503 141 C 489 126, 477 119, 465 114',
              'M 505 139 C 519 125, 531 117, 543 112',
            ].map((path) => (
              <path
                key={path}
                d={path}
                pathLength={1}
                fill="none"
                stroke="url(#museum-tree-branch)"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeDasharray="1"
                style={{ strokeDashoffset: 'var(--museum-crown-offset, 1)' }}
              />
            ))}
          </g>

          {HISTORY_BRANCHES.map((branch) => {
            const isActive = activeBranch?.id === branch.id;

            return (
              <g
                key={branch.id}
                data-tree-branch-group
                data-start={branch.start}
                data-end={branch.end}
              >
                <path
                  d={branch.path}
                  transform={compactBranchTransform}
                  pathLength={1}
                  fill="none"
                  stroke="#653006"
                  strokeWidth={isActive ? 20 : 17}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="1"
                  style={{ strokeDashoffset: 'var(--museum-branch-offset, 1)' }}
                  opacity="0.72"
                  className="transition-[stroke-width] duration-200 motion-reduce:transition-none"
                />
                <path
                  d={branch.path}
                  transform={compactBranchTransform}
                  pathLength={1}
                  fill="none"
                  stroke={isActive
                    ? '#ffe174'
                    : `url(#museum-tree-branch-${branch.side})`}
                  strokeWidth={isActive ? 14 : 11.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="1"
                  style={{ strokeDashoffset: 'var(--museum-branch-offset, 1)' }}
                  filter={isActive ? 'url(#museum-tree-glow)' : undefined}
                  className="transition-[stroke,stroke-width] duration-200 motion-reduce:transition-none"
                />
                <path
                  d={branch.path}
                  transform={compactBranchTransform}
                  pathLength={1}
                  fill="none"
                  stroke="#fff0a1"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="1"
                  style={{ strokeDashoffset: 'var(--museum-branch-offset, 1)' }}
                  opacity="0.58"
                />

                {branch.twigs.map((twigPath) => (
                  <g key={twigPath}>
                    <path
                      d={twigPath}
                      transform={compactBranchTransform}
                      pathLength={1}
                      fill="none"
                      stroke="#6d3507"
                      strokeWidth={isActive ? 9 : 7.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="1"
                      style={{ strokeDashoffset: 'var(--museum-twig-offset, 1)' }}
                      opacity="0.65"
                    />
                    <path
                      d={twigPath}
                      transform={compactBranchTransform}
                      pathLength={1}
                      fill="none"
                      stroke={isActive
                        ? '#ffd85a'
                        : `url(#museum-tree-branch-${branch.side})`}
                      strokeWidth={isActive ? 5.5 : 4.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="1"
                      style={{ strokeDashoffset: 'var(--museum-twig-offset, 1)' }}
                      opacity="0.96"
                    />
                  </g>
                ))}

                <g
                  style={{ opacity: 'var(--museum-node-opacity, 0)' }}
                  aria-hidden="true"
                >
                  {branch.decorations.map((decoration, decorationIndex) => (
                    <GoldenSprig
                      key={`${branch.id}-sprig-${decorationIndex}`}
                      {...decoration}
                      x={displayTreeX(decoration.x)}
                    />
                  ))}
                </g>

                {branch.points.map((point, pointIndex) => {
                  const isSelected = selectedPointId === point.id;
                  const isPointActive = activePointId === point.id;
                  const label = pointLabel(branch);

                  return (
                    <g
                      key={point.id}
                      data-tree-node
                      role="button"
                      tabIndex={-1}
                      aria-label={label}
                      aria-pressed={isSelected}
                      aria-hidden="true"
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePoint(point.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          togglePoint(point.id);
                        }
                      }}
                      onPointerEnter={() => setHoveredPointId(point.id)}
                      onPointerLeave={() => setHoveredPointId((currentPointId) =>
                        currentPointId === point.id ? null : currentPointId,
                      )}
                      onFocus={() => setHoveredPointId(point.id)}
                      onBlur={() => setHoveredPointId((currentPointId) =>
                        currentPointId === point.id ? null : currentPointId,
                      )}
                      className="group cursor-pointer outline-none"
                      style={{
                        opacity: 'var(--museum-node-opacity, 0)',
                        pointerEvents: 'var(--museum-node-pointer-events, none)' as CSSProperties['pointerEvents'],
                        transform: `translate(${displayTreeX(point.x)}px, ${point.y}px) scale(var(--museum-node-scale, 0.7))`,
                        transformOrigin: '0 0',
                      }}
                    >
                      <circle
                        r="29"
                        fill="transparent"
                        stroke="transparent"
                      />
                      <circle
                        r={isPointActive ? 22 : 19}
                        fill="color-mix(in oklab, #f0aa1c 13%, transparent)"
                        stroke={isPointActive ? '#ffce4b' : '#d49118'}
                        strokeWidth={isPointActive ? 2.5 : 1.5}
                        strokeDasharray="2.5 4.5"
                        filter={isPointActive ? 'url(#museum-tree-glow)' : undefined}
                        className="transition-all duration-200 group-focus:stroke-[3px] motion-reduce:transition-none"
                      />
                      <circle
                        r={isPointActive ? 16 : 14}
                        fill={isPointActive ? '#ffd75a' : '#eeb22b'}
                        stroke={isPointActive ? '#e45b2c' : '#87430a'}
                        strokeWidth={isPointActive ? 3 : 2}
                        className="transition-all duration-200 motion-reduce:transition-none"
                      />
                      <circle cx="-4" cy="-5" r="3.2" fill="#fff4b7" opacity="0.82" />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#562c08"
                        fontSize="9.5"
                        fontWeight="800"
                        aria-hidden="true"
                      >
                        {String(branch.stage).padStart(2, '0')}{pointIndex > 0 ? `.${pointIndex + 1}` : ''}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          <g
            style={{ opacity: 'var(--museum-crown-opacity, 0)' }}
            aria-hidden="true"
          >
            {TREE_TOP_DECORATIONS.map((decoration, decorationIndex) => (
              <GoldenSprig
                key={`tree-top-sprig-${decorationIndex}`}
                {...decoration}
                x={displayTreeX(decoration.x)}
              />
            ))}
          </g>
        </svg>

        <div className="pointer-events-none absolute bottom-5 left-5 z-10 hidden items-end gap-3 sm:flex" aria-hidden="true">
          <div className="h-24 w-1 overflow-hidden rounded-full bg-katha-text/10">
            <div
              className="w-full rounded-full bg-gradient-to-t from-[#985511] via-[#e3a21d] to-[#ffe477]"
              style={{ height: 'var(--museum-progress-height, 3%)' }}
            />
          </div>
          <span
            ref={progressLabelRef}
            className="text-[10px] font-bold tabular-nums tracking-[0.14em] text-katha-text/45"
          >
            0%
          </span>
        </div>

        {activeBranch && activePoint ? (
          <aside
            role="dialog"
            aria-label={pointLabel(activeBranch)}
            onClick={(event) => event.stopPropagation()}
            className={`absolute inset-x-3 bottom-20 z-30 overflow-hidden rounded-2xl border border-katha-gold/30 bg-katha-surface-light shadow-2xl shadow-black/30 sm:inset-x-auto sm:bottom-24 sm:w-[360px] ${
              activeBranch.side === 'right' ? 'sm:left-7' : 'sm:right-7'
            }`}
          >
            {activePoint.image ? (
              <div className="relative aspect-[16/8] w-full overflow-hidden bg-katha-text/[0.04]">
                <Image
                  src={activePoint.image.src}
                  alt={activePoint.image.alt}
                  fill
                  sizes="(max-width: 640px) calc(100vw - 1.5rem), 360px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="grid h-20 place-items-center border-b border-katha-text/10 bg-katha-text/[0.025] sm:h-28">
                <div className="text-center text-katha-text/35">
                  <span className="text-xl" aria-hidden="true">▧</span>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                    {copy.museumHistoryImagePending}
                  </p>
                </div>
              </div>
            )}
            <div className="relative p-4 sm:p-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-katha-gold">
                {pointLabel(activeBranch)}
              </span>
              <h3 className="mt-1.5 text-base font-bold text-katha-text sm:text-lg">
                {copy.museumHistoryContentPendingTitle}
              </h3>
              <p className="mt-1.5 text-xs leading-5 text-katha-text/55 sm:text-sm sm:leading-6">
                {copy.museumHistoryContentPendingBody}
              </p>
              {selectedPointId && (
                <button
                  type="button"
                  onClick={() => setSelectedPointId(null)}
                  className="absolute right-3 top-3 grid size-8 cursor-pointer place-items-center rounded-full border border-katha-text/10 bg-katha-text/[0.04] text-sm text-katha-text/55 transition hover:bg-katha-text/[0.09] hover:text-katha-text"
                  aria-label={copy.museumHistoryClose}
                >
                  ×
                </button>
              )}
            </div>
          </aside>
        ) : (
          <div className="pointer-events-none absolute inset-x-4 bottom-28 z-10 mx-auto max-w-sm rounded-full border border-katha-text/10 bg-katha-surface-light/95 px-4 py-2 text-center text-[10px] font-medium text-katha-text/45 sm:bottom-6 sm:text-xs">
            {copy.museumHistoryPointHint}
          </div>
        )}
      </div>
    </section>
  );
}
