import type { Params as FeathersParams, FeathersService, Id } from '@feathersjs/feathers'
import type { AnyData, MaybeRef, Params, Query, UseFindParams, UseGetParams } from './types'
import { getParams } from './utils'
import { useFind } from './use-find'
import { useGet } from './use-get'
import { useModelInstance } from './modeling/use-model-instance'
import { useFeathersInstance } from './modeling/use-feathers-instance'
import { convertData } from './utils/convert-data'

interface VueServiceOptions {
  servicePath: string
  store: any
  setupFn?: <D extends AnyData>(data: D) => D
}

export class VueService<Svc extends FeathersService> {
  store
  servicePath = ''
  private setupFn

  constructor(public service: Svc, public options: VueServiceOptions) {
    this.store = options.store
    this.setupFn = options.setupFn
    this.servicePath = options.servicePath
  }

  /* prepare new "instances" outside of store */

  /**
   * Functionally upgrades plain data to a service model "instance".
   * - flags each record with `__isSetup` to avoid duplicate work.
   */
  new(data: AnyData = {}) {
    if (data.__isSetup)
      return data

    const asBaseModel = useModelInstance(data, {
      servicePath: this.servicePath,
      store: this.store,
    })
    const asFeathersModel = useFeathersInstance(asBaseModel, {
      service: this as any,
      store: this.store,
    })
    const afterSetup = this.setupFn ? this.setupFn(asFeathersModel) : asFeathersModel
    Object.defineProperty(afterSetup, '__isSetup', { value: true })
    return reactive(afterSetup)
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
    // const converted = convertData(this, result)
    const refs = toRefs(result)
    return refs
  }

  findOneInStore(params?: MaybeRef<Params<Query>>) {
    const result = this.store.findInStore(params)
    const item = result.data[0] || null
    const converted = convertData(this, item)
    return converted
  }

  countInStore(params?: MaybeRef<Params<Query>>) {
    const result = this.store.countInStore(params)
    return result
  }

  getFromStore(id: Id, params?: MaybeRef<Params<Query>>) {
    const result = this.store.getFromStore(id, params)
    const converted = convertData(this, result)
    return converted
  }

  createInStore(data: AnyData) {
    const convertedInput = convertData(this, data)
    const result = this.store.addToStore(convertedInput)
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
    }
    else if (id == null && unref(params)?.query) {
      const result = this.store.removeByQuery(params)
      const converted = convertData(this, result)
      return converted
    }
  }

  /* hybrid methods */

  useFind(params: MaybeRef<UseFindParams>) {
    const _params = isRef(params) ? params : ref(params)
    return useFind(_params, { store: this.store, service: this })
  }

  useGet(id: MaybeRef<Id | null>, params: MaybeRef<UseGetParams> = ref({})) {
    const _id = isRef(id) ? id : ref(id)
    const _params = isRef(params) ? params : ref(params)
    return useGet(_id, _params, { store: this.store, service: this })
  }

  useGetOnce(_id: MaybeRef<Id | null>, params: MaybeRef<UseGetParams> = {}) {
    const _params = ref(params)
    Object.assign(_params.value, { store: this, immediate: false, onServer: true })
    const results = this.useGet(_id, _params)
    results.queryWhen(() => !results.data.value)
    results.get()
    return results
  }
}
