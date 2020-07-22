import { fork, execSync} from 'child_process';
import { IOptions, IChild } from './interface';
import { getRandomId, sendData, onMessage, getDebugPath, getFun } from './utils';
export * from './utils';
let child: IChild;
export const debugWrapper = (options: IOptions) => {
  if (options.debug) {
    if (!child) {
      child = {
        isReady: false,
        invoke: (data) => {
          return new Promise((resolve, reject) => {
            const id = getRandomId();
            child.invokeMap[id] = { resolve, reject };
            sendData(child.process, { type: 'invoke', id, data });
          })
        },
        process: null,
        invokeMap: {}
      };
      const execArgv = [
        '--inspect=9229'
      ];
      const debugInfo = getDebugPath();
      if (debugInfo.extensions) {
        execArgv.push(...debugInfo.extensions);
      }
      child.process = fork(
        debugInfo.path,
        [
          JSON.stringify({
            export: options.export,
            file: options.file,
          }),
        ],
        {
          cwd: process.cwd(),
          env: process.env,
          execArgv 
        }
      );
      onMessage(child.process, async msg => {
        if (msg.type === 'ready') {
          child.isReady = true;
        } else if (msg.type === 'response') {
          const full = child.invokeMap[msg.id];
          delete child.invokeMap[msg.id];
          if (msg.success) {
            if (msg.function) {
              msg.function.forEach(functionInfo => {
                msg.result[functionInfo.name] = (...args) => {
                  return new Promise((resolve, reject) => {
                    const id = getRandomId();
                    child.invokeMap[id] = { resolve, reject };
                    sendData(child.process, {
                      type: 'invokeInnerFunc',
                      id,
                      data: {
                        funcId: functionInfo.id,
                        args
                      }
                    });
                  });
                }
              })
            }
            full.resolve(msg.result);
          } else {
            full.reject(msg.error);
          }
        } else if (msg.type === 'childExit') {
          clearDebug();
        }
      });
      process.on('SIGINT', clearDebug);
    }

    return (...args) => {
      return waitChildReady().then((child: any) => {
        return child.invoke(args);
      });
    }
  } else {
    return getFun(options);
  }
}

export const clearDebug = () => {
  if (child && child.process) {
    execSync('kill -9 ' + child.process.pid);
    child.process.kill();
    child = null;
  }
}

// 等待子进程ready，避免在同时调用多次的时候创建多个debug子进程
const waitChildReady = () => {
  return new Promise(resolve => {
    if (child && child.isReady) {
      resolve(child);
    } else {
      setTimeout(() => {
        waitChildReady().then(resolve);
      }, 100)
    }
  })
}
