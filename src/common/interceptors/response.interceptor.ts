import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseStatus } from '../@types';

export interface Response<T> {
  status: ResponseStatus;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
  method: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    return next.handle().pipe(
      map((data) => {
        //if data is already has statusCode, return as is
        if (
          data &&
          typeof data === 'object' &&
          'statusCode' in data &&
          'message' in data &&
          'data' in data
        ) {
          return {
            ...data,
            status: data.status ?? this.getStatus(data.statusCode),
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
          };
        }

        //else, format the response
        const statusCode = response.statusCode;
        return {
          status: this.getStatus(statusCode),
          statusCode: response.statusCode,
          message: response.locals.message,
          data: data?.data ?? data,
        };
      }),
    );
  }

  private getStatus(statusCode: number): ResponseStatus {
    return statusCode >= 200 && statusCode < 300
      ? ResponseStatus.SUCCESS
      : ResponseStatus.ERROR;
  }
}
