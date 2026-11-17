import { once } from 'node:events'
import { createServer } from 'node:net'
import { createInterface } from 'node:readline'

export async function startTestInbox() {
  const messages: string[] = []
  const server = createServer((socket) => {
    const lines = createInterface({ input: socket, crlfDelay: Infinity })
    let data: string[] | undefined
    socket.write('220 localhost DevFlow test inbox\r\n')
    lines.on('line', (line) => {
      if (data) {
        if (line === '.') {
          messages.push(data.join('\r\n'))
          data = undefined
          socket.write('250 OK\r\n')
        } else {
          data.push(line)
        }
      } else if (line === 'DATA') {
        data = []
        socket.write('354 End data with a single dot\r\n')
      } else if (line === 'QUIT') {
        socket.end('221 Bye\r\n')
      } else {
        socket.write('250 OK\r\n')
      }
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not start the test inbox.')
  return { port: address.port, messages, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}
