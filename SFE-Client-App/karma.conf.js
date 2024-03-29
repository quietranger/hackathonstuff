// Karma configuration
// Generated on Wed Apr 02 2014 17:06:08 GMT-0400 (Eastern Daylight Time)

module.exports = function(config) {
    config.set({

        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '.',

        urlRoot: '/base/dist',


        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['jasmine'],




        // list of files / patterns to load in the browser
        files: ['node_modules/es5-shim/es5-shim.js', 'spec/external/*.js', 'dist/js/appTest.js', 'dist/css/dark-theme.css',
            { pattern: 'dist/js/external/**/*.js', served: true, included: true } ],


        // list of files to exclude
        exclude: [

        ],

        browserNoActivityTimeout: 60000,


        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {

        },


        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: ['progress', 'junit'],

        junitReporter: {
          outputFile: 'test-results.xml'
        },

        // web server port
        port: 9876,


        // enable / disable colors in the output (reporters and logs)
        colors: true,


        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: config.LOG_ERROR,


        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: false,


        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: ['PhantomJS'],


        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: true
    });
};
