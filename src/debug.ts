import { waitDebug, sendData, onMessage, getFun } from './utils';
const config = JSON.parse(process.argv[2]);
const fun = getFun(config);
process.on('exit', () => {
  sendData(process, { type: 'childExit' });
});
(async () => {
  await waitDebug(9229);
  onMessage(process, async msg => {
    if (msg.type === 'invoke') {
      const args = msg.data;
      try {
        const result = await fun(...args);
        sendData(process, { type: 'response', success: true, id: msg.id, result });
      } catch(e) {
        sendData(process, { type: 'response', id: msg.id, error: e.message });
      }
    }
  });
  sendData(process, { type: 'ready' });
})();