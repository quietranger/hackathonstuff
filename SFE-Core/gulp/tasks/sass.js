var gulp = require('gulp');
var sass = require('gulp-ruby-sass');
var handleErrors = require('../util/handleErrors');
var source       = require('vinyl-source-stream');
var concat = require('gulp-concat');
var changed = require('gulp-changed');

gulp.task('sass', ['images'], function () {
  return gulp.src(['src/symphony/mixins/**/*.scss'])
    .pipe(changed('dist'))
    .pipe(sass({
      loadPath: './src/styles/import'
    }))
    .on('error', handleErrors)
    .pipe(concat('app.css'))
    .pipe(gulp.dest('dist'));
});
