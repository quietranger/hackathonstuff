var gulp = require('gulp');
var clean = require('gulp-clean');
var concat = require('gulp-concat');
var sass = require('gulp-sass');
var gutil = require('gulp-util');
var jasmine = require('gulp-jasmine');
var uglify = require('gulp-uglify');
var jshint = require('gulp-jshint');
var plumber = require('gulp-plumber');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var watchify  = require('watchify');
var karma = require('karma').server;
var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');
var es = require('event-stream');
var base64 = require('gulp-base64');
var _ = require('underscore');
var autoprefixer = require('gulp-autoprefixer');
var browserSync = require('browser-sync');

var vendorLibs = [
    'jquery',
    'underscore',
    'backbone',
    'tooltip',
    'tether',
    'drop',
    'shepherd',
    'mousetrap',
    'backbone-mousetrap',
    'spectrum',
    'groupablelist',
    'jquery-ui',
    'maxlength',
    'caret',
    'atwho',
    'raphael',
    'morris',
    'pubsubjs',
    'moment',
    'q',
    'emoji-images',
    'typeahead.js',
    'pikaday',
    'hbsfy/runtime'
];

var browserifyOpts = {
    entries: ['./src/js/app.js'],
    cache: {}, packageCache: {}, fullPaths: true,
    extensions: ['.js', '.hbs', '.handlebars'],
    debug: true
};

var onError = function (err) {
    console.log(err);
    this.emit('end');
};

var paths = {
    srcScripts: ['src/js/**/*.js', 'src/js/**/*.handlebars'],
    srcStyles: [
        'src/js/libs/**/*.scss', 'src/styles/vendor/*.css',
        'src/js/lib/symphony/views/chime/**/*.scss',
        'src/js/libs/**/*.scss',
        'src/styles/vendor/*.css',
        'src/styles/vendor/*.scss',
        'src/styles/**/*.scss',
        'src/js/modules/**/*.scss',
        'src/js/views/**/*.scss',
        'node_modules/symphony-core/**/*.scss'
    ],
    externalScripts: [ 'src/js/vendor/external/**/*.js' ],
    srcImages: ['src/images/**/*'],
    srcHtml: ['src/html/**/*.html', 'src/html/**/*.json'],
    clean: ['dist/css/**/*', 'dist/js/**/*']
};

global.isWatching = false;

gulp.task('build-external', function() {
    return gulp.src(paths.externalScripts).pipe(gulp.dest('dist/js/external'));
});

gulp.task('build-test', ['build-external'], function() {
    var browserifyTestOpts = _.clone(browserifyOpts);

    browserifyTestOpts.entries = ['./spec/specRunner.js'];

    var bundler = browserify(browserifyTestOpts).exclude('time');

    return bundler.bundle({debug:true})
        .pipe(source('appTest.js'))
        .pipe(gulp.dest('./dist/js'));
});

gulp.task('test', [ 'sass', 'build-test' ], function(done) {
    karma.start({
        configFile: __dirname + '/karma.conf.js',
        action: 'run'
    }, done);
});

gulp.task('lint', function(){
    return gulp.src(['src/js/**/*.js', '!src/js/vendor/**/*.js'])
        .pipe(jshint({

        }))
        .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('clean', function(){
    return gulp.src(paths.clean, {read: false})
        .pipe(clean({force: true}));
});

function discoverThemes(dir) {
    return fs.readdirSync(dir)
        .filter(function (file) {
            return fs.statSync(path.join(dir, file)).isDirectory();
        });
}

function sassTask() {
    var themePath = './src/styles/themes',
        themes = discoverThemes(themePath);

    var tasks = themes.map(function(theme) {
        return gulp.src(paths.srcStyles)
            .pipe(plumber({errorHandler: onError}))
            .pipe(sass({
                errLogToConsole: true,
                includePaths: [
                    './src/styles/themes/' + theme,
                    './node_modules/sass-list-maps'
                ]
            }))
            .pipe(concat(theme + '-theme.css'))
            .pipe(base64({
                baseDir: 'dist/img'
            }))
            .pipe(base64({
                baseDir: './src/styles/themes/' + theme + '/images'
            }))
            .pipe(autoprefixer({
                browsers: ['last 2 versions'],
                cascade: true
            }))
            .pipe(plumber.stop())
            .pipe(gulp.dest('dist/css'));
    });

    return es.concat.apply(null, tasks);
}

gulp.task('sass', ['images'], function(){
    return sassTask();
});

gulp.task('fonts', function () {
    return gulp.src('src/fonts/*')
        .pipe(gulp.dest('dist/fonts/'));
});

gulp.task('html', function () {
    return gulp.src(paths.srcHtml)
        .pipe(gulp.dest('dist'));
});

gulp.task('doc', function(cb) {
    exec('jsdoc -r -d ./doc ./src/js', function(err) {
        if (err) {
            return cb(err);
        }

        cb();
    });
});

gulp.task('images', function () {
// Copy all static images to dist
    return gulp.src(paths.srcImages)
        // Pass in options to the task
        .pipe(gulp.dest('dist/img'));
});

gulp.task('build-prod', ['clean', 'build'], function() {
    return gulp.src('dist/**/*.js')
        .pipe(uglify({
            mangle: false
        }))
        .pipe(gulp.dest('dist'));
});

function scripts(watch) {
    var bundler, rebundle;

    if (watch) {
        bundler = watchify(browserify(browserifyOpts, watchify.args)).exclude('time');
    } else {
        bundler = browserify(browserifyOpts).exclude('time');
    }

    vendorLibs.forEach(function (lib) {
        bundler.external(lib);
    });

    rebundle = function() {
        var stream =  bundler.bundle({debug:true})
            // log errors if they happen
            .on('error', function(e) {
                gutil.log('Browserify Error', e);
            })
            .pipe(source('app.js'));

        return stream.pipe(gulp.dest('./dist/js'));
    };

    bundler.on('update', rebundle);

    bundler.on('log', function (msg) {
        gutil.log(gutil.colors.green('Build refreshed:'),msg);
    });

    bundler.on('error', function(e) {
        gutil.log(gutil.colors.red('Error:'),e);
    });

    return rebundle();
}


gulp.task('browserify-vendor', ['build-external'], function(){
    var b = browserify();

    vendorLibs.forEach(function(lib){
        b.require(lib);
    });

    return b.bundle()
        .pipe(source('vendor.js'))
        .pipe(gulp.dest('./dist/js'));
});

gulp.task('browserify-build', function() {
    return scripts(global.isWatching);
});

gulp.task('build', ['browserify-vendor', 'browserify-build', 'sass', 'html', 'fonts']);

gulp.task('setWatch', function() {
    global.isWatching = true;
});

gulp.task('browserSync', ['build'], function() {
    browserSync({
        server: {
            baseDir: ['dist']
        },
        files: [
            'dist/js/**',
            'dist/css/**',
            '!dist/**.map',
            '!dist/js/appTest.js'
        ],
        open: false,
        https: true,
        ghostMode: false
    });
});

gulp.task('watch', ['setWatch', 'browserSync'], function () {
    gulp.watch(paths.srcStyles, ['sass']);
    gulp.watch(paths.srcHtml, ['html']);
});

gulp.task('default', ['clean', 'sass', 'fonts', 'html', 'browserify-vendor', 'browserify-build'], function() {
    gutil.log(gutil.colors.green('Default task complete.'));
});
