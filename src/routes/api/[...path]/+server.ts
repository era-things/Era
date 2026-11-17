import { handleApi } from '../../../lib/server/api';
import type { RequestHandler } from './$types';

const handle: RequestHandler = ({ request, params }) => handleApi(request, params.path ?? '');
export const GET = handle;
export const PUT = handle;
export const PATCH = handle;
export const POST = handle;
export const DELETE = handle;
