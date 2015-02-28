var CronJobs = function(sandbox) {
    var self = this;

    this.CronJob = require('cron').CronJob;
    this.sandbox = sandbox;
    this.jobs = {};

    this.sandbox.registerMethod('registerCronJob', this.registerJob.bind(this));
    this.sandbox.registerMethod('removeCronJob', this.removeJob.bind(this));
    this.sandbox.registerMethod('startCronJob', this.startJob.bind(this));
    this.sandbox.registerMethod('stopCronJob', this.stopJob.bind(this));

    /**
     * Keep track of when the app was last active. W/ this info cronjobs know if they should immediately fire onTick on app start
     */
    this.registerJob({
        'cronName': '_cronKeeper',
        'cronOpts': {
            cronTime: '* * * * *',
            onTick: function(){
                self.sandbox.setData('documents.cronKeeper', new Date().getTime());
                console.log('cron tick');
            },
            start: true
        }
    });
};


/**
 * Register a job, you have to supply a job name.
 *
 * @param  {object} opts  Needs two params, cronName: "string job name", and cronOpts: {...cron job opts...}
 * @return {void}
 */
CronJobs.prototype.registerJob = function(opts){
    if(!opts.cronName || !opts.cronOpts) {
        throw new Error ('Must supply a job name and job options.')
    }

    if(this.jobs.hasOwnProperty(opts.cronName)) {
        return;
    }
    this.jobs[opts.cronName] = new this.CronJob(opts.cronOpts);
};

/**
 * Remove a job from registry, the cron job will stop tracking, if the job is running it will be stopped.
 *
 * @param  {object} opts Needs one param, cronName: "string name" or cronName: ["array of string names", ""]
 * @return {void}
 */
CronJobs.prototype.removeJob = function(opts) {
    if(!opts.cronName) {
        throw new Error ('Must supply a string or array of string names to remove.')
    }

    if(typeof opts.cronName === "string" && this.jobs.hasOwnProperty(opts.cronName)) {
       this.stopJob({'cronName':'opts.cronName'});
       delete this.jobs[opts.cronName]
    }

    if(Object.prototype.toString.call(opts.cronName) === '[object Array]') {
        for(var i = 0, len = opts.cronName.length; i < len; i++) {
            this.stopJob(opts.cronName[i]);
            delete this.jobs[opts.cronName[i]];
        }
    }
};

/**
 * Start a job.
 *
 * @param  {object} opts Needs one param, cronName: "string name" or cronName: ["array of string names", ""]
 * @return {void}
 */
CronJobs.prototype.startJob = function(opts) {
    if(!opts.cronName) {
        throw new Error ('Must supply a string or array of string names to start.')
    }

    if(typeof opts.cronName === "string" && this.jobs.hasOwnProperty(opts.cronName)) {
        this.jobs[opts.cronName].start()
    }

    if(Object.prototype.toString.call(opts.cronName) === '[object Array]') {
        for(var i = 0, len = opts.cronName.length; i < len; i++) {
            if(this.jobs.hasOwnProperty(opts.cronName[i])) {
                this.jobs[opts.cronName[i]].start();
            }
        }
    }
};

/**
 * Stop a job.
 *
 * @param  {object} opts Needs one param, cronName: "string name" or cronName: ["array of string names", ""]
 * @return {void}
 */
CronJobs.prototype.stopJob = function(opts) {
    if(!opts.cronName) {
        throw new Error ('Must supply a string or array of string names to stop.')
    }

    if(typeof opts.cronName === "string" && this.jobs.hasOwnProperty(opts.cronName)) {
        this.jobs[opts.cronName].stop()
    }

    if(Object.prototype.toString.call(opts.cronName) === '[object Array]') {
        for(var i = 0, len = opts.cronName.length; i < len; i++) {
            if(this.jobs.hasOwnProperty(opts.cronName[i])) {
                this.jobs[opts.cronName[i]].stop();
            }
        }
    }
};

module.exports = CronJobs;