var gulp = require('gulp');

gulp.task('build', ['browserify', 'sass', 'images', 'markup'], function() {
  if (!global.isWatching) {
    process.exit(0);
  }
});
