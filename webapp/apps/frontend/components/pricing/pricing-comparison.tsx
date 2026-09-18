import { Check, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@droiduse/shared-ui/table';

const FEATURES = [
  { name: 'Monthly Tokens', basic: '100K' /* premium: '300K', business: '2M' */ },
  { name: 'Knowledge Entries Access', basic: 'Basic' /* premium: 'Premium', business: 'Premium' */ },
  { name: 'Device Management', basic: true /* premium: true, business: true */ },
  { name: 'Analytics Dashboard', basic: false /* premium: true, business: true */ },
  { name: 'Business Integration', basic: false /* premium: false, business: true */ },
  { name: 'Custom Workflows', basic: false /* premium: false, business: true */ },
  { name: 'Support', basic: 'Community' /* premium: 'Email', business: 'Priority + SLA' */ },
  { name: 'API Access', basic: false /* premium: true, business: true */ },
];

export function PricingComparison() {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Feature</TableHead>
            <TableHead className="text-center">Basic</TableHead>
            {/* <TableHead className="text-center">Premium</TableHead> */}
            {/* <TableHead className="text-center">Business</TableHead> */}
          </TableRow>
        </TableHeader>
        <TableBody>
          {FEATURES.map((feature) => (
            <TableRow key={feature.name}>
              <TableCell className="font-medium">{feature.name}</TableCell>
              <TableCell className="text-center">
                {renderFeatureValue(feature.basic)}
              </TableCell>
              {/* <TableCell className="text-center">
                {renderFeatureValue(feature.premium)}
              </TableCell> */}
              {/* <TableCell className="text-center">
                {renderFeatureValue(feature.business)}
              </TableCell> */}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function renderFeatureValue(value: boolean | string) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="h-5 w-5 text-primary mx-auto" />
    ) : (
      <X className="h-5 w-5 text-muted-foreground mx-auto" />
    );
  }
  return <span className="text-sm">{value}</span>;
}
