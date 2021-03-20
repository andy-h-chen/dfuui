var async = require('async'),
    cssMin = require('./cssmin'),
    fs = require('fs'),
    fse = require('fs-extra'),
    requirejs = require('requirejs'),
    ncp = require('ncp').ncp,
    uglify = require('uglify-js'),
    jsConfig, cssConfig, filePaths, actionsLeft, assetBuilder;

var paths = {};
paths.rootOutputDir = __dirname + '/../public';
paths.rootJSDir = paths.rootOutputDir + '/js';
paths.JSLibDir = paths.rootJSDir + '/lib';
paths.rootBuildDir = paths.rootOutputDir + '/build';
paths.dfuDir = paths.rootOutputDir + '/dfu';
paths.adminDir = paths.rootOutputDir + '/admin';
paths.cssDir = paths.rootOutputDir + '/css';

actionsLeft = 2;

jsConfig = {
    baseUrl: paths.rootOutputDir + '/js',
    name: 'main',
    out: paths.rootOutputDir + 'build/main-built.js',

    paths: {
        'text': 'lib/text',
        'jquery': 'lib/jquery',
        'underscore': 'lib/underscore',
        'backbone': 'lib/backbone-amd',
        'bootstrap': 'lib/bootstrap',
        'moment': 'lib/moment',
        'ClientModel': 'models/client',
        'ClientCollection': 'collections/clients',
        'SessionModel': 'models/session',
        'UserModel': 'models/user',
        'UserCollection': 'collections/users',
        'HomeView': 'views/home',
        'LoginView': 'views/login',
        'HeaderView': 'views/header',
        'ClientListView': 'views/clients/index',
        'ClientEditView': 'views/clients/edit',
        'ClientView': 'views/clients/show',
        'UserListView': 'views/users/index',
        'UserView': 'views/users/show',
        'UserEditView': 'views/users/edit',
        'PermissionModel': 'models/perm',
        'PermissionCollection': 'collections/perms',
        'PermissionListView': 'views/perms/index',
        'PermissionView': 'views/perms/show',
        'PermEditView': 'views/perms/edit',
        'RoleModel': 'models/role',
        'RoleCollection': 'collections/roles',
        'RoleListView': 'views/roles/index',
        'RoleView': 'views/roles/show',
        'RoleEditView': 'views/roles/edit',
        'DfuModel': 'models/dfu',
        'DfuCollection': 'collections/dfus',
        'DfuListView': 'views/dfus/index',
        'DfuView': 'views/dfus/show',
        'DfuEditView': 'views/dfus/edit',
        'StatusView': 'views/status'
    },
    optimize: 'none'
};

// cssConfig a la RequireJS optimizer
cssConfig = {
    baseUrl: '../public/css',
    files: ['../node_modules/bootstrap/dist/css/bootstrap.min', '../public/css/style'],
    out: '../public/build/main-built.css'
};

assetBuilder = function(callback) {
    for (var prop in paths) {
        if (!fs.existsSync(paths[prop])){
            fs.mkdirSync(paths[prop]);
        }
    }

    // bootstrap
    fs.createReadStream(__dirname + '/../node_modules/bootstrap/dist/js/bootstrap.min.js').pipe(fs.createWriteStream(paths.JSLibDir + '/bootstrap.min.js'));
    // jquery
    fs.createReadStream(__dirname + '/../node_modules/jquery/dist/jquery.min.js').pipe(fs.createWriteStream(paths.JSLibDir + '/jquery.min.js'));
    // copy jquery.min.js to build, this is for login and dfu
    fs.createReadStream(__dirname + '/../node_modules/jquery/dist/jquery.min.js').pipe(fs.createWriteStream(paths.rootBuildDir + '/jquery.min.js'));
    fs.createReadStream(__dirname + '/../node_modules/jquery/dist/jquery.min.map').pipe(fs.createWriteStream(paths.rootBuildDir + '/jquery.min.map'));
    // copy Chart.js
    fs.createReadStream(__dirname + '/../assets/Chart.js').pipe(fs.createWriteStream(paths.rootBuildDir + '/Chart.js'));

    // copy socket.io-stream browser js
    fs.createReadStream(__dirname + '/../node_modules/socket.io-stream/socket.io-stream.js').pipe(fs.createWriteStream(paths.rootBuildDir + '/socket.io-stream.js'));

    // copy i18next
    fs.createReadStream(__dirname + '/../node_modules/i18next/i18next.min.js').pipe(fs.createWriteStream(paths.rootBuildDir + '/i18next.min.js'));
    fs.createReadStream(__dirname + '/../node_modules/jquery-i18next/i18next-jquery.min.js').pipe(fs.createWriteStream(paths.rootBuildDir + '/i18next-jquery.min.js'));
    fs.createReadStream(__dirname + '/../node_modules/i18next-xhr-backend/i18nextXHRBackend.min.js').pipe(fs.createWriteStream(paths.rootBuildDir + '/i18nextXHRBackend.min.js'));
    fs.createReadStream(__dirname + '/../node_modules/i18next-browser-languagedetector/i18nextBrowserLanguageDetector.min.js').pipe(fs.createWriteStream(paths.rootBuildDir + '/i18nextBrowserLanguageDetector.min.js'));
    fse.copy(__dirname + '/../assets/locales', paths.rootOutputDir + '/locales', function(err) {
        if (err) {
            console.error("error: " + err);
        } else {
            console.log('Copy locales success.');
        }
    });

    // copy moment
    fs.createReadStream(__dirname + '/../node_modules/moment/min/moment.min.js').pipe(fs.createWriteStream(paths.rootBuildDir + '/moment.min.js'));

    // copy flot touch
    fs.createReadStream(__dirname + '/../assets/jquery.flot.touch.js').pipe(fs.createWriteStream(paths.rootBuildDir + '/jquery.flot.touch.js'));

    // dfu
    fs.createReadStream(__dirname + '/../assets/dfu/dfu.js').pipe(fs.createWriteStream(paths.dfuDir + '/dfu.js'));
    fs.createReadStream(__dirname + '/../assets/dfu/dfu.html').pipe(fs.createWriteStream(paths.dfuDir + '/dfu.html'));
    fs.createReadStream(__dirname + '/../assets/dfu/common.js').pipe(fs.createWriteStream(paths.dfuDir + '/common.js'));
    fs.createReadStream(__dirname + '/../assets/dfu/RTCMultiConnection.js').pipe(fs.createWriteStream(paths.dfuDir + '/RTCMultiConnection.js'));

    // css
    fs.createReadStream(__dirname + '/../assets/css/remo.css').pipe(fs.createWriteStream(paths.cssDir + '/remo.css'));

    fs.createReadStream(__dirname + '/../assets/index.html').pipe(fs.createWriteStream(paths.rootOutputDir + '/index.html'));
    fs.createReadStream(__dirname + '/../assets/favicon.png').pipe(fs.createWriteStream(paths.rootOutputDir + '/favicon.png'));

    // admin
    fs.createReadStream(__dirname + '/../assets/admin/admin.html').pipe(fs.createWriteStream(paths.adminDir + '/admin.html'));

    // images
    fse.copy(__dirname + '/../assets/images/mobile', paths.rootOutputDir + '/images/mobile', function(err) {
        if (err) {
            console.error("error: " + err);
        } else {
            console.log('Copy images success.');
        }
    });
    fse.copy(__dirname + '/../assets/images/senior', paths.rootOutputDir + '/images/senior', function(err) {
        if (err) {
            console.error("error: " + err);
        } else {
            console.log('Copy images success.');
        }
    });
    // fonts
    fse.copy(__dirname + '/../assets/fonts', paths.rootOutputDir + '/fonts', function(err) {
        if (err) {
            console.error("error: " + err);
        } else {
            console.log('Copy fonts success.');
        }
    });
    // flot
    fse.copy(__dirname + '/../assets/flot', paths.rootBuildDir + '/flot', function(err) {
        if (err) {
            console.error("error: " + err);
        } else {
            console.log('Copy flot success.');
        }
    });

    // rtcmulticonnection-admin
    fse.copy(__dirname + '/../assets/rtcmulticonnection-admin', paths.rootOutputDir + '/rtcmulticonnection-admin', function(err) {
        if (err) {
            console.error("error: " + err);
        } else {
            console.log('Copy rtcmulticonnection-admin success.');
        }
    });
    // copy webrtc-adapter
    fs.createReadStream(__dirname + '/../node_modules/webrtc-adapter/out/adapter.js').pipe(fs.createWriteStream(paths.rootBuildDir + '/webrtc-adapter.js'));


/*
    // utlify
    fs.writeFile(__dirname + '/../public/build/d.js', uglify.minify(__dirname + '/../public/dfu/dfu.js').code);


    requirejs.optimize(jsConfig, function(buildResponse) {
        // buildResponse is just a text output of the modules
        // included. Load the built file for the contents.
        // Use config.out to get the optimized file contents.
        var contents = fs.readFileSync(jsConfig.out, 'utf8');
        //console.log(contents);
        if (!--actionsLeft) {
            callback();
        }
    });

    // construct the file paths
    filePaths = [];
    cssConfig.files.forEach(function(file) {
        //filePaths.push(__dirname + '/' + cssConfig.baseUrl + '/' + file + '.css');
        filePaths.push(__dirname + '/' + file + '.css');
    });

    async.map(filePaths, function minimizeCss(item, callback) {
        fs.readFile(item, 'UTF-8', function(err, contents) {
            if (err) {
                callback(err, null);
            } else {
                // return minified contents
                callback(null, cssMin(contents));
            }
        });
    }, function writeToFile(err, results) {
        var filePath;

        if (err) {
            throw err;
        }

        filePath = __dirname + '/' + cssConfig.out;
        fs.writeFile(filePath, results.join('\n'), 'UTF-8', function(err) {
            if (err) {
                throw err;
            }

            // execute callback only when both actions have finished
            if (!--actionsLeft) {
                callback();
            }
        });
    });
*/
};

module.exports = assetBuilder;
