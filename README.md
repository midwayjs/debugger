# debugger

通用的 debug 包裹，让一个方法有了单步调试的能力，可以用在 cli 等情况下支持 `--debug` 参数启动单步调试。

### Usage
```sh
npm i @midwayjs/debugger --save
```

```ts
// function.ts
import { debugWrapper } from '@midwayjs/debugger';
export const fun = async (arg1, arg2) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return arg1 + arg2;
}

export const wrapFun = debugWrapper({
  file: __filename,           // 要包裹的方法所在文件
  export: 'fun',              // 要包裹的方法的方法名
  debug: process.env.DEBUG    // 是否开启debug，true即开启
});
```

## License

[MIT](http://github.com/midwayjs/debugger/blob/master/LICENSE)
