"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PubSub = void 0;
const events_1 = require("events");
class SimplePubSub {
    ee = new events_1.EventEmitter();
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
exports.PubSub = new SimplePubSub();
