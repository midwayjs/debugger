export interface IOptions {
  file: string;
  debug?: boolean;
  export?: string;
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