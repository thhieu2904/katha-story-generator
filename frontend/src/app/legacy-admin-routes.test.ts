import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock('next/navigation', () => ({ redirect }));

import DictionaryRoute from './dictionary/page';
import LearnPage from './learn/page';

describe('legacy public feature routes', () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it('keeps the old Learn URL working through the canonical admin Vision flow', () => {
    LearnPage();

    expect(redirect).toHaveBeenCalledWith('/admin/vision');
  });

  it('keeps the old Dictionary URL working through the canonical admin module', () => {
    DictionaryRoute();

    expect(redirect).toHaveBeenCalledWith('/admin/dictionary');
  });
});
