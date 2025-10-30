import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsFooter } from './StatsFooter';

describe('StatsFooter', () => {
  const defaultProps = {
    totalCategories: 10,
    totalMerchants: 150,
    filteredMerchants: 150,
    searchQuery: '',
  };

  it('should render total stats when no search query', () => {
    render(<StatsFooter {...defaultProps} />);

    expect(screen.getByText(/I alt 10 kategorier med 150 webshops/i)).toBeInTheDocument();
  });

  it('should render filtered stats when search query is active', () => {
    render(<StatsFooter {...defaultProps} searchQuery="zalando" filteredMerchants={25} />);

    expect(
      screen.getByText(/Viser 25 af 150 webshops i 10 kategorier/i)
    ).toBeInTheDocument();
  });

  it('should display last updated timestamp when provided', () => {
    const timestamp = new Date('2024-01-15T10:30:00').getTime();

    render(<StatsFooter {...defaultProps} lastUpdated={timestamp} />);

    expect(screen.getByText(/Sidst opdateret:/i)).toBeInTheDocument();
  });

  it('should format timestamp in Danish locale', () => {
    const timestamp = new Date('2024-01-15T10:30:00').getTime();

    render(<StatsFooter {...defaultProps} lastUpdated={timestamp} />);

    const timestampText = screen.getByText(/Sidst opdateret:/i);
    expect(timestampText).toBeInTheDocument();
    // The timestamp should be formatted in Danish locale (da-DK)
    expect(timestampText.textContent).toMatch(/\d{1,2}\.\d{1,2}\.\d{4}/);
  });

  it('should not display timestamp when not provided', () => {
    render(<StatsFooter {...defaultProps} />);

    expect(screen.queryByText(/Sidst opdateret:/i)).not.toBeInTheDocument();
  });

  it('should handle zero filtered results', () => {
    render(<StatsFooter {...defaultProps} searchQuery="nonexistent" filteredMerchants={0} />);

    expect(
      screen.getByText(/Viser 0 af 150 webshops i 10 kategorier/i)
    ).toBeInTheDocument();
  });

  it('should handle single category correctly', () => {
    render(<StatsFooter {...defaultProps} totalCategories={1} totalMerchants={5} />);

    expect(screen.getByText(/I alt 1 kategorier med 5 webshops/i)).toBeInTheDocument();
  });

  it('should handle single merchant correctly', () => {
    render(
      <StatsFooter
        {...defaultProps}
        totalCategories={1}
        totalMerchants={1}
        filteredMerchants={1}
      />
    );

    expect(screen.getByText(/I alt 1 kategorier med 1 webshops/i)).toBeInTheDocument();
  });

  it('should have proper styling classes', () => {
    const { container } = render(<StatsFooter {...defaultProps} />);

    const footer = container.firstChild as HTMLElement;
    expect(footer).toHaveClass('mt-12');
    expect(footer).toHaveClass('border-t');
    expect(footer).toHaveClass('text-center');
  });
});
