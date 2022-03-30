// Copyright _!_
//
// License _!_

const { promisify } = require('util')

const dayjs = require('dayjs')
const _ = require('lodash')
const { Pool, types } = require('pg')
// USE THIS LIBRARY TO WRITE SQL QUERIES.
// IT PREVENTS SQL INJECTION BY PARAMETERIZING QUERIES.
const sql = require('sql-template-strings')
const Cursor = require('pg-cursor')

//const { errors } = require('@common/error-reporting')
const Batcher = require('./batcher')

const LOG_TABLE = 'cdn_logs'
const cl = console.log

Cursor.prototype.readAsync = promisify(Cursor.prototype.read)

// NOTE: These type parsers will fail if the database starts returning
// numbers larger than 64 bit numbers.
types.setTypeParser(20, val => Number(val)) // pg bigint -> JS Number
types.setTypeParser(1700, val => Number(val)) // pg numeric -> JS Number
types.setTypeParser(1114, str => dayjs.utc(str).toDate()) // pg date -> JS Date

let pool

/*
2021-01-08: Refreshing materialized views used more than 5 GB of disk and
took 15+ minutes, so this flag was set as a fix:
- work_mem         20 MB
*/
function init (opts = {}) {
    // Undocumented way to set runtime parameters for a Pool
    // https://github.com/brianc/node-postgres/issues/983#issuecomment-736075608
    //
    // https://www.postgresql.org/docs/12/wal-async-commit.html
    // TL;DR Significantly improves throughput for small transactions
    // at the cost of recent data loss if DB crashes.
    let pgOptions = ''
    if (opts.asyncCommit) {
        pgOptions = '-c synchronous_commit=off'
    }

    pool = new Pool({
        options: pgOptions,
        application_name: opts.appName,
        ...opts,
    })
    pool.on('error', err => {
        cl('Postgres err', err)
        //errors.report(err)
    })
    pool.once('connect', () => {
        cl('Connected to Postgres')
    })

    return pool
}

async function close () {
    await pool.end()
}

function getPool () {
    return pool
}

// Tracks how much bandwidth has been reported from valid transfers.
// The "created_at" column refers to the first report timestamp of
// a (transfer_id, node_id) pair.
async function setTransferInfo (logs) {
    const query = sql`
        INSERT INTO p2p_transfers_validated (
            transfer_id, node_id, status, created_at, updated_at,
            num_bytes_uploaded, num_bytes_downloaded, num_bytes_upload_reported
        )
        VALUES
    `

    for (let i = 0, len = logs.length; i < len; i++) {
        const l = logs[i]
        const delimiter = i === len - 1 ? ' ' : ','

        const values = sql`(
            ${l.transferId}, ${l.nodeId}, ${l.status}, ${l.createdAt},
            ${l.updatedAt ?? new Date()}, ${l.numBytesUploaded},
            ${l.numBytesDownloaded}, ${l.numBytesUploadReported}
        )`

        query.append(values).append(delimiter)
    }

    query.append(sql`
        ON CONFLICT ON CONSTRAINT p2p_transfers_validated_pkey
        DO UPDATE SET
        (
            status,
            updated_at,
            num_bytes_uploaded,
            num_bytes_downloaded,
            num_bytes_upload_reported
        ) = (
            EXCLUDED.status,
            EXCLUDED.updated_at,
            EXCLUDED.num_bytes_uploaded,
            EXCLUDED.num_bytes_downloaded,
            EXCLUDED.num_bytes_upload_reported
        )
    `)

    await pool.query(query)
}

class LogBatcher extends Batcher {
    constructor (opts = {}) {
        opts.batchSize = 1
        super(opts)
    }

    async commit (nodes) {
        return updateNodeInfo(nodes)
    }
}

module.exports = {
    init,
    close,
    getPool,
    LogBatcher,
}
