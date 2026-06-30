import http from 'node:http'
import {type IncomingHttpHeaders, type IncomingMessage} from 'node:http'
import https from 'node:https'

export interface TextResponse {
  headers: IncomingHttpHeaders
  statusCode: number
  statusMessage: string
  text: string
  url: string
}

export interface StreamResponse {
  headers: IncomingHttpHeaders
  statusCode: number
  statusMessage: string
  stream: IncomingMessage
  url: string
}

type Headers = Record<string, string>

function clientFor(url: URL): typeof http | typeof https {
  return url.protocol === 'http:' ? http : https
}

export function requestStream(url: string | URL, headers: Headers = {}, redirects = 5): Promise<StreamResponse> {
  const target = typeof url === 'string' ? new URL(url) : url

  return new Promise((resolve, reject) => {
    const request = clientFor(target).request(target, {headers}, (response) => {
      const statusCode = response.statusCode ?? 0
      const {location} = response.headers

      if ([301, 302, 303, 307, 308].includes(statusCode) && location && redirects > 0) {
        response.resume()
        resolve(requestStream(new URL(location, target), headers, redirects - 1))
        return
      }

      resolve({
        headers: response.headers,
        statusCode,
        statusMessage: response.statusMessage ?? '',
        stream: response,
        url: target.toString(),
      })
    })

    request.on('error', reject)
    request.end()
  })
}

export async function requestText(url: string | URL, headers: Headers = {}): Promise<TextResponse> {
  const response = await requestStream(url, headers)
  const chunks: Buffer[] = []

  for await (const chunk of response.stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return {
    headers: response.headers,
    statusCode: response.statusCode,
    statusMessage: response.statusMessage,
    text: Buffer.concat(chunks).toString('utf8'),
    url: response.url,
  }
}
