var gulp = require('gulp');
var karma = require('gulp-karma');
var handleErrors = require('../util/handleErrors');

gulp.task('bench', ['buildBench'], function() {
  return gulp.src(['node_modules/es5-shim/es5-shim.js', 'dist/appBench.js'])
    .pipe(karma({
      configFile: 'karma.conf.js',
      browsers: ['Chrome'],
      reporters: ['benchmark'],
      frameworks: ['benchmark']
    }))
    .on('error', handleErrors);
});
