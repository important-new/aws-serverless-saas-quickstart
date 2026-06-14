import { Component, OnInit } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { from, Observable, of } from 'rxjs';
import { filter, map, shareReplay } from 'rxjs/operators';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';

import { AuthenticatorService } from '@aws-amplify/ui-angular';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import { navItems } from '../_nav';
import { AuthConfigurationService } from './../views/auth/auth-configuration.service';

@Component({
  standalone: false,
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss'],
})
export class NavComponent implements OnInit {
  loading$: Observable<boolean> = of(false);
  isAuthenticated$: Observable<Boolean> | undefined;
  username$: Observable<string> | undefined;
  companyName$: Observable<string> | undefined;
  public navItems = navItems;
  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(
      map((result) => result.matches),
      shareReplay()
    );

  constructor(
    private breakpointObserver: BreakpointObserver,
    private router: Router,
    private authConfigService: AuthConfigurationService
  ) {
    // this.configSvc.loadConfigurations().subscribe((val) => console.log(val));
    this.loading$ = this.router.events.pipe(
      filter(
        (e) =>
          e instanceof NavigationStart ||
          e instanceof NavigationEnd ||
          e instanceof NavigationCancel ||
          e instanceof NavigationError
      ),
      map((e) => e instanceof NavigationStart)
    );
  }

  ngOnInit(): void {
    try {
      const s = fetchAuthSession().catch((err) => {
        console.log('Failed to get current session. Err: ', err);
        return null;
      });
      const session$ = from(s);
      this.isAuthenticated$ = session$.pipe(
        filter((sesh) => !!sesh),
        map((sesh) => !!sesh?.tokens?.idToken)
      );

      const token$ = session$.pipe(map((sesh) => sesh?.tokens?.idToken));
      this.username$ = token$.pipe(
        map((t) => (t && t.payload && (t.payload['cognito:username'] as string)) || '')
      );
      this.companyName$ = token$.pipe(
        map((t) => (t && t.payload && (t.payload['custom:company-name'] as string)) || '')
      );
    } catch (err) {
      console.error('Unable to get current session.');
    }
  }

  async logout() {
    await signOut({ global: true })
      .then((e) => {
        this.authConfigService.cleanLocalStorage();
        this.router.navigate(['/unauthorized']);
      })
      .catch((err) => {
        console.error('Error logging out: ', err);
      });
  }
}
