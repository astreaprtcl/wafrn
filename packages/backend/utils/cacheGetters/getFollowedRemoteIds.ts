import { Op } from 'sequelize'
import { Follows, User } from '../../models/index.js'
import { redisCache } from '../redis.js'
import getFollowedsIds from './getFollowedsIds.js'
import { completeEnvironment } from '../backendOptions.js'

async function getFollowedRemoteIds(id: string) {
  const cacheResult = await redisCache.get('remoteFollowed:' + id)
  if (cacheResult) {
    return JSON.parse(cacheResult)
  } else {
    const follows = await Follows.findAll({
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'follower'
        }
      ],
      where: {
        followerId: id,
        accepted: true
      }
    })
    const res = follows.map((follow: any) =>
      follow.follower.url.startsWith('@')
        ? follow.follower.remoteId
        : `${completeEnvironment.frontendUrl}/fediverse/blog/${follow.follower.url}`
    )
    await redisCache.set('remoteFollowed:' + id, JSON.stringify(res), 'EX', 300)
    return res
  }
}

export { getFollowedRemoteIds }
