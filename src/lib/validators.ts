import { z } from 'zod';

const positiveId = z.coerce.number().int().positive();
export const tripBody = z.object({
  route_id: positiveId,
  bus_id: positiveId,
  departure_at: z.string().min(10).refine(v => Number.isFinite(Date.parse(v)), 'Invalid departure time'),
  arrival_at: z.string().min(10).refine(v => Number.isFinite(Date.parse(v)), 'Invalid arrival time'),
  base_fare: z.coerce.number().min(0).max(10_000_000),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional()
});
export const bookingBody = z.object({
  passenger_id: positiveId, trip_id: positiveId, seat_id: positiveId,
  traveller_name: z.string().trim().min(2).max(120),
  pickup_stop_order: positiveId, dropoff_stop_order: positiveId,
  promo_code: z.string().trim().max(30).optional().default('')
});
