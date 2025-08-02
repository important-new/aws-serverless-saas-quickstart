/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
} from '@angular/common/http';
import { from, Observable } from 'rxjs';
import { fetchAuthSession } from 'aws-amplify/auth';
import { filter, map, switchMap } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor() {}
  idToken = '';

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    if (req.url.includes('tenant/init')) {
      return next.handle(req);
    }

    const s = fetchAuthSession().catch((err: any) => console.log(err));
    const session$ = from(s);

    return session$.pipe(
      filter((sesh) => !!sesh),
      map((sesh) => (!!sesh ? sesh.tokens?.idToken?.toString() || '' : '')),
      switchMap((tok) => {
        req = req.clone({
          headers: req.headers.set('Authorization', 'Bearer ' + tok),
        });
        return next.handle(req);
      })
    );
  }
}
