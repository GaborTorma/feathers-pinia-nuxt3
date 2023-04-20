import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { deepUnref } from '../utils'

/**
 * deeply unrefs `params.query`
 */
export const unrefQuery = () => async (context: HookContext, next: NextFunction) => {
  if (context.params.query) {
    context.params.query = deepUnref(context.params.query)
  }

  if (context.method === 'find') {
    const query = context.params.query || {}
    if (query.$limit == null) {
      query.$limit = context.service.store.defaultLimit
    }
    if (query.$skip == null) {
      query.$skip = 0
    }
    context.params.query = query
  }

  await next()
}
