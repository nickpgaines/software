// The standalone audience CLI requires Node 22.13+; the web application keeps
// its existing Node type version. Describe only the built-in API the CLI uses.
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path:string, options?:{readOnly?:boolean});
    exec(sql:string):void;
    prepare(sql:string):{all(...params:Array<string|number|null>):Record<string,unknown>[]};
    close():void;
  }
}
