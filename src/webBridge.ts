import {
  Socket as ServerSocket,
  ServerOptions,
  Server as SocketIOServer,
} from "socket.io";
import { Data } from "./port.js";
import { JsonTunnel } from "./JsonTunnel.js";
import { Socket as ClientSocket, io } from "socket.io-client";
import { ForwardPort } from "./forwardPort.js";
import { JsonString } from "./serializableType.js";

type EventsMap<Params extends Data[]> = {
  params: (
    jsonStr: JsonString<Params>,
    callback: (ret: boolean) => void
  ) => void;
};

export class WebBridgeBaseClass<
  ParamsSend extends Data[],
  ParamsRecv extends Data[],
  Socket extends {
    on(
      ev: "params",
      listener: (
        jsonStr: JsonString<ParamsRecv>,
        callback: (ret: boolean) => void
      ) => void
    ): void;
    emit(
      ev: "params",
      jsonStr: JsonString<ParamsSend>,
      callback: (ret: boolean) => void
    ): void;
  }
> {
  constructor() {
    this.jsonTunnel.connectB(this.portToJsonTunnel);
  }

  protected socket: Socket | null = null;

  protected registerEvents(): void {
    if (!this.socket) throw new Error("socket is null");
    this.socket.on("params", (jsonStr: JsonString<ParamsRecv>, callback) => {
      (async () => {
        callback(await this.portToJsonTunnel.send(jsonStr));
      })();
    });
  }

  protected jsonTunnel = new JsonTunnel<ParamsSend, ParamsRecv>();
  public get port() {
    return this.jsonTunnel.portA;
  }

  protected portToJsonTunnel = new ForwardPort<
    [jsonStr: JsonString<ParamsSend>],
    [jsonStr: JsonString<ParamsRecv>]
  >(this.recvJson.bind(this));

  protected async recvJson(jsonStr: JsonString<ParamsSend>): Promise<boolean> {
    const promise = new Promise<boolean>((resolve, reject) => {
      if (!this.socket) throw new Error("socket is null: " + this.socket);
      this.socket.emit("params", jsonStr, resolve);
    });
    return promise;
  }
}

export class WebBridgeServer<
  ParamsSend extends Data[],
  ParamsRecv extends Data[]
> extends WebBridgeBaseClass<
  ParamsSend,
  ParamsRecv,
  ServerSocket<EventsMap<ParamsRecv>, EventsMap<ParamsSend>>
> {
  constructor(port: number, opts?: Partial<ServerOptions>) {
    super();
    this.server = new SocketIOServer<
      EventsMap<ParamsSend>,
      EventsMap<ParamsRecv>
    >(port, opts);
    this.server.on("connection", (socket) => {
      this.socket = socket;
      this.registerEvents();
    });
  }
  protected readonly server;
}

export class WebBridgeClient<
  ParamsSend extends Data[],
  ParamsRecv extends Data[]
> extends WebBridgeBaseClass<
  ParamsSend,
  ParamsRecv,
  ClientSocket<EventsMap<ParamsRecv>, EventsMap<ParamsSend>>
> {
  constructor(url: string) {
    super();
    this.socket = io(url);
    this.registerEvents();
  }
}
