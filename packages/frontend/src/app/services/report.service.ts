import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { UntypedFormGroup } from '@angular/forms'
import { ReplaySubject } from 'rxjs'

import { ProcessedPost } from '../interfaces/processed-post'
import { MatDialog } from '@angular/material/dialog'
import { EnvironmentService } from './environment.service'

@Injectable({
  providedIn: 'any'
})
export class ReportService {
  public launchReportScreen: ReplaySubject<Array<ProcessedPost>> = new ReplaySubject()

  constructor(
    private http: HttpClient, //private messages: MessageService
    private dialogService: MatDialog
  ) {}

  async reportPost(post: ProcessedPost[] | undefined, report: UntypedFormGroup, userId: string): Promise<boolean> {
    let success = false
    try {
      const formData = {
        ...report.value,
        userId: userId,
        postId: post ? post[post.length - 1].id : undefined
      }
      await this.http.post(`${EnvironmentService.environment.baseUrl}/reportPost`, formData).toPromise()
      success = true
    } catch (error) {
      console.error(error)
      //this.messages.add({ severity: 'error', summary: 'Something went wrong reporting the post! Check your internet conectivity and try again.' });
    }

    return success
  }

  async getReportComponent(): Promise<typeof ReportPostComponent> {
    const { ReportPostComponent } = await import('../components/report-post/report-post.component')
    return ReportPostComponent
  }

  async openReportPostDialog(data: { post: ProcessedPost } | { userId: string }) {
    this.dialogService.open(await this.getReportComponent(), {
      data: { data }
    })
  }
}
