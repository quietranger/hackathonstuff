var gulp = require('gulp');
var uglify = require('gulp-uglify');

gulp.task('buildProd', ['build'], function() {
    if (!process.env.LOGIN_URL) {
        throw new Error('Cannot cut production build without proper LOGIN_URL.');
    }

    gulp.src('dist/*.js').pipe(uglify()).pipe(gulp.dest('dist'));
});