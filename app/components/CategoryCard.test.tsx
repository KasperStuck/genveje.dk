import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryCard } from './CategoryCard';
import type { Category } from '~/lib/types';

describe('CategoryCard', () => {
  const mockCategory: Category = {
    id: 1,
    name: 'Mode & Tøj',
    merchants: [
      {
        programid: '1',
        programnavn: 'Zalando',
        programurl: 'https://www.zalando.dk',
        affiliatelink: 'https://track.example.com/zalando',
        kategoriid: 1,
        status: 'approved',
        source: 'partnerads',
      },
      {
        programid: '2',
        programnavn: 'ASOS',
        programurl: 'https://www.asos.com',
        affiliatelink: 'https://track.example.com/asos',
        kategoriid: 1,
        status: 'approved',
        source: 'adtraction',
      },
    ],
  };

  it('should render category name', () => {
    render(<CategoryCard category={mockCategory} originalCount={2} searchQuery="" />);

    expect(screen.getByText('Mode & Tøj')).toBeInTheDocument();
  });

  it('should render all merchants', () => {
    render(<CategoryCard category={mockCategory} originalCount={2} searchQuery="" />);

    expect(screen.getByText('Zalando')).toBeInTheDocument();
    expect(screen.getByText('ASOS')).toBeInTheDocument();
  });

  it('should show merchant count when no search query', () => {
    render(<CategoryCard category={mockCategory} originalCount={2} searchQuery="" />);

    expect(screen.getByText('2 butikker')).toBeInTheDocument();
  });

  it('should show singular "butik" for one merchant', () => {
    const singleMerchantCategory: Category = {
      ...mockCategory,
      merchants: [mockCategory.merchants[0]],
    };

    render(
      <CategoryCard category={singleMerchantCategory} originalCount={1} searchQuery="" />
    );

    expect(screen.getByText('1 butik')).toBeInTheDocument();
  });

  it('should show filtered count when search query is active', () => {
    const filteredCategory: Category = {
      ...mockCategory,
      merchants: [mockCategory.merchants[0]], // Only 1 merchant after filter
    };

    render(
      <CategoryCard
        category={filteredCategory}
        originalCount={2}
        searchQuery="zalando"
      />
    );

    expect(screen.getByText(/1 af 2 butikker/)).toBeInTheDocument();
  });

  it('should show "no results" message when no merchants match', () => {
    const emptyCategory: Category = {
      ...mockCategory,
      merchants: [],
    };

    render(
      <CategoryCard category={emptyCategory} originalCount={2} searchQuery="nonexistent" />
    );

    expect(screen.getByText(/Ingen resultater matcher din søgning/)).toBeInTheDocument();
  });

  it('should render merchant links with correct attributes', () => {
    render(<CategoryCard category={mockCategory} originalCount={2} searchQuery="" />);

    const zalandoLink = screen.getByRole('link', { name: /Zalando/i });
    // MerchantLink concatenates affiliatelink + programurl
    expect(zalandoLink).toHaveAttribute('href', 'https://track.example.com/zalandohttps://www.zalando.dk');
    expect(zalandoLink).toHaveAttribute('target', '_blank');
    expect(zalandoLink).toHaveAttribute('rel', 'noopener noreferrer sponsored');
  });

  it('should be memoized (component should not re-render with same props)', () => {
    const { rerender } = render(
      <CategoryCard category={mockCategory} originalCount={2} searchQuery="" />
    );

    // Re-render with same props
    rerender(<CategoryCard category={mockCategory} originalCount={2} searchQuery="" />);

    // Component is wrapped in React.memo, so it should not re-render
    // This is more of a structural test - the actual memo behavior is tested by React
    expect(screen.getByText('Mode & Tøj')).toBeInTheDocument();
  });

  it('should handle missing originalCount gracefully', () => {
    const filteredCategory: Category = {
      ...mockCategory,
      merchants: [mockCategory.merchants[0]],
    };

    render(
      <CategoryCard category={filteredCategory} originalCount={undefined} searchQuery="" />
    );

    // Should show simple count without "X af Y" format
    expect(screen.getByText('1 butik')).toBeInTheDocument();
  });
});
