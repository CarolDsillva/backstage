import { currentUserId } from '@/lib/server/auth';
import { getUser } from '@/lib/server/db';
import { issueToken } from '@/lib/server/nexconn';
import { errorResponse, HttpError } from '@/lib/server/http';

export async function GET() {
  try {
    const userId = await currentUserId();
    if (!userId) throw new HttpError(401, 'Join the gig first');
    const user = await getUser(userId);
    if (!user) throw new HttpError(401, 'Join the gig first');
    return Response.json({ token: await issueToken(user.id, user.name) });
  } catch (e) {
    return errorResponse(e);
  }
}
