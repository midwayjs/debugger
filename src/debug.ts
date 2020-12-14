import { waitDebug, sendData, onMessage, getFun, getType, getRandomId } from './utils';
const config = JSON.parse(process.argv[2]);
const fun = getFun(config);
process.on('exit', () => {
  sendData(process, { type: 'childExit', exitCode: process.exitCode });
});
const funcMap = {};
(async () => {
  if (config.debug) {
    await waitDebug(config.port || 9229);
  }
  onMessage(process, async msg => {
    let funcArgs = [];
    let func: any = () => {};
    if (msg.type === 'invoke') {
      funcArgs = msg.data;
      func = fun;
    } else if (msg.type === 'invokeInnerFunc') {
      const { funcId, args } = msg.data;
      funcArgs = args;
      func = funcMap[funcId];
    }
    try {
      const result = await func(...funcArgs);
      const functions = [];
      if (getType(result) === 'object') {
        Object.keys(result).map(key => {
          const item = result[key];
          if (getType(item) === 'function' || getType(item) === 'asyncfunction') {
            const funcId = getRandomId('func' + key);
            functions.push({
              name: key,
              id: funcId
            });
            funcMap[funcId] = async (...args) => {
              return item(...args);
            };
            result[key] = 'this is function';
          }
        });
      }
      sendData(process, { type: 'response', success: true, id: msg.id, result, function: functions });
    } catch(e) {
      sendData(process, { type: 'response', id: msg.id, error: e.message });
    }
  });
  sendData(process, { type: 'ready' });
})();

