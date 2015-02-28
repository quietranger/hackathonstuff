var gulp = require('gulp');

gulp.task('markup', function() {
  return gulp.src('src/html/**')
    .pipe(gulp.dest('dist'));
});
