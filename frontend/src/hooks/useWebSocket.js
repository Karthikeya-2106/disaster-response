import { useEffect, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

/**
 * Subscribe to STOMP topics over SockJS.
 * @param {string[]} topics  e.g. ['/topic/incidents', '/topic/alerts']
 * @param {(msg: {type, payload}, topic: string) => void} onMessage
 */
export function useWebSocket(topics, onMessage) {
  const clientRef = useRef(null)
  const handlerRef = useRef(onMessage)

  // keep handler ref fresh without re-creating the socket
  useEffect(() => { handlerRef.current = onMessage }, [onMessage])

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) return

    const client = new Client({
      // pass token as query param so backend's JwtAuthFilter accepts it during handshake
      webSocketFactory: () => new SockJS(`/ws?token=${token}`),
      reconnectDelay: 5000,
      onConnect: () => {
        topics.forEach((topic) => {
          client.subscribe(topic, (frame) => {
            try {
              const msg = JSON.parse(frame.body)
              handlerRef.current?.(msg, topic)
            } catch (e) {
              console.error('STOMP parse error', e)
            }
          })
        })
      },
      onStompError: (frame) => console.error('STOMP error', frame),
    })
    client.activate()
    clientRef.current = client

    return () => { try { client.deactivate() } catch {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics.join(',')])
}
