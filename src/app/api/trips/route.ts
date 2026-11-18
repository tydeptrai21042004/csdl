import { z } from 'zod';
import { callJson } from '@/lib/db';
import { apiError, reply, requireAdmin } from '@/lib/api';
import { tripBody } from '@/lib/validators';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
 try {
  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim() || null;
  const status = url.searchParams.get('status')?.trim() || null;
  const operator = url.searchParams.get('operator') || null;
  if (status && !['SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED'].includes(status)) return reply({error:'Invalid status'},400);
  const operatorId = operator ? z.coerce.number().int().positive().parse(operator) : null;
  return reply({ trips: await callJson('sp_search_trips', [search, status, operatorId]) });
 } catch(e) { return apiError(e); }
}
export async function POST(request: Request) {
 const auth = await requireAdmin(); if (auth) return auth;
 try {
  const b = tripBody.parse(await request.json());
  return reply(await callJson('sp_create_trip',[b.route_id,b.bus_id,new Date(b.departure_at).toISOString(),new Date(b.arrival_at).toISOString(),b.base_fare]),201);
 } catch(e) { return apiError(e); }
}
export async function PATCH(request: Request) {
 const auth = await requireAdmin(); if (auth) return auth;
 try {
  const b = tripBody.extend({ trip_id: z.coerce.number().int().positive() }).parse(await request.json());
  return reply(await callJson('sp_update_trip',[b.trip_id,b.route_id,b.bus_id,new Date(b.departure_at).toISOString(),new Date(b.arrival_at).toISOString(),b.base_fare,b.status || 'SCHEDULED']));
 } catch(e) { return apiError(e); }
}
export async function DELETE(request: Request) {
 const auth = await requireAdmin(); if (auth) return auth;
 try {
  const b = z.object({ trip_id: z.coerce.number().int().positive() }).parse(await request.json());
  return reply(await callJson('sp_delete_trip',[b.trip_id]));
 } catch(e) { return apiError(e); }
}
