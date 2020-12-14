import { fork, execSync } from 'child_process';
import { IOptions, IChild } from './interface';
import { getRandomId, sendData, onMessage, getDebugPath, getFun, checkPort, vscodeSupport } from './utils';
export * from './utils';

let child: IChild;
export const debugWrapper = (options: IOptions) => {
  if (options.debug || options.ts || options.child) {
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
      ;(async () => {
        const port = options.port || '9229';

        const execArgv = [];
        if (options.debug) {
          const portIsUse: boolean = await checkPort(port);
          if (portIsUse) {
            console.log('\n\n');
            console.log(`Debug port ${port} is in use`);
            console.log('\n\n');
          }
          vscodeSupport(options);
          execArgv.push(`--inspect=${port}`);
        }
        if (options.ts) {
          execArgv.push('-r', 'ts-node/register');
        }
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
              port,
              debug: options.debug
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
            clearDebug(msg.exitCode);
          }
        });
        process.on('SIGINT', () => {
          clearDebug(process.exitCode);
        });
      })();
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

export const clearDebug = (exitCode?: number | undefined): void => {
  if (child && child.process && child.process.pid > 0) {
    const pid = child.process.pid;

    try {
      child.process.kill(0);
      child.process.kill();

      try {
        child.process.kill(0);
        execSync('kill -9 ' + pid);
      }
      catch (ex) {
        void 0;
      }
    }
    catch (ex) {
      void 0;
    }

    child = null;
  }

  // 若子进程异常退出则本进程相同异常退出，以确保外层调用（jest，mocha等）能正确感知执行结果
  if (exitCode > 0) {
    process.exit(exitCode)
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
      }, 50);
    }
  })
}
