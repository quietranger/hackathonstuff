var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var handleErrors = require('../util/handleErrors');
var bundleLogger = require('../util/bundleLogger');

gulp.task('buildTest', function() {
  var bundler = browserify({
    entries: ['./spec/specRunner.js'],
    extensions: ['.js'],
    debug: true
  });

  var bundle = function() {
    bundleLogger.start();

    return bundler.bundle()
      .on('error', handleErrors)
      .pipe(source('appTest.js'))
      .pipe(gulp.dest('./dist/'))
      .on('end', bundleLogger.end);
  };

  return bundle();
});
