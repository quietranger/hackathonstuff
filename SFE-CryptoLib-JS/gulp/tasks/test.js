var gulp = require('gulp');
var karma = require('gulp-karma');
var handleErrors = require('../util/handleErrors');

gulp.task('test', ['buildTest'], function() {
  return gulp.src(['node_modules/es5-shim/es5-shim.js', 'dist/appTest.js', 'dist/app.css'])
    .pipe(karma({
      configFile: 'karma.conf.js'
    }))
    .on('error', handleErrors);
});
