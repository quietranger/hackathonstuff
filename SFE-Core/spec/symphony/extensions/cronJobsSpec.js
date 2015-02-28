var Q = require('q');

var CronJobs = require('../../../src/symphony/extensions/cronJobs');

var sandbox = require('../../mocks/sandboxMock');

xdescribe('The cron job extension', function(){
    var cronJobs;

    beforeEach(function(){
        cronJobs = new CronJobs({ sandbox: sandbox });
    });

    describe('when instantiated', function(){
        it("should throw an error if instantiated without a sandbox instance", function() {
            expect(function() {
                /*jshint nonew: false*/
                new CronJobs();
            }).toThrow();
        });

        it("should create a cron job object", function(){
            expect(cronJobs.jobs).not.toBeUndefined();
        });
    });
});
