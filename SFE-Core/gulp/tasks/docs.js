var exec = require('child_process').exec;
var gulp = require('gulp');

gulp.task('docs', function(cb) {
    exec('jsdoc -r -d ./doc ./src', function(err) {
        if (err) {
            return cb(err);
        }
    });
});