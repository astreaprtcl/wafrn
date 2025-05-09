import { HttpClient } from '@angular/common/http'
import { Injectable, OnDestroy } from '@angular/core'
import { BehaviorSubject, Subscription } from 'rxjs'

import { WafrnMedia } from '../interfaces/wafrn-media'
import { Action, EditorLauncherData } from '../interfaces/editor-launcher-data'
import { MatDialog } from '@angular/material/dialog'
import { ProcessedPost } from '../interfaces/processed-post'
import { Ask } from '../interfaces/ask'
import { DashboardService } from './dashboard.service'
import { EditorData } from '../interfaces/editor-data'
import { EnvironmentService } from './environment.service'

import { NewEditorComponent } from '../components/new-editor/new-editor.component'
import { MessageService } from './message.service'

@Injectable({
  providedIn: 'any'
})
export class EditorService implements OnDestroy {
  base_url = EnvironmentService.environment.baseUrl
  public launchPostEditorEmitter: BehaviorSubject<EditorLauncherData> = new BehaviorSubject<EditorLauncherData>({
    action: Action.None
  })

  editorSubscription: Subscription
  // TODO do something about this when angular 19, I dont like this too much
  public static editorData: EditorData | undefined
  constructor(
    private http: HttpClient,
    private dashboardService: DashboardService,
    private dialogService: MatDialog,
    private messages: MessageService
  ) {
    this.editorSubscription = this.launchPostEditorEmitter.subscribe((data) => {
      if (data.action !== Action.None) {
        this.launchPostEditorEmitter.next({
          action: Action.None
        })
      }
    })
  }
  ngOnDestroy(): void {
    this.editorSubscription.unsubscribe()
  }

  async createPost(options: {
    mentionedUsers: string[]
    content: string
    media: WafrnMedia[]
    privacy: number
    tags?: string
    idPostToReblog?: string
    contentWarning?: string
    idPostToEdit?: string
    idPosToQuote?: string
    ask?: Ask
  }): Promise<boolean> {
    const content = options.content
    const media = options.media
    const privacy = options.privacy
    const tags = options.tags
    const idPostToReblog = options.idPostToReblog
    const contentWarning = options.contentWarning
    const mentionedUsers = options.mentionedUsers
    let success: boolean = false
    try {
      const formdata = {
        content: content,
        parent: idPostToReblog,
        medias: media,
        tags: tags,
        privacy: privacy,
        content_warning: contentWarning ? contentWarning : '',
        idPostToEdit: options.idPostToEdit,
        postToQuote: options.idPosToQuote,
        ask: options.ask?.id,
        mentionedUsersIds: mentionedUsers
      }
      const url = `${this.base_url}/v3/createPost`
      const petitionResponse: any = await this.http.post(url, formdata).toPromise()
      success = petitionResponse.id
      if (success) {
        // HACK wait 0.7 seconds so post is fully processed?
        await new Promise((resolve) => setTimeout(resolve, 700))
      }
    } catch (exception: any) {
      if (exception.error?.message) {
        this.messages.add({
          severity: 'warn',
          summary: exception.error.message
        })
      } else {
        this.messages.add({
          severity: 'warn',
          summary: 'Something went wrong and your woot was not published. Check your internet connection and try again'
        })
      }
    }

    return success
  }

  async uploadMedia(description: string, nsfw: boolean, img: File): Promise<WafrnMedia | undefined> {
    let res: WafrnMedia | undefined = undefined
    try {
      const payload = new FormData()
      payload.append('files', img)
      payload.append('description', description)
      payload.append('nsfw', nsfw.toString())
      const petition: any = await this.http
        .post<Array<WafrnMedia>>(`${EnvironmentService.environment.baseUrl}/uploadMedia`, payload)
        .toPromise()
      if (petition) {
        res = petition[0]
      }
    } catch (exception) {
      console.error(exception)
    }

    return res
  }

  async searchUser(url: string) {
    return await this.http
      .get(`${EnvironmentService.environment.baseUrl}/userSearch/${encodeURIComponent(url)}`)
      .toPromise()
  }

  public async replyPost(post: ProcessedPost, edit = false) {
    await this.openDialogWithData({ post: post, edit: edit })
  }

  public async quotePost(quoteTo: ProcessedPost) {
    await this.openDialogWithData({ quote: quoteTo })
  }

  public async replyAsk(ask: Ask) {
    await this.openDialogWithData({ ask: ask })
  }

  public async openDialogWithData(data: any) {
    if (this.dialogService.openDialogs.length === 0) {
      const mobile = window.innerWidth <= 992
      EditorService.editorData = {
        ...data,
        scrollDate: this.dashboardService.startScrollDate,
        path: window.location.pathname
      }
      this.dialogService.open(NewEditorComponent)
    }
  }

  async getEditorComponent() {
    const { NewEditorComponent } = await import('../components/new-editor/new-editor.component')
    return NewEditorComponent
  }
}
