interface StatsFooterProps {
  totalCategories: number;
  totalMerchants: number;
  filteredMerchants: number;
  searchQuery: string;
  lastUpdated?: number;
}

export function StatsFooter({
  totalCategories,
  totalMerchants,
  filteredMerchants,
  searchQuery,
  lastUpdated,
}: StatsFooterProps) {
  return (
    <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
      <p>
        {searchQuery ? (
          <>
            Viser {filteredMerchants} af {totalMerchants} webshops i {totalCategories} kategorier
          </>
        ) : (
          <>
            I alt {totalCategories} kategorier med {totalMerchants} webshops
          </>
        )}
      </p>
      {lastUpdated && (
        <p className="mt-2 text-xs">
          Sidst opdateret: {new Date(lastUpdated).toLocaleString('da-DK')}
        </p>
      )}
    </div>
  );
}
