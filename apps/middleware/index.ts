import { Injectable, NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

import { supabaseClient } from '../db/supabase.client.ts'

declare module 'express-serve-static-core' {
  interface Request {
    supabase: typeof supabaseClient
  }
}

@Injectable()
export class SupabaseMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    req.supabase = supabaseClient
    next()
  }
}

