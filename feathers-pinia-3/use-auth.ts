import type { Ref } from 'vue-demi'
import { computed, ref } from 'vue-demi'
import { BadRequest } from '@feathersjs/errors'
import decode from 'jwt-decode'
import type { NullableId } from '@feathersjs/feathers'
import { useCounter } from './utils/use-counter'

type SuccessHandler = (result: Record<string, any>) => Promise<Record<string, any> | void>
type ErrorHandler = (error: Error) => Promise<void>

interface UseAuthOptions {
  api: any
  userServicePath?: string
  skipTokenCheck?: boolean
  entityKey?: string
  onSuccess?: SuccessHandler
  onError?: ErrorHandler
  onInitSuccess?: SuccessHandler
  onInitError?: ErrorHandler
  onLogoutSuccess?: SuccessHandler
  onLogoutError?: ErrorHandler
}

interface AuthenticateData {
  strategy: 'jwt' | 'local'
  accessToken?: string
  email?: string
  password?: string
}

export const useAuth = <d extends AuthenticateData = AuthenticateData>(options: UseAuthOptions) => {
  const { api, userServicePath, skipTokenCheck } = options
  const userService = userServicePath ? api.service(userServicePath) : null
  const entityKey = options.entityKey || 'user'

  // external flow
  const promise = ref() as Ref<Promise<Record<string, any>>>
  const defaultHandler = async () => undefined
  const defaultErrorHandler = async (error: any) => {
    throw error
  }
  const onSuccess: SuccessHandler = options.onSuccess || defaultHandler
  const onError: ErrorHandler = options.onError || defaultErrorHandler
  const onInitSuccess: SuccessHandler = options.onInitSuccess || defaultHandler
  const onInitError: ErrorHandler = options.onInitError || defaultHandler
  const onLogoutSuccess: SuccessHandler = options.onLogoutSuccess || defaultHandler
  const onLogoutError: ErrorHandler = options.onLogoutError || defaultErrorHandler

  // user
  const userId = ref<NullableId>(null)
  const user = computed(() => {
    const u = userService?.getFromStore(userId)
    return u || null
  })

  // error
  const error = ref<Error | null>(null)
  const clearError = () => (error.value = null)

  // authenticate
  const authCounter = useCounter()
  const isPending = computed(() => !!authCounter.count.value)
  const isAuthenticated = ref(false)
  const handleAuthResult = (result: any) => {
    const entity = result[entityKey]
    if (userService && entity) {
      const stored = userService.store.addToStore(entity)
      userId.value = stored[userService.store.idField] || stored.__tempId
    }
    isAuthenticated.value = true
    return result
  }
  const authenticate = async (data?: d) => {
    authCounter.add()
    clearError()
    promise.value = api
      .authenticate(data)
      .then(handleAuthResult)
      .then(async (result: Record<string, any>) => {
        const _result = await onSuccess(result)
        return _result || result
      })
      .catch((err: any) => {
        error.value = err
        return onError(err)
      })
      .finally(() => {
        authCounter.sub()
      })
    return promise.value
  }

  // token check
  const isTokenExpired = (jwt: string) => {
    try {
      const payload = decode(jwt) as any
      return new Date().getTime() > payload.exp * 1000
    }
    catch (error) {
      return false
    }
  }

  // reauthentication at app start
  const isInitDone = ref(false)
  const reAuthenticate = async () => {
    authCounter.add()
    promise.value = api.authentication
      .getAccessToken()
      .then((accessToken: string) => {
        if (accessToken && !skipTokenCheck && isTokenExpired(accessToken)) {
          api.authentication.removeAccessToken()
          throw new BadRequest('accessToken expired')
        }
      })
      .then(() => api.reAuthenticate())
      .then(handleAuthResult)
      .then(async (result: Record<string, any>) => {
        const _result = await onInitSuccess(result)
        return _result || result
      })
      .catch(onInitError)
      .finally(() => {
        authCounter.sub()
        isInitDone.value = true
      })
    return promise.value
  }

  // logout
  const logoutCounter = useCounter()
  const isLogoutPending = computed(() => !!logoutCounter.count.value)
  const logout = async () => {
    logoutCounter.add()
    return api
      .logout()
      .then((response: any) => {
        userId.value = null
        isAuthenticated.value = false
        return response
      })
      .then(onLogoutSuccess)
      .catch((error: any) => {
        error.value = error
        return onLogoutError(error)
      })
      .finally(() => logoutCounter.sub())
  }

  // login redirect
  const loginRedirect = ref<string | Record<string, any> | null>(null)

  return {
    user,
    error,
    isPending,
    isLogoutPending,
    isInitDone,
    isAuthenticated,
    loginRedirect,
    getPromise: () => promise.value,
    isTokenExpired,
    authenticate,
    reAuthenticate,
    logout,
    clearError,
  }
}