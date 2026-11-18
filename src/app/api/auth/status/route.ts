import { hasAdminSession } from '@/lib/auth';
import { reply } from '@/lib/api';
export const runtime='nodejs';
export async function GET() {return reply({authenticated:await hasAdminSession()});}
