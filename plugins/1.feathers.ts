import { createClient } from 'feathers-pinia-api'

// rest imports for the server
import { $fetch } from 'ofetch'
import rest from '@feathersjs/rest-client'
import { OFetch } from 'feathers-pinia'

// socket.io imports for the browser
import socketio from '@feathersjs/socketio-client'
import io from 'socket.io-client'

/**
 * Creates a Feathers Rest client for the SSR server and a Socket.io client for the browser.
 * Also provides a cookie-storage adapter for JWT SSR using Nuxt APIs.
 */
export default defineNuxtPlugin(async (_nuxtApp) => {
  const host = import.meta.env.VITE_MYAPP_API_URL as string || 'http://localhost:3030'

  // Store JWT in a cookie for SSR.
  const storageKey = 'feathers-jwt'
  const jwt = useCookie<string | null>(storageKey)
  const storage = {
    getItem: () => jwt.value,
    setItem: (val: string) => jwt.value = val,
    removeItem: () => jwt.value = null,
  }

  // Use Rest for the SSR Server and socket.io for the browser
  const connection = process.server
    ? rest(host).fetch($fetch, OFetch)
    : socketio(io(host, { transports: ['websocket'] }))

  // create the api client
  const api = createClient(connection, { storage, storageKey })

  // a place to store Model functions for each request
  const models: Record<string, any> = {}

  return {
    provide: { api, models },
  }
})
