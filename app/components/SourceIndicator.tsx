import { Badge } from "~/components/ui/badge";

interface SourceIndicatorProps {
  source: string;
}

export function SourceIndicator({ source }: SourceIndicatorProps) {
  const indicators = {
    'both-apis': { icon: '🌐', text: 'Frisk data fra begge kilder', variant: 'default' as const },
    'partnerads-only': { icon: '📦', text: 'Partner-ads data', variant: 'secondary' as const },
    'adtraction-only': { icon: '📦', text: 'Adtraction data', variant: 'secondary' as const },
    'cache-fallback': { icon: '⚠️', text: 'Fra cache (API fejl)', variant: 'destructive' as const },
  };

  const indicator = indicators[source as keyof typeof indicators];

  if (!indicator) return null;

  return (
    <Badge variant={indicator.variant} className="text-xs">
      {indicator.icon} {indicator.text}
    </Badge>
  );
}
