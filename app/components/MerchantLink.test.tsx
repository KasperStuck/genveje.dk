import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MerchantLink } from './MerchantLink';
import type { Merchant } from '~/lib/types';

describe('MerchantLink', () => {
  const mockMerchant: Merchant = {
    programid: '1',
    programnavn: 'Zalando',
    programurl: 'https://www.zalando.dk',
    affiliatelink: 'https://track.example.com/',
    kategoriid: 1,
    status: 'approved',
    source: 'partnerads',
  };

  it('should render merchant name', () => {
    render(<MerchantLink merchant={mockMerchant} />);

    expect(screen.getByText('Zalando')).toBeInTheDocument();
  });

  it('should combine affiliatelink and programurl for full URL', () => {
    render(<MerchantLink merchant={mockMerchant} />);

    const link = screen.getByRole('link', { name: /Zalando/i });
    expect(link).toHaveAttribute(
      'href',
      'https://track.example.com/https://www.zalando.dk'
    );
  });

  it('should use only affiliatelink when programurl is empty (Adtraction case)', () => {
    const adtractionMerchant: Merchant = {
      ...mockMerchant,
      affiliatelink: 'https://track.adtraction.com/t/t?a=123&as=456&t=2&tk=1',
      programurl: '',
    };

    render(<MerchantLink merchant={adtractionMerchant} />);

    const link = screen.getByRole('link', { name: /Zalando/i });
    expect(link).toHaveAttribute(
      'href',
      'https://track.adtraction.com/t/t?a=123&as=456&t=2&tk=1'
    );
  });

  it('should use programurl when affiliatelink is empty', () => {
    const merchantWithoutAffiliate: Merchant = {
      ...mockMerchant,
      affiliatelink: '',
    };

    render(<MerchantLink merchant={merchantWithoutAffiliate} />);

    const link = screen.getByRole('link', { name: /Zalando/i });
    expect(link).toHaveAttribute('href', 'https://www.zalando.dk');
  });

  it('should use # as fallback when no URLs are provided', () => {
    const merchantWithoutUrls: Merchant = {
      ...mockMerchant,
      affiliatelink: '',
      programurl: '',
    };

    render(<MerchantLink merchant={merchantWithoutUrls} />);

    const link = screen.getByRole('link', { name: /Zalando/i });
    expect(link).toHaveAttribute('href', '#');
  });

  it('should show "(info mangler)" when no valid URL exists', () => {
    const merchantWithoutUrls: Merchant = {
      ...mockMerchant,
      affiliatelink: '',
      programurl: '',
    };

    render(<MerchantLink merchant={merchantWithoutUrls} />);

    expect(screen.getByText(/info mangler/i)).toBeInTheDocument();
  });

  it('should have proper link attributes for security and SEO', () => {
    render(<MerchantLink merchant={mockMerchant} />);

    const link = screen.getByRole('link', { name: /Zalando/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer sponsored');
  });

  it('should have a descriptive title attribute', () => {
    render(<MerchantLink merchant={mockMerchant} />);

    const link = screen.getByRole('link', { name: /Zalando/i });
    expect(link).toHaveAttribute('title', 'Besøg Zalando');
  });

  it('should be keyboard accessible with focus styles', () => {
    render(<MerchantLink merchant={mockMerchant} />);

    const link = screen.getByRole('link', { name: /Zalando/i });
    expect(link).toHaveClass('focus:outline-none');
    expect(link).toHaveClass('focus:ring-2');
  });

  it('should render within a list item', () => {
    const { container } = render(<MerchantLink merchant={mockMerchant} />);

    expect(container.querySelector('li')).toBeInTheDocument();
  });
});
