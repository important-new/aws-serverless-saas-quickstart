import { Component, OnInit } from '@angular/core';
import { from, Observable } from 'rxjs';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import type { AuthSession } from 'aws-amplify/auth';
import { map } from 'rxjs/operators';

@Component({
  standalone: false,
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
})
export class AuthComponent implements OnInit {
  session$: Observable<AuthSession> | undefined;
  userData$: Observable<any> | undefined;
  isAuthenticated$: Observable<boolean> | undefined;
  checkSessionChanged$: Observable<boolean> | undefined;
  idToken$: Observable<string> | undefined;
  accessToken$: Observable<string> | undefined;
  checkSessionChanged: any;

  constructor() {}

  ngOnInit(): void {
    this.session$ = from(fetchAuthSession());
    this.accessToken$ = this.session$.pipe(
      map((sesh) => sesh.tokens?.accessToken?.toString() ?? '')
    );
    this.idToken$ = this.session$.pipe(
      map((sesh) => sesh.tokens?.idToken?.toString() ?? '')
    );
    this.isAuthenticated$ = this.session$.pipe(
      map((sesh) => !!sesh.tokens?.idToken)
    );
  }

  async logout() {
    await signOut({ global: true });
  }
}
