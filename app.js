var connect = require('connect'),
    express = require('express'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    methodOverride = require('method-override'),
    session = require('express-session'),
    io = require('socket.io'),
    socketio_jwt = require('socketio-jwt'),
    //jwt = require('jsonwebtoken'),
    connectTimeout = require('connect-timeout'),
    mongoose = require('mongoose'),
    passport = require('passport'),
    gzippo = require('gzippo'),
    utils = require('./lib/utils'),
    rc = require('./lib/rproxyclient'),
    siofu = require('socketio-file-upload'),
    favicon = require('serve-favicon'),
    winston = require('winston'),
    ss= require('socket.io-stream'),
    EventEmitter = require('events').EventEmitter,
    AppEmitter = new EventEmitter(),
    app = express(),
    httpApp = express(),
    fs = require('fs'),
    https = require('https'),
    ENV = process.env.NODE_ENV || 'development';

const RTCMultiConnectionServer = require('rtcmulticonnection-server');
process.on('uncaughtException', function (error) {
   console.log(error.stack);
});
app.debug = ENV === 'development';
var transport;
if (!app.debug) {
    transport = new (winston.transports.DailyRotateFile)({
            //level: ['info', 'error'],
            filename: './logs/daily.log',
            prettyPrint: true,
            datePattern: 'yyyy-MM-dd',
            json: false
    });
} else {
    transport = new winston.transports.Console({
            level: 'debug',
            json: false,
            timestamp: true
    });
}
var logger = new (winston.Logger)({
    transports: [transport]
});
app.logger = logger;
app.v1 = '/api/v1';
app.ensureAuthenticated = function(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.json({
        error: 'Please login.'
    });
}
/*
require('bcrypt-nodejs').genSalt(10, function(err, salt) {
    app.salt = salt;
});
*/

var sslOptions;
try{
    sslOptions  = {
        key : fs.readFileSync(__dirname + '/ssl/privkey1.pem'),
        ca  : fs.readFileSync(__dirname + '/ssl/chain1.pem'),
        cert: fs.readFileSync(__dirname + '/ssl/cert1.pem')
    };
} catch(err) {
    logger.error(err);
    sslOptions = null;
}

utils.loadConfig(__dirname + '/config', function(config) {
    app.use(function(req, res, next) {
        res.removeHeader("X-Powered-By");
        next();
    });
    app.use(siofu.router);
    utils.ifEnv('production', function() {
        // enable gzip compression
        app.use(gzippo.compress());
    });
    app.use(favicon(__dirname + '/public/favicon.png'));
    //app.use(morgan('dev'));
    //app.use(express['static'](__dirname + '/public'));
    app.use(cookieParser());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    var expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 3);
    app.use(methodOverride());
    app.use(session({
        secret: 'cdpg',
        expires: expireDate,
        cookie: {
            maxAge: 60*24*3600*1000
        },
        resave: true,
        saveUninitialized: true
    }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.salt = config[ENV].SALT;
    app.demo = config[ENV].DEMO;
    utils.ifEnv('production', function() {
        app.use(connectTimeout({
            time: parseInt(config[ENV].REQ_TIMEOUT, 10)
        }));
    });

    app.use(function(err, req, res, next) {
        if (err && err.stack) {
            logger.error(err.stack);
        }
        next();
    });

    mongoose = utils.connectToDatabase(mongoose, config.db[ENV].main, function(err, msg) {
		//console.log('connectToDatabase', err, msg);
	});

    // register models
    require('./app/models/permission')(mongoose);
    require('./app/models/role')(mongoose);
    require('./app/models/user')(mongoose);
    require('./app/models/report')(mongoose);
    require('./app/models/dfu')(mongoose);
    require('./app/models/alarm')(mongoose);
    //require('./app/models/bruyere_resident')(mongoose);

    // register controllers
    require('./app/controllers/auth_controller')(app, mongoose, passport, config[ENV]);
    require('./app/controllers/perms_controller')(app, mongoose, config);
    require('./app/controllers/roles_controller')(app, mongoose, config);
    require('./app/controllers/users_controller')(app, mongoose, config);
    require('./app/controllers/reports_controller')(app, mongoose, config);
    require('./app/controllers/mail_controller')(app, config, ENV);
    require('./app/controllers/dfus_controller')(app, mongoose, config);
    require('./app/controllers/admin_controller')(app, mongoose, config);
    require('./app/controllers/upload_controller')(app);
    require('./app/controllers/bruyere_controller')(app, mongoose, config.db[ENV].main);
    //require('./app/controllers/notification_controller')(app, config[ENV]);
    // All other controllers must register before errors_controller!
    require('./app/controllers/errors_controller')(app, mongoose, config);

    app.on('error', function(e) {
        if (e.code == 'EADDRINUSE') {
            logger.error('Address in use, retrying...');
            setTimeout(function() {
                app.close();
                app.listen(config[ENV].PORT, function() {
                    app.serverUp = true;
                });
            }, 1000);
        }
    });

    var server;
    if (sslOptions) {
        if (!module.parent) {
            httpApp.listen(config[ENV].PORT, function() {
                app.serverUp = true;
            });
            httpApp.get('*', function(req, res, next) {
                res.redirect('https://' + req.headers.host);
            });
        }

        server = https.createServer(sslOptions, app).listen(443, function() {
            app.serverUp = true;
            console.log('Server listening on port %d', this.address().port);
        });
    } else {
        server = app.listen(config[ENV].PORT, function() {
            app.serverUp = true;
        });
    }
    AppEmitter.on('checkApp', function() {
        AppEmitter.emit('getApp', app);
    });

    var sio = io(server);

    sio.use(socketio_jwt.authorize({
        secret: config.development.JWT_SECRET,
        handshake: true
    }));

    var clients = [];
    app.sioStatus = function(callback) {
        callback(clients);
    };

    // Start an authentication session to rproxy
    var rproxyClientAuth = new rc.RproxyClientAuth(app, config[ENV], mongoose, logger);
    rproxyClientAuth.connect();

    var dfuPostMsgHandler = function(type) {
        return function(msg) {
			//console.log('dfuPostMsgHandler', msg);
            clients.forEach(function(client) {
				// temporarily disable this
				/*
                if (!client.lastRequest || client.lastRequest.dfuId != msg.dfuId) {
					console.log('early return for alarm');
                    return;
                }*/
				console.log('dfuPostMsgHandler', type, client.dfus, msg.dfuId, client.user.isAdmin());
                if (client.user.isAdmin()) {
                    client.emit(type, msg);
                } else {
    				for (var i=0; i<client.dfus.length; i++) {
                        console.log('dfuPostMsgHandler', client.dfus[i].dfuId, msg.dfuId);
    					if (client.dfus[i].dfuId == msg.dfuId) {
    						client.emit(type, msg);
    						break;
    					}
    				}
                }
            });
        };
    };
    rproxyClientAuth.on('dfu_alarm', dfuPostMsgHandler('dfu_alarm'));
	rproxyClientAuth.on('dfu_alarm_update', dfuPostMsgHandler('dfu_alarm_update'));
    rproxyClientAuth.on('dfu_status', dfuPostMsgHandler('dfu_status'));
    rproxyClientAuth.on('dfu_aireport', dfuPostMsgHandler('dfu_aireport'));
	/*
	rproxyClientAuth.on('dfu_alarm', function(msg) {
		clients.forEach(function(client) {
			for (var i=0; i<client.dfus.length; i++) {
				if (client.dfus[i].dfuId == msg.dfuId) {
					client.emit('dfu_alarm', msg);
					break;
				}
			}
		});
		var Dfu = mongoose.model('Dfu');
		Dfu.findByDfuId(msg.dfuId, false, function(err, dfu) {
			if (err) {
				logger.error('Error occurred in sio.sockets connection, on User.findById');
				return;
			}
			var webPush = require('web-push');
			var VAPID_SUBJECT = config[ENV].URL,
				VAPID_PUBLIC_KEY = config[ENV].VAPID_PUBLIC_KEY,
				VAPID_PRIVATE_KEY = config[ENV].VAPID_PRIVATE_KEY,
				AUTH_SECRET = config[ENV].JWT_SECRET;
			webPush.setVapidDetails(
				VAPID_SUBJECT,
				VAPID_PUBLIC_KEY,
				VAPID_PRIVATE_KEY
			);
			dfu.users(function(err, users) {
				for(var i=0; i<users.length; i++) {
					for(var j=0; j<users[i].subscribers.length; j++) {
						var text = msg.alarmType + ' triggerred by ' + dfu.residentName;
						var payload = JSON.stringify({message : text, clickTarget: 'https://www.remocare.net', title: 'Remocare alarm'});
						console.log('subscribers',i, j, users[i].subscribers[j]);
						var pushSubscription = {
							endpoint: users[i].subscribers[j].notificationEndPoint,
							keys: {
								p256dh: users[i].subscribers[j].publicKey,
								auth: users[i].subscribers[j].auth
							}
						};
						webPush.sendNotification(pushSubscription, payload, {}).then((response) =>{
							console.log('sendNotification response:', response);
						}).catch((error) =>{
							console.log('sendNotification error:', error);
						});
					}
				}
			});
		});
	});*/

    sio.sockets.on('connection', function(socket) {
        RTCMultiConnectionServer.addSocket(socket, {
            "socketURL": "/",
            "homePage": config.URL,
            "socketMessageEvent": "RTCMultiConnection-Message",
            "enableAdmin": true,
            "adminUserName": "admin",
            "adminPassword": "$10Aday",
            "enableLogs": true
        });

        var self = this;
        var addr = socket.client.conn.remoteAddress;
        logger.info(new Date() + " New connection from " + addr, socket.decoded_token);
        var debug = true;

        var rproxyClient;

        var User = mongoose.model('User');
		var userId = socket.decoded_token;
        User.findById(userId, false, function(err, user) {
            if (err) {
                logger.error('Error occurred in sio.sockets connection, on User.findById');
                return;
            }
            // TODO: add a user for android client
            if (!user) return;

            logger.info('Connected username: ', user.username);
            socket.user = user;
			// get user's dfu list
            user.dfus(function(err, dfus) {
                socket.dfus = dfus;
                clients.push(socket);
                rproxyClient = new rc.RproxyClient(app, config[ENV]);
                rproxyClientInit();
                rproxyClient.connect();
            });
        });

        var rproxyClientInit = function() {
          rproxyClient.on('dfu_data', function(request, response, imageData) {
              if (!socket.user) return;
              if (!socket.user.hasAccess('access_admin')) {
                  // return the full list for admin, otherwise, only return the ones that in the user's list
                  switch (response.Interaction.$.Replyto) {
                  case 'list':
                      if (response.Interaction.Data && response.Interaction.Data[0] && response.Interaction.Data[0].Site) {
                          var sites = response.Interaction.Data[0].Site;
                          for (var i=sites.length-1; i>=0; i--) {
                              var result = socket.dfus.find(function (elm, index, array) {
                                  if (elm.dfuId.toString() === sites[i].$.DfuId.toString()) return elm;
                              });
                              if (!result) {
                                  sites.splice(i, 1);
                              }
                          }
                      }
                  }
              }
              socket.emit('dfu_data', request, response, imageData);
          });
          rproxyClient.on('dfu_error', function(details) {
              socket.emit('dfu_error', details);
          });
        }
        
        socket.on('disconnect', function() {
          if (rproxyClient) {
            rproxyClient.destroy();
            delete rproxyClient;
          }
          if (socket.user) {
            User.update({_id: socket.user._id}, {$set: {lastLogout: new Date().toISOString()}}, function(err, result) {
                if (err) logger.error('update user lastLogout', err);
            });
          }
            clients.splice(clients.indexOf(socket), 1);
        });

        socket.on('dfu_request', function(request) {
            if (debug) {
                logger.debug('socket.on request', request.action == 'streaming' ? 'streaming' : request);
            }
            socket.lastRequest = request;
            rproxyClient.handleRequest(request);
        });

		socket.on('user_subscribe', function(request) {
			console.log('user_subscribe', request);
			User.update({_id: userId}, {
				$push: {
					subscribers: request
				}
			}, function(err) {
				console.log('user_subscribe', err);
			});
		});
		socket.on('user_unsubscribe', function(request) {
			console.log('user_unsubscribe', request);
			User.update({_id: userId}, {
				$pull: {
					subscribers: {
						notificationEndPoint: request.notificationEndPoint
					}
				}
			}, function(err) {
				console.log('user_unsubscribe', err);
			});
		});
        socket.on('dfu_saved_alarm', function(request){
            mongoose.model('Alarm').find({dfuId: request.dfuId, viewed: false}).exec(function(err, result) {
                if (err) {
                    logger.error('dfu_saved_alarm err', err);
                    return;
                }
                if (!result || !result.length) {
                    logger.info('dfu_saved_alarm no data');
                    return;
                }
                result.forEach(function(alarm) {
                    socket.emit('dfu_alarm', alarm);
                });
            });
        });

        socket.on('dfu_alarm_viewed', function(request) {
            mongoose.model('Alarm').update({dfuId: request.dfuId}, {$set: {viewed: true}}, {multi: true}, function(err) {
                if (err) {
                    logger.error('Error on dfu_alarm_viewed', err);
                    return;
                }
                // TODO: notify other online users
            });
			rproxyClientAuth.handleRequest('command', 'reset_alarm', {'DfuId': request.dfuId});
			// notify other client
			dfuPostMsgHandler('alarm_viewed')({dfuId: request.dfuId});
        });

        socket.on('dfu_upload_bg', function(request) {
            if (!socket.user.hasAccess('access_admin')) {
                var result = socket.dfus.find(function (elm, i, a) {
                    if (elm.dfuId === request.dfuId) return elm;
                });
                if (!result) return; // no permission, return silently
            }
            mongoose.model('Dfu').update({dfuId: request.dfuId}, {$set: {'background': request.fileName}}, function(err, dfu) {
                if (err) {
                    logger.error('Error on dfu_upload_bg', err);
                } else {
                    console.log('dfu_upload_bg success ' + request.dfuId + ' ' + request.fileName + dfu.dfuId + dfu.background);
                }
            });

        });
        socket.on('dfu_bg', function(request) {
            if (!socket.user.hasAccess('access_admin')) {
                var result = socket.dfus.find(function (elm, i, a) {
                    if (elm.dfuId === request.dfuId) return elm;
                });
                if (!result) return; // no permission, return silently
            }
            mongoose.model('Dfu').findOne().where('dfuId', request.dfuId).exec(function(err, dfu) {
                if (!err) {
					if (dfu && dfu.background)
						socket.emit('dfu_bg_response', {fileName: dfu.background});
                }
            });
        });

        // TODO: move this to upload_controller
        ss(socket).on('file', function(stream, data) {
            var fs = require('fs'),
                path = require('path');
            var filename = path.basename(data.name),
				destDir = data.dest == 'id_photos' ? '/public/images/bruyere/id_photos/' : '/uploads/';
            try {
                var stat = fs.lstatSync(__dirname + destDir + filename);
                if (stat.isFile()) {
                    var ext = path.extname(filename);
                    filename = filename.substring(0, filename.indexOf(ext)) + '-' + (new Date().getTime()) + ext;
                }
            } catch (e) {
                // file does not exist
            }
            stream.pipe(fs.createWriteStream(__dirname + destDir + filename));
            stream.on('end', function(evt) {
                logger.info('sio-stream end', evt);
                socket.emit('file_uploaded', {originalName: data.name, savedName: filename, type: data.type, dest: data.dest});
            });
            logger.info('socket.io-stream filename: ', data);
        });
    });

});

if (!Array.prototype.find) {
    Array.prototype.find = function(predicate) {
        if (this == null) {
            throw new TypeError('Array.prototype.find called on null or undefined');
        }
        if (typeof predicate !== 'function') {
            throw new TypeError('predicate must be a function');
        }
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        var value;

        for (var i = 0; i < length; i++) {
            value = list[i];
            if (predicate.call(thisArg, value, i, list)) {
                return value;
            }
        }
        return undefined;
    };
}

if (!Array.prototype.remove) {
    Array.prototype.remove = function(vals, all) {
        var i, removedItems = [];
        if (!Array.isArray(vals)) vals = [vals];
        for (var j = 0; j < vals.length; j++) {
            if (all) {
                for (i = this.length; i--;) {
                    if (this[i] === vals[j]) removedItems.push(this.splice(i, 1));
                }
            } else {
                i = this.indexOf(vals[j]);
                if (i > -1) removedItems.push(this.splice(i, 1));
            }
        }
        return removedItems;
    };
}
/**
 * export AppEmitter for external services so that the callback can execute
 * when the app has finished loading the configuration
 */
module.exports = AppEmitter;
