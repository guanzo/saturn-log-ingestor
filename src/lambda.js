const postgres = require('./postgres')

const cl = console.log

const pool = postgres.init({
    appName: 'log-lambda',
    asyncCommit: true,
    max: 20
})

// Instantiate pg-client here, explicitly connect, enable keep-alive
// https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/node-reusing-connections.html
// Check if node-pg supports keep alive, else do it in node

exports.handler = async function (event, context) {
    cl(event, context)
    // TODO: Figure out what data is sent.
}
