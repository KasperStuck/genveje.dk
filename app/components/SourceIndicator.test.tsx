import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SourceIndicator } from './SourceIndicator';

describe('SourceIndicator', () => {
  it('should render "both-apis" indicator correctly', () => {
    render(<SourceIndicator source="both-apis" />);

    expect(screen.getByText(/Frisk data fra begge kilder/i)).toBeInTheDocument();
    expect(screen.getByText(/🌐/)).toBeInTheDocument();
  });

  it('should render "partnerads-only" indicator correctly', () => {
    render(<SourceIndicator source="partnerads-only" />);

    expect(screen.getByText(/Partner-ads data/i)).toBeInTheDocument();
    expect(screen.getByText(/📦/)).toBeInTheDocument();
  });

  it('should render "adtraction-only" indicator correctly', () => {
    render(<SourceIndicator source="adtraction-only" />);

    expect(screen.getByText(/Adtraction data/i)).toBeInTheDocument();
    expect(screen.getByText(/📦/)).toBeInTheDocument();
  });

  it('should render "cache-fallback" indicator correctly', () => {
    render(<SourceIndicator source="cache-fallback" />);

    expect(screen.getByText(/Fra cache \(API fejl\)/i)).toBeInTheDocument();
    expect(screen.getByText(/⚠️/)).toBeInTheDocument();
  });

  it('should return null for unknown source', () => {
    const { container } = render(<SourceIndicator source="unknown-source" />);

    expect(container.firstChild).toBeNull();
  });

  it('should render with correct badge variants', () => {
    const { container: bothApisContainer } = render(
      <SourceIndicator source="both-apis" />
    );
    expect(bothApisContainer.querySelector('.text-xs')).toBeInTheDocument();

    const { container: cacheContainer } = render(
      <SourceIndicator source="cache-fallback" />
    );
    expect(cacheContainer.querySelector('.text-xs')).toBeInTheDocument();
  });

  it('should have accessible text size', () => {
    render(<SourceIndicator source="both-apis" />);

    const badge = screen.getByText(/Frisk data fra begge kilder/i).closest('[class*="text-xs"]');
    expect(badge).toBeInTheDocument();
  });
});
