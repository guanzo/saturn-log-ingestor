const IS_PROD = process.env.NODE_ENV === 'production'
const BATCH_SIZE = IS_PROD ? 500 : 1

class Batcher {
    // Emulate abstract classes
    // https://stackoverflow.com/a/30560792/2498782
    constructor (opts = {}) {
        if (new.target === Batcher) {
            const msg = `Cannot construct ${new.target.name} instances directly`
            throw new TypeError(msg)
        }

        if (typeof this.commit !== 'function') {
            throw new TypeError('Must implement commit() method')
        }

        this.batch = []
        this.batchSize = opts.batchSize ?? BATCH_SIZE
        this.flushTimeout = opts.flushTimeout ?? 5_000
        this.timeoutId = null
        this.autoCommit = opts.autoCommit ?? true
    }

    async add (item) {
        clearTimeout(this.flushTimeoutId)

        this.batch.push(item)

        if (!this.autoCommit) {
            return
        }

        if (this.batch.length >= this.batchSize) {
            return this.flush()
        }

        this.flushTimeoutId = setTimeout(() => {
            this.flush().catch(console.log)
        }, this.flushTimeout)
    }

    async addAll (items) {
        const promises = items.map(item => this.add(item))
        return Promise.all(promises)
    }

    async flush () {
        clearTimeout(this.flushTimeoutId)
        if (this.batch.length > 0) {
            const items = this.batch.splice(0)
            return this.commit(items)
        }
    }
}

module.exports = Batcher
