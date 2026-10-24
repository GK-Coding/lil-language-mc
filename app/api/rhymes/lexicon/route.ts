import { dictionary } from 'cmu-pronouncing-dictionary';

export async function GET() {
  return Response.json(dictionary, { headers: { 'Cache-Control': 'public, max-age=86400' } });
}
