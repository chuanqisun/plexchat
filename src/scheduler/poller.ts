import type { IPoller } from "./worker";

export class Poller implements IPoller {
  private isRunning = false;
  private clearHandle: any;
  private eventHandler: any;

  constructor(private interval: number) {}

  public set(eventHandler: any) {
    this.unset();
    this.eventHandler = eventHandler;
    this.isRunning = true;
    this.tick();
  }

  private tick() {
    this.clearHandle = setTimeout(() => {
      if (this.isRunning) {
        this.eventHandler();
        this.tick();
      }
    }, this.interval);
  }

  public unset() {
    this.isRunning = false;
    clearTimeout(this.clearHandle);
  }
}
