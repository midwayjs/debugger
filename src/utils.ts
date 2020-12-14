
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { tmpdir, platform } from 'os';
import { resolve, join } from 'path';
import { createServer } from 'net';
import { execSync } from 'child_process';
import { IOptions } from './interface'

// 进程间传递数据
export const sendData = (proc: NodeJS.Process, result: any): void => {
  const id = result && result.id || getRandomId();
  const tmpData = join(tmpdir(), 'data' + id);
  writeFileSync(tmpData, JSON.stringify(result));
  proc.send({ type: 'bigData', id, exitCode: result.exitCode });
}

// 处理消息
export const onMessage = (proc: NodeJS.Process, cb: (message: any) => any) => {
  proc.on('message', async msg => {
    if (msg && msg.type === 'bigData') {
      msg = getData(msg.id);
    }
    cb(msg);
  });
}

// 进程间获取大数据
export const getData = (id: number | string): any => {
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


export function getWssUrl(port, type?: string, count?: number): Promise<string> {
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
          const url: string = debugInfo[0][type || 'webSocketDebuggerUrl'] || '';
          const ret = url.replace('js_app.html?experiments=true&', 'inspector.html?');
          resolve(ret);
        })
        .catch(() => {
          getWssUrl(port, type, count + 1).then(resolve).catch(reject);
        });
    }, 100);
  });
}

function debugWs(addr: string) {
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
        return new Promise(resolve2 => {
          const curId = currentId + 1;
          currentId = curId;
          cbMap[curId] = data => {
            resolve2(data);
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

export const getFun = (options: IOptions) => {
  let fun: (...args: any[]) => unknown = require(options.file);
  if (options.export) {
    fun = fun[options.export];
  }
  return (...args: any[]) => {
    return Promise.resolve(true).then(() => {
      return fun(...args);
    })
  }
}

export const getType = (data: unknown): string => {
  return ({}).toString.call(data).slice(8,-1).toLowerCase();
}

export const checkPort = async (port): Promise<boolean> => {
  return new Promise(resolve => {
    const plat = platform();
    if (plat != 'win32') {
      try {
        const portUse = execSync(`lsof -i:${port}`).toString().replace(/\n$/, '').split('\n');
        if (portUse.length <= 1) {
          return resolve(false);
        }
        portUse.shift();
        const findUse = portUse.find(proc => {
          const procList = proc.split(/\s+/);
          const last = procList.pop();
          if (last === '(LISTEN)') {
            return true;
          }
        });
        if (findUse) {
          return resolve(true)
        }
      } catch {}
    }

    const server = createServer(socket => {
      socket.write('check port\r\n');
      socket.pipe(socket);
    });
    setTimeout(() => {
      server.listen(port, '127.0.0.1');
    }, 100);
    server.on('error', () => {
      resolve(true);
    });
    server.on('listening', () => {
      server.close();
      resolve(false);
    });
  });
}

export const vscodeSupport = (options) => {
  const isInVscode = process.env.TERM_PROGRAM === 'vscode';
  if (!isInVscode) {
    return;
  }

  let vscodeVersion = [];
  try {
    vscodeVersion = execSync('code -v').toString().split('\n')[0].split('.');
  } catch {}
  if (!vscodeVersion || !Array.isArray(vscodeVersion) || vscodeVersion.length < 3) {
    return;
  }
  const versionCount = vscodeVersion[0] * 100 + vscodeVersion[1];
  const cwd = options?.cwd || process.cwd();
  const vscodeSettingDir = join(cwd, '.vscode');
  if (!existsSync(vscodeSettingDir)) {
    mkdirSync(vscodeSettingDir);
  }
  let vscodeSettingFile = join(vscodeSettingDir, 'settings.json');
  let vscodeSettingJson = {};
  try {
    vscodeSettingJson = JSON.parse(readFileSync(vscodeSettingFile).toString());
  } catch {}
  // 自动打开 autoAttach
  vscodeSettingJson['debug.node.autoAttach'] = 'on';

   // version 1.49.0 + 需要设置 usePreviewAutoAttach
   if (versionCount >= 149) {
    vscodeSettingJson['debug.javascript.usePreviewAutoAttach'] = false;
  }

  writeFileSync(vscodeSettingFile, JSON.stringify(vscodeSettingJson, null, 2));
};