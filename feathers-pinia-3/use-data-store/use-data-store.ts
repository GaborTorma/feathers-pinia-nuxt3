import type { Query } from '@feathersjs/feathers'

import { computed, unref } from 'vue-demi'
import type { AnyData } from '../types'
import { MaybeRef } from '@vueuse/core'
import type { HandleEvents } from './types'
import { useServiceLocal } from './local-queries'

import { useServicePagination } from './pagination'
import { useServicePending } from './pending'
import { useServiceEventLocks } from './event-locks'
import { useAllStorageTypes } from './all-storage-types'
import { useModelInstance } from '../modeling/use-model-instance'

export interface UseServiceOptions<M extends AnyData> {
  idField: string
  whitelist?: string[]
  paramsForServer?: string[]
  skipGetIfExists?: boolean
  ssr?: MaybeRef<boolean>
  customSiftOperators?: Record<string, any>
  setupInstance?: any
}

const makeDefaultOptions = () => ({
  skipGetIfExists: false,
})

export const useDataStore = <M extends AnyData, Q extends Query>(_options: UseServiceOptions<M>) => {
  const options = Object.assign({}, makeDefaultOptions(), _options)
  const { idField, whitelist, paramsForServer, customSiftOperators } = options

  function setupInstance<N extends M>(this: any, data: N) {
    const asBaseModel = useModelInstance(data, {
      idField,
      clonesById: cloneStorage.byId,
      clone,
      commit,
      reset,
      createInStore,
      removeFromStore,
    })

    if (data.__isSetup) return asBaseModel
    else {
      const afterSetup = options.setupInstance ? options.setupInstance(asBaseModel) : asBaseModel
      Object.defineProperty(afterSetup, '__isSetup', { value: true })
      return afterSetup
    }
  }

  // pending state
  const pendingState = useServicePending()

  // storage
  const { itemStorage, tempStorage, cloneStorage, clone, commit, reset, addItemToStorage } = useAllStorageTypes<M>({
    getIdField: (val: AnyData) => val[idField],
    setupInstance,
  })

  const isSsr = computed(() => {
    const ssr = unref(options.ssr)
    return !!ssr
  })

  // pagination
  const { pagination, clearPagination, updatePaginationForQuery, unflagSsr } = useServicePagination({
    idField,
    isSsr,
  })

  function clearAll() {
    itemStorage.clear()
    tempStorage.clear()
    cloneStorage.clear()
    clearPagination()
    pendingState.clearAllPending()
  }

  // local data filtering
  const { findInStore, findOneInStore, countInStore, getFromStore, createInStore, patchInStore, removeFromStore } =
    useServiceLocal<M, Q>({
      idField,
      itemStorage,
      tempStorage,
      cloneStorage,
      addItemToStorage,
      whitelist,
      paramsForServer,
      customSiftOperators,
    })

  // event locks
  const eventLocks = useServiceEventLocks()

  const store = {
    new: setupInstance,
    idField,
    whitelist,
    paramsForServer,
    isSsr,

    // items
    itemsById: itemStorage.byId,
    items: itemStorage.list,
    itemIds: itemStorage.ids,

    // temps
    tempsById: tempStorage.byId,
    temps: tempStorage.list,
    tempIds: tempStorage.ids,

    // clones
    clonesById: cloneStorage.byId,
    clones: cloneStorage.list,
    cloneIds: cloneStorage.ids,
    clone,
    commit,
    reset,

    // options
    pagination,
    updatePaginationForQuery,
    unflagSsr,

    // local queries
    findInStore,
    findOneInStore,
    countInStore,
    createInStore,
    getFromStore,
    patchInStore,
    removeFromStore,
    clearAll,

    ...pendingState,
    ...eventLocks,
  }

  return store
}
