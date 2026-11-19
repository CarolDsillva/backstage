import { unstable_rethrow } from 'next/navigation';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorResponse(e: unknown): Response {
  unstable_rethrow(e); // let Next.js control-flow errors (dynamic bailout etc.) through
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: 'Something went wrong on our side. Try again in a moment.' }, { status: 500 });
}
