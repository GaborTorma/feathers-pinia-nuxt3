import ObjectID from 'isomorphic-mongo-objectid'
import type { AnyData, CloneOptions } from '../use-service'
import { defineProperties } from '../utils/define-properties'
import type { BaseModelData, BaseModelInstanceProps, ModelInstanceData } from './types'

interface UseModelInstanceOptions {
  servicePath: string
  store: any
  service?: any
}

export const useModelInstance = <M extends AnyData>(data: ModelInstanceData<M>, options: UseModelInstanceOptions) => {
  const { servicePath, store } = options
  const __isClone = data.__isClone || false
  const service = options.service || { new: <M>(val: M) => val }
  const setupInstance = <M>(data: M) => service.new(data)

  // instance.__isTemp
  Object.defineProperty(data, '__isTemp', {
    configurable: true,
    enumerable: false,
    get() {
      return this[this.__idField] == null
    },
  })

  // BaseModel properties
  const asBaseModel = defineProperties(data, {
    __servicePath: servicePath,
    __isClone,
    __idField: store.idField,
    __tempId: (data[store.idField] == null && data.__tempId == null) ? new ObjectID().toString() : (data.__tempId || undefined),
    getClone(this: M) {
      const id = this[this.__idField] || this.__tempId
      const item = store.clonesById[id]
      return item ? setupInstance(item) : null
    },
    clone(this: M, data: Partial<M> = {}, options: CloneOptions = {}) {
      const item = store.clone(this, data, options)
      return setupInstance(item)
    },
    commit(this: M, data: Partial<M> = {}) {
      const item = store.commit(this, data, options)
      return setupInstance(item)
    },
    reset(this: M, data: Partial<M> = {}) {
      const item = store.reset(this, data, options)
      return setupInstance(item)
    },
    addToStore(this: M) {
      const item = store.addToStore(this)
      return setupInstance(item)
    },
    removeFromStore(this: M) {
      const item = store.removeFromStore(this)
      return setupInstance(item)
    },
  }) as M & BaseModelData & BaseModelInstanceProps<M>

  return asBaseModel
}
