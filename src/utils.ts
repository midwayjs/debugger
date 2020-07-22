
import { writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, join } from 'path';

// 进程间传递数据
export const sendData = (pro, result) => {
  const id = result && result.id || getRandomId();
  const tmpData = join(tmpdir(), 'data' + id);
  writeFileSync(tmpData, JSON.stringify(result));
  pro.send({ type: 'bigData', id });
}

// 处理消息
export const onMessage = (pro, cb) => {
  pro.on('message', async msg => {
    if (msg.type === 'bigData') {
      msg = getData(msg.id);
    }
    cb(msg);
  });
}

// 进程间获取大数据
export const getData = (id) => {
  const tmpData = join(tmpdir(), 'data' + id);
  return JSON.parse(readFileSync(tmpData).toString());
}

// 获取随机Id
export const getRandomId = (key?: string) => {
  return Date.now() + Math.random() + (key || '');
}

export const getDebugPath = () => {
  if (require.extensions['.ts']) {
    return {
      path: resolve(__dirname, './debug.ts'),
      extensions: ['-r', 'ts-node/register']
    };
  }
  return { path: resolve(__dirname, './debug.js') };
}


export function getWssUrl(port, type?: string, count?: number) {
  return new Promise((resolve, reject) => {
    count = count || 0;
    if (count > 100) {
      return reject('timeout');
    }
    setTimeout(() => {
      const fetch = require('node-fetch');
      fetch('http://127.0.0.1:' + port + '/json/list')
        .then(res => res.json())
        .then(debugInfo => {
          const url = debugInfo[0][type || 'webSocketDebuggerUrl'] || '';
          resolve(
            url.replace('js_app.html?experiments=true&', 'inspector.html?')
          );
        })
        .catch(() => {
          getWssUrl(port, type, count + 1).then(resolve).catch(reject);
        });
    }, 100);
  });
}

function debugWs(addr) {
  return new Promise(resolve => {
    const WebSocket = require('ws');
    const ws = new WebSocket(addr);
    let currentId = 0;
    const cbMap = {};
    ws.on('open', () => {
      ws.on('message', message => {
        try {
          message = JSON.parse(message);
        } catch (e) {}
        if (message.params) {
          const id = message.params.scriptId;
          if (id) {
            if (id > currentId) {
              currentId = id - 0;
            }
            if (cbMap[id]) {
              cbMap[id](message.params);
            }
          }
        }
      });
      const send = (method, params?: any) => {
        return new Promise(resolve => {
          const curId = currentId + 1;
          currentId = curId;
          cbMap[curId] = data => {
            resolve(data);
          };
          const param: any = { id: curId, method };
          if (params) {
            param.params = params;
          }
          ws.send(JSON.stringify(param));
        });
      };
      send('Profiler.enable');
      send('Runtime.enable');
      send('Debugger.enable', { maxScriptsCacheSize: 10000000 });
      send('Debugger.setBlackboxPatterns', { patterns: ['internal'] });
      resolve(send);
    });
  });
}

export async function waitDebug(port) {
  const wssUrl = await getWssUrl(port);
  return debugWs(wssUrl);
}

export const getFun = (options) => {
  let fun = require(options.file);
  if (options.export) {
    fun = fun[options.export];
  }
  return (...args) => {
    return Promise.resolve(true).then(() => {
      return fun(...args);
    })
  }
}

export const getType = (data) => {
  return ({}).toString.call(data).slice(8,-1).toLowerCase();
}