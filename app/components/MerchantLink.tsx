import type { Merchant } from "~/lib/types";

interface MerchantLinkProps {
  merchant: Merchant;
}

export function MerchantLink({ merchant }: MerchantLinkProps) {
  // Validate URLs exist before rendering
  // Note: Adtraction merchants have complete URL in affiliatelink with empty programurl
  // Partner-ads merchants have base URL in affiliatelink + merchant URL in programurl
  const hasAffiliateLink = Boolean(merchant.affiliatelink);
  const hasValidUrl = hasAffiliateLink || Boolean(merchant.programurl);

  const fullUrl = hasAffiliateLink
    ? merchant.affiliatelink + (merchant.programurl || '')
    : merchant.programurl || '#';

  return (
    <li>
      <a
        href={fullUrl}
        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
        target="_blank"
        rel="noopener noreferrer sponsored"
        title={`Besøg ${merchant.programnavn}`}
      >
        {merchant.programnavn}
        {!hasValidUrl && (
          <span className="text-xs text-gray-400 ml-1">(info mangler)</span>
        )}
      </a>
    </li>
  );
}
