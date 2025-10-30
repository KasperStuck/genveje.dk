import { memo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "~/components/ui/card";
import { MerchantLink } from "~/components/MerchantLink";
import type { Category } from "~/lib/types";

interface CategoryCardProps {
  category: Category;
  originalCount?: number;
  searchQuery: string;
}

export const CategoryCard = memo(function CategoryCard({
  category,
  originalCount,
  searchQuery
}: CategoryCardProps) {
  const displayCount = category.merchants.length;
  const showFilteredCount = searchQuery && originalCount && originalCount !== displayCount;

  return (
    <Card className="break-inside-avoid hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">{category.name}</CardTitle>
      </CardHeader>

      <CardContent>
        {displayCount === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            Ingen resultater matcher din søgning
          </p>
        ) : (
          <ul className="space-y-2">
            {category.merchants.map((merchant) => (
              <MerchantLink key={merchant.programid} merchant={merchant} />
            ))}
          </ul>
        )}
      </CardContent>

      <CardFooter className="pt-3 border-t">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {showFilteredCount ? (
            <>
              {displayCount} af {originalCount} {originalCount === 1 ? 'butik' : 'butikker'}
            </>
          ) : (
            <>
              {displayCount} {displayCount === 1 ? 'butik' : 'butikker'}
            </>
          )}
        </p>
      </CardFooter>
    </Card>
  );
});
