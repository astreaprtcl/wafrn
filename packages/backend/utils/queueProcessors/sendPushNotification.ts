import { Expo } from 'expo-server-sdk'
import { PushNotificationToken } from '../../models/index.js'
import { logger } from '../logger.js'
import { getNotificationBody, getNotificationTitle, handleDeliveryError, type NotificationBody, type NotificationContext } from '../pushNotifications.js'
import { Job, Queue } from 'bullmq'
import { environment } from '../../environment.js'
import { Op } from 'sequelize'
import { getMutedPosts } from '../cacheGetters/getMutedPosts.js'
import { sendWebPushNotifications } from '../webpush.js'

const deliveryCheckQueue = new Queue('checkPushNotificationDelivery', {
  connection: environment.bullmqConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
})

const expoClient = new Expo()

type PushNotificationPayload = {
  notifications: NotificationBody[]
  context?: NotificationContext
}

export async function sendPushNotification(job: Job<PushNotificationPayload>) {
  const { notifications, context } = job.data
  await sendWebPushNotifications(notifications, context)
  await sendExpoNotifications(notifications, context)
}

export async function sendExpoNotifications(
  notifications: NotificationBody[],
  context?: NotificationContext
) {
  const userIds = notifications.map((elem) => elem.notifiedUserId)
  const tokenRows = await PushNotificationToken.findAll({
    where: {
      userId: {
        [Op.in]: userIds
      }
    }
  })

  if (tokenRows.length === 0) {
    return
  }
  const payloads = notifications.map((notification) => {
    const tokens = tokenRows
      .filter((row) => row.userId === notification.notifiedUserId)
      .filter(async (row) => {
        const mutedPosts = (await getMutedPosts(notification.notifiedUserId, false)).concat(
          await getMutedPosts(notification.notifiedUserId, true)
        )
        return !mutedPosts.includes(notification.postId ? notification.postId : '')
      })
      .map((row) => row.token)

    // send the same notification to all the devices of each notified user
    return {
      to: tokens,
      sound: 'default',
      title: getNotificationTitle(notification, context),
      body: getNotificationBody(notification, context),
      data: { notification, context }
    }
  })

  // this will chunk the payloads into chunks of 1000 (max) and compress notifications with similar content
  const okTickets = []
  const filteredPayloads: {
    to: any[]
    sound: string
    title: string
    body: string
    data: {
      notification: NotificationBody
      context: NotificationContext | undefined
    }
  }[] = []
  for await (const payload of payloads) {
    const mutedPosts = (await getMutedPosts(payload.data.notification.notifiedUserId, false)).concat(
      await getMutedPosts(payload.data.notification.notifiedUserId, true)
    )
    if (!mutedPosts.includes(payload.data.notification.postId as string)) {
      filteredPayloads.push(payload)
    }
  }
  const chunks = expoClient.chunkPushNotifications(filteredPayloads)
  for (const chunk of chunks) {
    const responses = await expoClient.sendPushNotificationsAsync(chunk)
    for (const response of responses) {
      if (response.status === 'ok') {
        okTickets.push(response.id)
      } else {
        await handleDeliveryError(response)
      }
    }
  }

  await scheduleNotificationCheck(okTickets)
}

// schedule a job to check the delivery of the notifications after 30 minutes of being sent
// this guarantees that the notification was delivered to the messaging services even in cases of high load
function scheduleNotificationCheck(ticketIds: string[]) {
  const delay = 1000 * 60 * 30 // 30 minutes
  return deliveryCheckQueue.add('checkPushNotificationDelivery', { ticketIds }, { delay })
}
