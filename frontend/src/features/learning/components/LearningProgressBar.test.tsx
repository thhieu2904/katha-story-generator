import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LearningProgressBar } from './LearningProgressBar';

describe('LearningProgressBar', () => {
  it('shows overall progress across all five learning steps', () => {
    render(<LearningProgressBar currentStep={2} stepProgress={0.5} language="vi" />);

    expect(screen.getByRole('progressbar', { name: 'Tiến trình' })).toHaveAttribute(
      'aria-valuenow',
      '30',
    );
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('Từ khóa').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('switches its labels to Khmer', () => {
    render(<LearningProgressBar currentStep={3} language="km" />);

    expect(screen.getByRole('progressbar', { name: 'ដំណើរការ' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
    expect(screen.getByText('ស្តាប់ និងអាន').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
  });
});
