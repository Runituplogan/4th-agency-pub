import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable, ExecutionContext } from '@nestjs/common';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const email = req.body?.email || req.body?.identifier;

    if (req.url?.includes('auth/') && email) {
      return `${req.ip}-${email}`;
    }

    return req.ip;
  }
}
