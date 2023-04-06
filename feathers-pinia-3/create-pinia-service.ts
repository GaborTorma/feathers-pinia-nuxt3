import type { Params as FeathersParams, FeathersService, Id } from '@feathersjs/feathers'
import type { AnyData, Params, Query } from './types'
import type { MaybeRef } from '@vueuse/core'
import type { UseFindOptions, UseFindPage, UseFindParams, UseGetParams } from './use-find-get'
import type { ComputedRef } from 'vue-demi'
import { reactive, computed, isRef, ref, unref } from 'vue-demi'
import { getParams } from './utils'
import { useFind, useGet } from './use-find-get'
import { convertData } from './utils/convert-data'
import { FeathersInstance } from './modeling'

interface PiniaServiceOptions {
  servicePath: string
  store: any
}

export class PiniaService<Svc extends FeathersService> {
  store
  servicePath = ''

  constructor(public service: Svc, public options: PiniaServiceOptions) {
    this.store = options.store
    this.servicePath = options.servicePath
  }

  /**
   * Prepare new "instances" outside of store
   *
   * Functionally upgrades plain data to a service model "instance".
   * - flags each record with `__isSetup` to avoid duplicate work.
   */
  new(data: AnyData = {}) {
    const asInstance = this.store.new(data)
    return reactive(asInstance)
  }

  /* service methods clone params */

  async find(_params?: MaybeRef<Params<Query>>) {
    const params = getParams(_params)
    const result = await this.service.find(params as FeathersParams)
    return result
  }

  async findOne(_params?: MaybeRef<Params<Query>>) {
    const params = getParams(_params)
    const result = await this.service.find(params as FeathersParams)
    const item = (result.data || result)[0] || null
    return item
  }

  async count(_params?: MaybeRef<Params<Query>>) {
    const params = getParams(_params)
    const result = await this.service.find(params as FeathersParams)
    return result
  }

  async get(id: Id, _params?: MaybeRef<Params<Query>>) {
    const params = getParams(_params)
    const result = await this.service.get(id, params)
    return result
  }

  async create(data: AnyData) {
    const result = await this.service.create(data)
    return result
  }

  async patch(id: Id, data: AnyData, _params?: MaybeRef<Params<Query>>) {
    const params = getParams(_params)
    const result = await this.service.patch(id, data, params)
    return result
  }

  async remove(id: Id, _params?: MaybeRef<Params<Query>>) {
    const params = getParams(_params)
    const result = await this.service.remove(id, params)
    return result
  }

  /* store methods accept refs and don't copy params */

  findInStore(params?: MaybeRef<Params<Query>>) {
    const result = this.store.findInStore(params)
    return {
      ...result,
      data: computed(() => {
        return result.data.value.map((i: any) => convertData(this, i))
      }),
    }
  }

  findOneInStore(params?: MaybeRef<Params<Query>>) {
    const result = this.store.findOneInStore(params)
    return result
  }

  countInStore(params?: MaybeRef<Params<Query>>) {
    const result = this.store.countInStore(params)
    return result
  }

  getFromStore(id: Id, params?: MaybeRef<Params<Query>>): ComputedRef<FeathersInstance<AnyData>> {
    const result = this.store.getFromStore(id, params)
    const converted = computed(() => convertData(this, result.value) as FeathersInstance<AnyData>)
    return converted
  }

  createInStore(data: AnyData) {
    const convertedInput = convertData(this, data)
    const result = this.store.createInStore(convertedInput)
    const converted = convertData(this, result)
    return converted
  }

  // TODO: Support multi patch with params
  // patchInStore(id: Id, data: AnyData, _params?: MaybeRef<Params<Query>>) {
  patchInStore(id: Id, data: AnyData) {
    const item = id != null ? this.getFromStore(id) : null
    const convertedInput = convertData(this, { ...item, ...data })
    const result = this.store.addOrUpdate(convertedInput)
    const converted = convertData(this, result)
    return converted
  }

  removeFromStore(id?: Id, params?: MaybeRef<Params<Query>>) {
    const item = id != null ? this.getFromStore(id) : null
    if (item) {
      const result = this.store.removeFromStore(item)
      const converted = convertData(this, result)
      return converted
    } else if (id == null && unref(params)?.query) {
      const result = this.store.removeByQuery(params)
      const converted = convertData(this, result)
      return converted
    }
  }

  /* hybrid methods */

  useFind(params: ComputedRef<UseFindParams | null>, options?: UseFindOptions) {
    const _params = isRef(params) ? params : ref(params)
    return useFind(_params, options, { store: this.store, service: this })
  }

  useGet(id: MaybeRef<Id | null>, params: MaybeRef<UseGetParams> = ref({})) {
    const _id = isRef(id) ? id : ref(id)
    const _params = isRef(params) ? params : ref(params)
    return useGet(_id, _params, { store: this.store, service: this })
  }

  useGetOnce(_id: MaybeRef<Id | null>, params: MaybeRef<UseGetParams> = {}) {
    const _params = isRef(params) ? params : ref(params)
    Object.assign(_params.value, { immediate: false })
    const results = this.useGet(_id, _params)
    results.queryWhen(() => !results.data.value)
    results.get()
    return results
  }

  /* events */

  on(eventName: string | symbol, listener: (...args: any[]) => void) {
    return this.service.on(eventName, listener)
  }

  emit(eventName: string | symbol, ...args: any[]): boolean {
    return this.service.emit(eventName, ...args)
  }

  removeListener(eventName: string | symbol, listener: (...args: any[]) => void) {
    return this.service.removeListener(eventName, listener)
  }
}
