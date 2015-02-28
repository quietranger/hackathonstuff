/* Notes:
   - gulp/tasks/browserify.js handles js recompiling with watchify
   - gulp/tasks/browserSync.js watches and reloads compiled files
*/

var gulp = require('gulp');

gulp.task('watch', ['setWatch', 'browserSync'], function() {
  gulp.watch('src/javascript/**', ['sass']);
  gulp.watch('src/styles/**', ['sass']);
  gulp.watch('src/images/**', ['images']);
  gulp.watch('src/html/**', ['markup']);
});
