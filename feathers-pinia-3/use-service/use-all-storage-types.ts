import fastCopy from 'fast-copy'
import type { MakeCopyOptions } from '../types'
import { defineProperties, getArray } from '../utils'
import type { AnyData } from './types'
import { useServiceTemps } from './use-service-temps'
import { useServiceClones } from './use-service-clones'
import { useServiceStorage } from './use-service-storage'

interface UseAllStorageOptions {
  getModel: () => any
  getIdField: (val: AnyData) => any
  /**
   * A callback after clearing the store. Allows loose coupling of other functionality, like clones.
   */
  afterClear?: () => void
}

export const useAllStorageTypes = <M extends AnyData>(options: UseAllStorageOptions) => {
  const { getModel, getIdField, afterClear } = options

  // Make sure the provided item is a model "instance" (in quotes because it's not a class)
  const assureInstance = (item: AnyData) => {
    const Model = getModel()
    return item.__modelName ? item : Model ? Model(item as AnyData) : item
  }

  /**
   * Makes a copy of the Model instance with __isClone properly set
   * Private
   */
  const makeCopy = (item: M, data: AnyData = {}, { isClone }: MakeCopyOptions) => {
    const copied = fastCopy(item)
    Object.assign(copied, data)
    // instance.__isTemp
    Object.defineProperty(copied, '__isTemp', {
      configurable: true,
      enumerable: false,
      get() {
        return this[this.__idField] == null
      },
    })
    const withExtras = defineProperties(copied, {
      __isClone: isClone,
      __tempId: item.__tempId,
    })
    return withExtras
  }

  // item storage
  const itemStorage = useServiceStorage<M>({
    getId: getIdField,
    onRead: assureInstance,
    beforeWrite: assureInstance,
  })

  // temp item storage
  const { tempStorage, moveTempToItems } = useServiceTemps<M>({
    getId: item => item.__tempId,
    itemStorage,
    onRead: assureInstance,
    beforeWrite: assureInstance,
  })

  // clones
  const { cloneStorage, clone, commit, reset, markAsClone } = useServiceClones<M>({
    itemStorage,
    tempStorage,
    onRead: assureInstance,
    makeCopy,
    beforeWrite: (item) => {
      markAsClone(item)
      return assureInstance(item)
    },
  })

  /**
   * Stores the provided item in the correct storage (itemStorage, tempStorage, or cloneStorage).
   * If an item has both an id and a tempId, it gets moved from tempStorage to itemStorage.
   * Private
   */
  const addItemToStorage = (item: M) => {
    const id = getIdField(item)

    if (item.__isClone)
      return cloneStorage.merge(item)

    else if (id != null && item.__tempId != null)
      return moveTempToItems(item)

    else if (id != null)
      return itemStorage.merge(item)

    else if (tempStorage && item.__tempId != null)
      return tempStorage?.merge(item)

    return itemStorage.merge(item)
  }

  /**
   * An alias for addOrUpdate
   * @param data a single record or array of records.
   * @returns data added or modified in the store. If you pass an array, you get an array back.
   */
  function addToStore(data: AnyData | AnyData[]): AnyData | AnyData[] {
    const { items, isArray } = getArray(data)

    const _items = items.map((item: AnyData) => {
      const Model = getModel()
      const asModel = item.__Model ? item : Model(item as any)
      if (item != null && asModel == null)
        throw new Error('No model instance was created. Is your modelFn missing a return statement?')

      const stored = addItemToStorage(asModel)
      return stored
    })

    return isArray ? _items : _items[0]
  }

  /**
   * Removes item from all stores (items, temps, clones).
   * Reactivity in Vue 3 might be fast enough to just remove each item and not batch.
   * @param data
   */
  function removeFromStore(data: M | M[]) {
    const { items } = getArray(data)
    items.forEach((item: M) => {
      itemStorage.remove(item)
      tempStorage.remove(item)
      cloneStorage.remove(item)
    })
    return data
  }

  function clearAll() {
    itemStorage.clear()
    tempStorage.clear()
    cloneStorage.clear()
    afterClear && afterClear()
  }

  return {
    itemStorage,
    tempStorage,
    cloneStorage,
    clone,
    commit,
    reset,
    addToStore,
    removeFromStore,
    clearAll,
  }
}