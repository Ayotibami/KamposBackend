import { EventEmitter } from 'events';

type Listener = (payload: any) => void;

class SimplePubSub {
  private ee = new EventEmitter();

  publish(topic: string, payload: any) {
    this.ee.emit(topic, payload);
  }

  asyncIterator<T = any>(topic: string) {
    const ee = this.ee;
    return {
      async *[Symbol.asyncIterator](): AsyncIterator<T> {
        const queue: any[] = [];
        const push = (data: any) => queue.push(data);
        ee.on(topic, push as Listener);
        try {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            if (queue.length === 0) {
              await new Promise<void>((resolve) => ee.once(topic, (data) => {
                queue.push(data);
                resolve();
              }));
            }
            yield queue.shift();
          }
        } finally {
          ee.off(topic, push as Listener);
        }
      },
    } as AsyncIterable<T>;
  }
}

export const PubSub = new SimplePubSub();
