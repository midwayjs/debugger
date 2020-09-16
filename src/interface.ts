export interface IOptions {
  file: string;
  debug?: boolean;
  export?: string;
  exit?: boolean;
  port?: string;
  ts?: boolean;
  child?: boolean;
}

export interface IChild {
  isReady: boolean;
  invoke: any;
  process: any;
  invokeMap: {
    [id: string]: {
      resolve: any;
      reject: any;
    }
  }
}