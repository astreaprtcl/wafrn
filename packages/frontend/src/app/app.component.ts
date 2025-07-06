import { Component, Injector, Inject, OnInit, DOCUMENT } from '@angular/core'
import { SwUpdate } from '@angular/service-worker'
import { LoginService } from './services/login.service'
import { EnvironmentService } from './services/environment.service'
import { TranslateService } from '@ngx-translate/core'
import { SwPush } from '@angular/service-worker'

import { WebsocketService } from './services/websocket.service'
import { NavigationError, Router } from '@angular/router'
import { filter, map } from 'rxjs'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: false
})
export class AppComponent implements OnInit {
  title = 'wafrn'

  constructor(
    private swUpdate: SwUpdate,
    private swPush: SwPush,
    private injector: Injector,
    private loginService: LoginService,
    private environmentService: EnvironmentService,
    @Inject(DOCUMENT) private document: Document,
    private translate: TranslateService,
    private websocketService: WebsocketService,
    private router: Router
  ) {
    this.translate.addLangs(['en', 'pl', 'es'])
    this.translate.setDefaultLang('en')
    try {
      // TODO re enable this
      // this.translate.use(this.translate.getBrowserLang() || 'en')
    } catch (error) {
      // probably lang not avaiable
    }
    router.events
      .pipe(
        filter((evt) => evt instanceof NavigationError),
        map((evt) => evt as NavigationError)
      )
      .subscribe((evt) => {
        if (evt.error instanceof Error && evt.error.name == 'ChunkLoadError') {
          window.location.assign(evt.url)
        }
      })
    swUpdate.unrecoverable.subscribe((event) => {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (const registration of registrations) {
          registration.unregister()
        }
        window.location.reload()
      })
    })
  }

  ngOnInit() {
    // unregister serviceworkers
    /*navigator.serviceWorker.getRegistrations().then(function (registrations) {
      for (const registration of registrations) {
        registration.unregister();
      }
    });*/

    if (this.swUpdate.isEnabled) {
      this.swUpdate.checkForUpdate().then((updateAvaiable) => {
        if (EnvironmentService.environment.disablePWA) {
          if ('caches' in window) {
            caches.keys().then(function (keyList) {
              return Promise.all(
                keyList.map(function (key) {
                  return caches.delete(key)
                })
              )
            })
          }
          if (window.navigator && navigator.serviceWorker) {
            navigator.serviceWorker.getRegistrations().then(function (registrations) {
              for (const registration of registrations) {
                registration.unregister()
              }
            })
          }
        }
        // we are no longer asking nicely
        if (updateAvaiable) {
          window.location.reload()
        }
      })
    }
    // TODO lets keep with this later
    if (false && this.swPush.isEnabled && EnvironmentService.environment.webpushPublicKey) {
      this.swPush
        .requestSubscription({
          serverPublicKey: EnvironmentService.environment.webpushPublicKey
        })
        .then((notificationSubscription) => {
          console.log(notificationSubscription)
        })
    }
    const currentLang = this.translate.currentLang || this.translate.getDefaultLang() || 'en'
    this.document.documentElement.lang = currentLang
    this.translate.onLangChange.subscribe((event) => {
      this.document.documentElement.lang = event.lang
    })
  }
}
