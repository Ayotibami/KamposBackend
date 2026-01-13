import { EventEmitter } from 'events';
class SimplePubSub {
    ee = new EventEmitter();
    publish(topic, payload) {
        this.ee.emit(topic, payload);
    }
    asyncIterator(topic) {
        const ee = this.ee;
        return {
            async *[Symbol.asyncIterator]() {
                const queue = [];
                const push = (data) => queue.push(data);
                ee.on(topic, push);
                try {
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        if (queue.length === 0) {
                            await new Promise((resolve) => ee.once(topic, (data) => {
                                queue.push(data);
                                resolve();
                            }));
                        }
                        yield queue.shift();
                    }
                }
                finally {
                    ee.off(topic, push);
                }
            },
        };
    }
}
export const PubSub = new SimplePubSub();
