
var transport = require('./transport');
var logger = require('./logger');

var sandbox = null;
var clientInfo = null;
var logQueue = [];
var LOG_PERIOD = 300000; // 5 minutes

var transmitData = function (transport) {
    if (logQueue.length !== 0) {
        var opts = {
            id: "LOG_USAGE",
            payload: {
                app: clientInfo.version,
                host: clientInfo.ip,
                appversion: "1.0", // TODO put the version from the client
                events: JSON.stringify(logQueue)
            }
        };

        var cloneOfLogQueue = logQueue.slice(0);
        transport.send(opts).then(function (rsp) {
            // success
            try {
                // wipe the localstorage cache
                localStorage.removeItem("usagelogging");
            } catch (err) {
            } // ignore
        }, function (rsp) {
            // failure

            // merge the items back in the queue
            logQueue = logQueue.concat(cloneOfLogQueue);
            try { // wrapped in try-catch in case browser has issue with localstorage
                /*
                 every time we add something to the queue
                 we need to update the localstorage cache
                 */
                localStorage.setItem("usagelogging", JSON.stringify(logQueue));
            } catch (err) {
            } //ignore for now
        });
        // Clears
        logQueue = [];
    }
};

var startLogging = function(appBridge, sandbox, transport) {
    clientInfo = appBridge.getClientInfo();
    sandbox.subscribe("usage-event", function (context, opts) {
        var logMe = {
            action : opts.action || 'unknown',
            data : {
                date: new Date().getTime()
            }
        };
        // copy all the optional details from the opts to the data
        _.extend(logMe.data,opts.details);
        logQueue.push(logMe);
        try { // wrapped in try-catch in case browser has issue with localstorage
            /*
             every time we add something to the queue
             we need to update the localstorage cache
             */
            localStorage.setItem("usagelogging", JSON.stringify(logQueue.slice(0, 100)));
        } catch (err) {
        } //ignore for now
        if (opts.immediate) {
            transmitData(transport);
        }
    });

    setInterval(function () {
        transmitData(transport);
    }, LOG_PERIOD);

    // immediately log anything that is still available in localStorage
    try {
        var localStorageJSONString = localStorage.getItem("usagelogging");
        if (localStorageJSONString && localStorageJSONString != "") {
            logQueue = logQueue.concat(JSON.parse(localStorageJSONString)).slice(0, 25); // only keep up to 25
        }
    } catch (err) {
    } //ignore for now
};

module.exports = startLogging;
