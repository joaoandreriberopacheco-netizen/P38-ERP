import net from 'net';

export function sendToPrinter(host, port, data) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write(data, (err) => {
        if (err) {
          socket.destroy();
          reject(err);
          return;
        }
        socket.end();
      });
    });

    socket.setTimeout(8000, () => {
      socket.destroy();
      reject(new Error(`Timeout ao conectar em ${host}:${port}`));
    });

    socket.on('error', reject);
    socket.on('close', () => resolve({ bytes: data.length }));
  });
}
