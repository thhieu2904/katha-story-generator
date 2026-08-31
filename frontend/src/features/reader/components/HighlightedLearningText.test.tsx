import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HighlightedLearningText } from './HighlightedLearningText';

const keywords = [
  { khmer: 'បុណ្យ', vietnamese: 'Lễ hội', transliteration: 'bon' },
  { khmer: 'ព្រះចន្ទ', vietnamese: 'Mặt Trăng', transliteration: null },
];

describe('HighlightedLearningText', () => {
  it('highlights learned Vietnamese terms without changing surrounding text', () => {
    render(
      <p>
        <HighlightedLearningText
          text="Lễ hội diễn ra dưới ánh Mặt Trăng."
          keywords={keywords}
          language="vi"
        />
      </p>,
    );

    expect(screen.getByText('Lễ hội', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.getByText('Mặt Trăng', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.getByText(/diễn ra dưới ánh/)).toBeInTheDocument();
  });

  it('highlights the corresponding Khmer terms', () => {
    render(
      <p>
        <HighlightedLearningText
          text="ថ្ងៃបុណ្យ កុមារមើលព្រះចន្ទ។"
          keywords={keywords}
          language="km"
        />
      </p>,
    );

    expect(screen.getByText('បុណ្យ', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.getByText('ព្រះចន្ទ', { selector: 'mark' })).toBeInTheDocument();
  });

  it('highlights Khmer terms across invisible word separators', () => {
    render(
      <p>
        <HighlightedLearningText
          text={'ថ្ងៃបុ\u200Bណ្យ កុមារមើលព្រះ\u200Bចន្ទ។'}
          keywords={keywords}
          language="km"
        />
      </p>,
    );

    expect(screen.getByText('បុ\u200Bណ្យ', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.getByText('ព្រះ\u200Bចន្ទ', { selector: 'mark' })).toBeInTheDocument();
  });

  it('highlights a Latin transliteration retained in Khmer story text', () => {
    render(
      <p>
        <HighlightedLearningText
          text="កុមារមើល Avalokitesvara នៅក្នុងវត្ត។"
          keywords={[
            {
              khmer: 'អវលោកិតេស្វរៈ',
              vietnamese: 'Avalokitesvara',
              transliteration: 'Avalokitesvara',
            },
          ]}
          language="km"
        />
      </p>,
    );

    expect(screen.getByText('Avalokitesvara', { selector: 'mark' })).toBeInTheDocument();
  });
});
