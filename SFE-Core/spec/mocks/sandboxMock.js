module.exports = jasmine.createSpyObj('sandbox', [ 'subscribe', 'unsubscribe', 'publish', 'getData', 'setData',
    'isRunningInClientApp', 'send', 'getPresenceForId', 'registerMethod' ]);
