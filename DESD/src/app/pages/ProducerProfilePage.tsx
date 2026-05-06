import { useParams } from 'react-router';

import { MarketplacePage } from './MarketplacePage';

export function ProducerProfilePage() {
  const { producerId = '' } = useParams();

  return <MarketplacePage producerScopeId={producerId} />;
}
