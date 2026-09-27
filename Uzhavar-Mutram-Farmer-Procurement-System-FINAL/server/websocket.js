/**
 * Uzhavar Mutram - Real-time WebSocket Module
 * Broadcasts real-time logistics status, queue updates, and stockyard changes to connected clients.
 */

const crypto = require('crypto');

const clients = new Set();

/**
 * Encode text payload as a WebSocket frame (unmasked server-to-client frame)
 */
function encodeWebSocketFrame(payloadText) {
  const payloadBuffer = Buffer.from(payloadText, 'utf8');
  const length = payloadBuffer.length;
  let header;

  if (length <= 125) {
    header = Buffer.from([0x81, length]);
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payloadBuffer]);
}

/**
 * Initialize WebSocket Upgrade listener on Express/HTTP Server
 * @param {import('http').Server} server 
 */
function initWebSocket(server) {
  server.on('upgrade', (req, socket, head) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    // Compute WebSocket Accept Handshake Key
    const acceptKey = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '\r\n'
    ].join('\r\n');

    socket.write(responseHeaders);
    clients.add(socket);

    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
  });

  console.log('📡 Real-Time WebSocket Server attached to HTTP server on /ws');
}

/**
 * Broadcast event message to all connected clients
 * @param {string} type - Event type (e.g. 'LOGISTICS_UPDATE', 'QUEUE_UPDATE', 'STOCKYARD_UPDATE')
 * @param {object} data - Payload data
 */
function broadcast(type, data) {
  if (clients.size === 0) return;
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  const frame = encodeWebSocketFrame(message);

  for (const client of clients) {
    if (client.writable) {
      try {
        client.write(frame);
      } catch (err) {
        clients.delete(client);
      }
    } else {
      clients.delete(client);
    }
  }
}

module.exports = {
  initWebSocket,
  broadcast
};
