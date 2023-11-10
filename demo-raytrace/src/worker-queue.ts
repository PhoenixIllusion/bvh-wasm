export class WorkerQueue<P,T, M> {
  workers: Worker[] = [];
  awaits: (Promise<T>|undefined)[] = [];
  queue: {payload: P, marker: M}[] = [];
  transferable: ((Transferable[])|null)[] = [];
  constructor(_class: new () => Worker, count: number, onInit: (worker: Worker)=> void) {
    for(let i=0;i<count;i++) {
      const worker: Worker = new _class();
      this.workers.push(worker);
      onInit(worker);
    }
  }
  enqueue(payload: P, marker: M, transfers: (Transferable[]|null) = null): void {
    this.queue.push({payload, marker})
    this.transferable.push(transfers);
  }
  onData?: (marker: M, response: T)=>void;
  async process() {
    while(this.queue.length > 0) {
      for(let i=0;i<this.workers.length;i++) {
        if(!this.awaits[i] && this.queue.length > 0) {
          const task = this.queue.shift()!;
          const transfer = this.transferable.shift() || [];
          this.awaits[i] = new Promise<T>(resolve => {
            this.workers[i].postMessage(task.payload, {transfer: transfer});
            this.workers[i].onmessage = (ev) => {
              Promise.resolve(this.onData && this.onData(task.marker, ev.data));
              this.awaits[i] = undefined;
              resolve(ev.data)
            }
          })
        }
      }
      await Promise.any(this.awaits);
    }
    await Promise.all(this.awaits);
  }
}