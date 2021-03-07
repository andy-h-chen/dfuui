var DOMImpl = require('xmldom').DOMImplementation,
    events = require("events"),
    EventEmitter = require("events").EventEmitter,
    net = require('net'),
    //xml2json = require('./xml2json.js'),
	xml2js = require('xml2js'),
    XMLSerializer = require('xmldom').XMLSerializer,
    queue = require('./queue.js'),

    utils = require('./utils.js');

var rc = {};
function RproxyClient (app, config) {
    var debug = app.debug,
	    logger = app.logger;
    EventEmitter.call(this);
    var self = this;
    this.requestQueue = new queue.Queue();
    this.currentRequest  = null;
    this.currentHeader = null;
    this.dataBuffer = null;
    this.currentBufferContentLength = 0;
    this.currentImageBuffer = null;
    this.currentImageBufferContentLength = 0;
    this.currentImageResponse = null;
    this.expectedImageLength = 0;
    this.client = new net.Socket();
    this.dfus = null;
    this.user = null;
    this.connected = false;
    self.client.on('end', function() {
        logger.info('RproxyClient connection end');
        self.emit('dfu_error', 'rproxy connection ends');
        self.connected = false;
    });
    this.client.on('error', function (err) {
        logger.info('RproxyClient', err);
        self.emit('dfu_error', err);
        self.connected = false;
    });
    this.connect = function () {
        self.client.connect(config.RPROXY_PORT, config.HOST, self.connectionHandler);
    };
    this.connectionHandler = function () {
        if (debug) {
            logger.debug('RproxyClient Connected to ' + config.HOST + ':' + config.RPROXY_PORT);
        }
        self.connected = true;
    };
    this.setUser = function (user) {
        self.user = user;
    };
    this.setDfuPermissions = function (dfus) {
        logger.debug('setDfuPermissions', dfus);
        self.dfus = dfus;
    };
    this.destroy = function () {
        self.client.end();
        self.client.destroy();
        delete self.client;
        delete self.requestQueue;
        if (debug) {
            logger.debug('RproxyClient destroy.');
        }
    };
    this.reset = function () {
        self.currentRequest = null;
        self.currentHeader = null;
        self.dataBuffer = null;
        self.currentBufferContentLength = 0;
        self.currentImageBuffer = null;
        self.currentImageResponse = null;
        self.currentImageBufferContentLength = 0;
        if (self.requestQueue && !self.requestQueue.isEmpty()) {
            if (debug) {
                logger.debug('RproxyClient.reset dequeue');
            }
            self.handleRequest(self.requestQueue.dequeue());
        }
    };
    this.readResponse = function (data, hasHeader) {
        if (hasHeader && data.length > rproxyClientUtils.TlvHeaderLength) {
            // Read response
            var len = data.length > self.currentHeader.length + rproxyClientUtils.TlvHeaderLength ? self.currentHeader.length + rproxyClientUtils.TlvHeaderLength : data.length;
            data.copy(self.dataBuffer, 0, rproxyClientUtils.TlvHeaderLength, len);
            self.currentBufferContentLength = len - rproxyClientUtils.TlvHeaderLength;
        } else if (hasHeader && data.length == rproxyClientUtils.TlvHeaderLength) {
            // Header only, do nothing.
        } else {
            // No header in data, response is in multiple data events.
            var remainingSpace = self.currentHeader.length - self.currentBufferContentLength;
            var len = data.length > remainingSpace ? remainingSpace : data.length;
            data.copy(self.dataBuffer, self.currentBufferContentLength, 0, len);
            if (debug) {
                logger.debug('RproxyClient.readResponse, data.length = ', data.length, ' currentBufferContentLength = ', self.currentBufferContentLength);
            }
            self.currentBufferContentLength = self.currentBufferContentLength + len;
        }
        // Emit and cleanup.
        if (self.currentBufferContentLength == self.currentHeader.length) {
            // Response is ready.
            var xmlStr = self.dataBuffer.toString('utf8');
            if (debug) {
                logger.debug('RproxyClient.readResponse header.length = ', self.currentHeader.length, ' xmlStr = ', xmlStr);
            }
            //var result = xml2json.parser(xmlStr);
			xml2js.parseString(xmlStr, function(err, result) {
				self.emit('dfu_data', self.currentRequest, result);
				self.reset();
			});
        }
    };
    this.readBackground = function (data, hasHeader) {
        if (hasHeader && data.length > rproxyClientUtils.TlvHeaderLength) {
            // Case 1: Read response
            var len = data.length > self.currentHeader.length + rproxyClientUtils.TlvHeaderLength ? self.currentHeader.length + rproxyClientUtils.TlvHeaderLength : data.length;
            data.copy(self.dataBuffer, 0, rproxyClientUtils.TlvHeaderLength, len);
            self.currentBufferContentLength = len - rproxyClientUtils.TlvHeaderLength;
            logger.debug('RproxyClient.readBackground case 1');
        } else if (hasHeader && data.length == rproxyClientUtils.TlvHeaderLength) {
            // Case 2: Header only, do nothing;
            return;
        } else if (self.currentBufferContentLength < self.currentHeader.length) {
            // Case 3: No header in data, response is not completed, read it.
            var remainingSpace = self.currentHeader.length - self.currentBufferContentLength;
            var len = data.length > remainingSpace ? remainingSpace : data.length;
            data.copy(self.dataBuffer, self.currentBufferContentLength, 0, len);
            if (debug) {
                logger.debug('RproxyClient.readBackground case 3: data.length = ', data.length, ' currentBufferContentLength = ', self.currentBufferContentLength);
            }
            self.currentBufferContentLength += len;
        } else if (self.currentImageBufferContentLength < self.expectedImageLength) {
            // Case 4: Read image data
            var remainingSpace = self.expectedImageLength - self.currentImageBufferContentLength;
            var len = data.length > remainingSpace ? remainingSpace : data.length;
            data.copy(self.currentImageBuffer, self.currentImageBufferContentLength, 0, len);
            self.currentImageBufferContentLength += len;
            if (debug) {
                logger.debug('RproxyClient.readBackground case 4: currentImageBufferContentLength = ', self.currentImageBufferContentLength);
            }
        }
		parseBackgroundData(data, hasHeader);
	};
	var parseBackgroundData = function(data, hasHeader) {
        if (self.currentBufferContentLength == self.currentHeader.length && self.currentImageBufferContentLength == 0) {
            // Response is done, parse it and read image.
            var xmlStr = self.dataBuffer.toString('utf8');
            if (debug) {
                logger.debug('RproxyClient.parseBackgroundData header.length = ', self.currentHeader.length, ' xmlStr = ', xmlStr);
            }
            //var result = xml2json.parser(xmlStr);
			xml2js.parseString(xmlStr, function(err, result) {
				self.currentImageResponse = result;
                logger.debug('RproxyClient.parseBackgroundData xml2js.parseString result = ', result);
				if (result
                    && result.Interaction
                    && result.Interaction.$.OperationType == 'ok'
                    && result.Interaction.Data
                    && result.Interaction.Data[0].$.Length > 0) {
					if (debug) {
						logger.debug('RproxyClient.parseBackgroundData, get ready for receiving image data.');
					}
                    self.expectedImageLength = parseInt(result.Interaction.Data[0].$.Length);
					self.currentImageBuffer = Buffer.alloc(self.expectedImageLength);
					// Read some image data.
					var headerLength = hasHeader ? rproxyClientUtils.TlvHeaderLength : 0;
					if (data.length > self.currentHeader.length + headerLength) {
						data.copy(self.currentImageBuffer, self.currentImageBufferContentLength, self.currentHeader.length + headerLength);
						self.currentImageBufferContentLength = data.length - headerLength - self.currentHeader.length;
						if (debug) {
							logger.debug('RproxyClient.parseBackgroundData currentImageBufferContentLength = ', self.currentImageBufferContentLength);
						}
					}
				} else if (result
                           && result.Interaction
                           && result.Interaction.$.OperationType == 'audio_frame_up'
                           && result.Interaction.$.Length > 0) {
					if (debug) {
						logger.debug('RproxyClient.parseBackgroundData for audio_frame_up, get ready for receiving image data.');
					}
                    self.expectedImageLength = parseInt(result.Interaction.$.Length);
					self.currentImageBuffer = Buffer.alloc(self.expectedImageLength);
					// Read some image data.
					var headerLength = hasHeader ? rproxyClientUtils.TlvHeaderLength : 0;
					if (data.length > self.currentHeader.length + headerLength) {
						data.copy(self.currentImageBuffer, self.currentImageBufferContentLength, self.currentHeader.length + headerLength);
						self.currentImageBufferContentLength = data.length - headerLength - self.currentHeader.length;
						if (debug) {
							logger.debug('RproxyClient.parseBackgroundData currentImageBufferContentLength = ', self.currentImageBufferContentLength);
						}
					} else {
                        logger.debug('RproxyClient.parseBackgroundData header and xml only, no data');
                        return;
                    }
                }
				processBackgroundData();
			});
        } else {
			processBackgroundData();
		}
	};
	var processBackgroundData = function() {
        if (self.currentImageResponse
            && self.currentImageResponse.Interaction 
            && (self.currentImageResponse.Interaction.$.OperationType == 'ok')) {
            // All image data is ready, emit and cleanup.
            if (self.currentImageBufferContentLength == self.expectedImageLength) {
                self.emit('dfu_data', self.currentRequest, self.currentImageResponse, 'base64,' + self.currentImageBuffer.toString('base64'));
                if (debug) {
                    logger.debug('RproxyClient.readBackground emit and cleanup.');
                }
                self.reset();
            }
        } else if (self.currentImageResponse.Interaction.$.OperationType == 'audio_frame_up'
                   && self.currentImageBufferContentLength == self.expectedImageLength) {
            self.emit('dfu_data', self.currentRequest, self.currentImageResponse, 'base64,' + self.currentImageBuffer.toString('base64'));
            if (debug) {
                logger.debug('RproxyClient.readBackground audio_frame_up emit and cleanup.');
            }
            self.reset();
        } else {
            // Failed, emit and cleanup.
            self.emit('dfu_data', self.currentRequest, self.currentImageResponse);
            if (debug) {
                logger.debug('RproxyClient.readBackground failed, emit and cleanup. currentImageBufferContentLength = ', self.currentImageBufferContentLength);
            }
            self.reset();
        }
    };
    this.dataHandler = function (data) {
        if (debug) {
            logger.debug('RproxyClient.dataHandler data.length = ', data.length);
        }
        /*
        // Before we assume one request has one response, for live audio, it is not the case any more
        if (!self.currentRequest || data < rproxyClientUtils.TlvHeaderLength && !self.currentHeader) {
            return;
        }
        */
        var hasHeader = false;
        if (!self.currentHeader) {
            // Read header and read response, if it is multiple data events, get prepared.
            var header = rproxyClientUtils.readTlvHeader(data);
            if (!header) {
                self.currentRequest = null;
                logger.debug('RproxyClient.dataHandler !self.currentHeader and new data has no TLV header, return');
                return;
            }
            self.currentHeader = header;
            self.dataBuffer = new Buffer(header.length);
            hasHeader = true;
        }
        // no currentHeader, this response could be live audio data
        if (!self.currentRequest) {
            logger.debug('RproxyClient.dataHandler !self.currentRequest, live audio data!');
            self.readBackground(data, hasHeader);
            return;
        }
        switch (self.currentRequest.operation) {
        case 'background':
        case 'live_video':
        case 'live_audio':
            self.readBackground(data, hasHeader);
            break;
        default:
            self.readResponse(data, hasHeader);
        }
    };
    this.client.on('data', this.dataHandler);
    this.handleRequest = function (request) {
        if (debug) {
            logger.debug('RproxyClient handleRequest', request.action != 'streaming' ? request : 'streaming');
        }
        if (!request || !request.operation) {
            return;
        }
        if (!self.connected) {
            self.emit('dfu_error', 'rproxy disconnected');
            self.reset();
            return;
        }
        if (!self.currentRequest && request.action != 'streaming') {
            self.currentRequest = request;
            request.data = request.data ? request.data : {};
            request.data.DfuId = request.dfuId;
            request.data.SensorId = request.sensorId;
            var xmlStr = rproxyClientUtils.generateQueryXML(request.action, request.operation, request.data);
            rproxyClientUtils.sendTlvHeader(self.client, rproxyClientUtils.TlvType.TLV_REQUEST, xmlStr.length);
            rproxyClientUtils.sendXML(self.client, xmlStr);
            if (debug) {
                logger.debug('Rproxyclient handleRequest', xmlStr);
            }
            // remove this later!!!
            //if (request.action === 'command') {
            //    self.reset();
            //}
        } else if (request.action == 'streaming') {
            request.data.DfuId = request.dfuId;
            var xmlStr = rproxyClientUtils.generateQueryXML(request.action, request.operation, request.data);
            rproxyClientUtils.sendTlvHeader(self.client, rproxyClientUtils.TlvType.TLV_REQUEST, xmlStr.length);
            rproxyClientUtils.sendXML(self.client, xmlStr);
            rproxyClientUtils.sendBinary(self.client, request.binary);
            logger.debug('RproxyClient handleRequest streaming', xmlStr, request.binary.length);
        } else {
            if (debug) {
                logger.debug('RproxyClient handleRequest enqueue, length = ', self.requestQueue.getLength());
            }
            self.requestQueue.enqueue(request);
        }
    };
};

function RproxyClientAuth (app, config, mongoose, logger) {
    var self = this;
    var User = mongoose.model('User'),
        Dfu = mongoose.model('Dfu'),
        Alarm = mongoose.model('Alarm'),
        Permission = mongoose.model('Permission');
		//BruyereResident = mongoose.model('BruyereResident');
    this.currentHeader = null;
	this.currentResult = null;
    this.dataBuffer = null;
    this.currentBufferContentLength = 0;
    this.currentImageBuffer = null;
    this.currentImageBufferContentLength = 0;
	this.readImageCallback = null;
    this.client = new net.Socket();
    this.authSessionCreated = false;
    this.connected = false;
    this.connect = function () {
        if (self.connected) {
            return;
        }
        self.client.on('connect', self.connectionHandler);
        self.client.on('data', self.dataHandler);
        self.client.on('end', function() {
            logger.info('RproxyClientAuth connection end');
            self.cleanupAndReconnect();
        });
        self.client.on('error', function(err) {
            logger.error('RproxyClientAuth socket error: ', err);
            self.cleanupAndReconnect();
        });
        self.client.connect(config.RPROXY_PORT, config.HOST);
    };
    this.setAuthSession = function () {
        if (!self.connected || self.authSessionCreated) {
            logger.info('RproxyClientAuth setAuthSession authSessionCreated = ' + self.authSessionCreated + ' connected = ' + self.connected);
            return;
        }
        logger.info('RproxyClientAuth setAuthSession');
        var xmlStr = rproxyClientUtils.generateQueryXML('command', 'set_auth_session');
        rproxyClientUtils.sendTlvHeader(self.client, rproxyClientUtils.TlvType.TLV_REQUEST, xmlStr.length);
        rproxyClientUtils.sendXML(self.client, xmlStr);
        setTimeout(self.setAuthSession, 3000);
    };
    this.connectionHandler = function () {
        logger.info('RproxyClientAuth Connected to ' + config.HOST + ':' + config.RPROXY_PORT)
        self.connected = true;
        self.setAuthSession();
        self.client.setKeepAlive(true, 3000);
    };
    this.destroy = function () {
        self.client.end();
        self.client.destroy();
        delete self.client;
        logger.info('RproxyClientAuth destroy.');
    };
    this.cleanup = function() {
        this.currentHeader = null;
		this.currentImageBuffer = null;
		this.currentImageBufferContentLength = 0;
		this.currentResult = null;
		this.readImageCallback = null;
		logger.info("cleanup");
    };
    this.dataHandler = function (data) {
        var header = rproxyClientUtils.readTlvHeader(data);
        if (!header || data.length < header.length + rproxyClientUtils.TlvHeaderLength) {
            if (!self.currentHeader) {
                logger.error('RproxyClientAuth.dataHandler !header || data.length<header.length+rproxyClientUtils.TlvHeaderLength');
                return;
            } else {
               readImage(data);
               return;
            }
        }
        self.currentHeader = header;
        var dataBuffer = new Buffer(header.length);
        data.copy(dataBuffer, 0, rproxyClientUtils.TlvHeaderLength, rproxyClientUtils.TlvHeaderLength + header.length);
        var xmlStr = dataBuffer.toString('utf8');
        logger.info("dataHandler", xmlStr);
        //var result = xml2json.parser(xmlStr);
		xml2js.parseString(xmlStr, function(err, result) {
			//console.log(result);
			if (result.Interaction.$.ActionType === 'command_response' && result.Interaction.$.OperationType === 'ok') {
				self.authSessionCreated = true;
				return;
			}
			if (result.Interaction.$.ActionType === 'query') {
				switch(result.Interaction.$.OperationType) {
				case 'authenticate':
					handleAuth(result);
					break;
				case 'check_dfuid':
					handleCheckDfuid(result);
					break;
				case 'submit_alarm':
					handleSubmitAlarm(result, data);
					return; // don't cleanup
				case 'submit_status':
					handleSubmitStatus(result);
					break;
				case 'submit_report':
					handleSubmitReport(result);
					break;
				case 'remove_caregivers':
					handleRemoveCaregivers(result);
					break;
				case 'check_reg_status':
					handleCheckRegistration(result);
					break;
				case 'send_dfu_email':
					handleSendEmail(result, data);
					return;	// don't cleanup here.
				case 'send_video_clip':
					handleSendVideoClip(result);
					break;
				case 'cancel_video_clip':
					handleCancelVideoClip(result);
					break;
				}
			}
			self.cleanup();
		});
    };
	var handleCheckRegistration = function(result) {
        var deviceId = result.Interaction.$.DevId,
			dfuId = result.Interaction.$.DfuId;
        if (!deviceId) {
            // this should never happen.
            logger.error('RproxyClientAuth handleCheckRegistration: DevId or Email is null!');
            return;
        }
        Dfu.findByDeviceId(deviceId, function(err, dfu) {
            if (err || !dfu) {
                self.notifyResult('query_response', 'dfu_not_registered', {'DevId': deviceId, 'DfuId': dfuId});
                return;
            }

            self.notifyResult('query_response', 'dfu_registered', {'DevId': deviceId, 'DfuId':dfuId});
        });
	};
	var readImage = function(data) {
		if (!self.currentHeader) {
			// something wrong, cleanup
			logger.info("readImage: something wrong, cleanup");
			self.cleanup();
			return;
		}
		// copy all data to self.currentImageBuffer
		data.copy(self.currentImageBuffer, self.currentImageBuffer.length, 0, data.length < self.currentImageBufferContentLength - self.currentImageBuffer.length ? data.length : self.currentImageBufferContentLength - self.currentImageBuffer.length);
		if (self.currentImageBuffer.length == self.currentImageBufferContentLength) {
			// done, callback
			logger.info("readImage: done, callback");
			self.readImageCallback(self.currentResult, self.currentImageBuffer);
			//sendEmail(self.currentResult, "'data:image/jpeg;base64,'" + self.currentImageBuffer.toString('base64'));
			self.cleanup();
		} else {
			logger.info("readImage: more data to come");
		}
	}
	var handleMessageWithImage = function(result, data, callback) {
		var dataLength = result.Interaction.Data ? parseInt(result.Interaction.Data[0].$.Length) : 0;
        console.log("handleMessageWithImage data.length = " + data.length + " result.Interaction.Data.Length = " + dataLength, " header.length = ", self.currentHeader.length, " TlvHeaderLength = " + rproxyClientUtils.TlvHeaderLength);
		if ((data.length > self.currentHeader.length + rproxyClientUtils.TlvHeaderLength) && dataLength != 0) {
			logger.info("handleMessageWithImage read image data");
			self.currentResult = result;
			self.currentImageBuffer = Buffer.alloc(dataLength);
			logger.info("self.currentImageBuffer ", self.currentImageBuffer.length, dataLength);
			data.copy(self.currentImageBuffer, 0, self.currentHeader.length + rproxyClientUtils.TlvHeaderLength, data.length);
			console.log(self.currentImageBuffer.length);
			self.currentImageBufferContentLength = dataLength;
			if (self.currentImageBuffer.length < dataLength) {
				// more data to come
				logger.info("handleMessageWithImage, " + self.currentImageBuffer.length + " bytes read, more data to come");
				self.readImageCallback = callback;
				return;
			}
		} else if (dataLength != 0) {
			self.currentResult = result;
			self.currentImageBuffer = new Buffer(dataLength);
			self.currentImageBufferContentLength = dataLength;
			self.readImageCallback = callback;
			// more data to come
			logger.info("handleMessageWithImage, 0 byte read, more data to come");
			return;
		}
		callback(result, self.currentImageBuffer);
		logger.info('handleMessageWithImage cleanup');
		self.cleanup();
	};
    var handleSendEmail = function(result, data) {
		var sendEmail = function(result, imageBuffer) {
		// TODO localization
			var receivers = result.Interaction.$.EmailTo,
				sender = result.Interaction.$.EmailFrom,
				subject = result.Interaction.$.EmailSubject,
				body = result.Interaction.$.EmailBody,
				dfuId = result.Interaction.$.DfuId;
			var attachment = imageBuffer && imageBuffer.length > 0 ?
							 {
								  filename: result.Interaction.$.EmailAttachment,
								  path: 'data:image/jpeg;base64,' + imageBuffer.toString('base64')
							 } : null;
			var mailOptions = {
				from: sender,
				to: receivers, // list of receivers
				subject: subject,
				text: body,
				html: body,
				attachments: attachment
			};
			utils.sendEmailFromAuto(config, mailOptions, function(error, info) {
				self.notifyResult('query_response', error ? 'email_send_fail' : 'email_send_ok', {'DfuId': dfuId});
			});
		};
		handleMessageWithImage(result, data, sendEmail);
	};

    var handleCheckDfuid = function(result) {
        var deviceId = result.Interaction.$.DevId;
        if (!deviceId) {
            // this should never happen.
            logger.error('RproxyClientAuth handleCheckDfuid: DevId or Email is null!');
            return;
        }
        Dfu.findByDeviceId(deviceId, function(err, dfu) {
            if (err || !dfu) {
                self.notifyResult('query_response', 'check_dfuid_ok', {'DevId': deviceId, 'DfuId':0});
                return;
            }

            self.notifyResult('query_response', 'check_dfuid_ok', {'DevId': deviceId, 'DfuId':dfuId});
        });
    };
	var handleSendVideoClip = function(result) {
		var alarmId = result.Interaction.$.AlarmId,
			dfuId = result.Interaction.$.DfuId,
			clipUrl = result.Interaction.$.ClipUrl;
		Alarm.find({dfuId: dfuId, alarmId: alarmId}, function(err, alarm) {
			if (err || alarm.length == 0) {
				self.notifyResult('query_response', 'send_video_clip_fail', {'AlarmId': alarmId, 'DfuId': dfuId});
				return;
			}
			//console.log('handleSendVideoClip alarm = ', alarm);
			Alarm.update({dfuId: dfuId, alarmId: alarmId}, {$set: {clipUrl: clipUrl}}, function(err, alarm) {
				if (err) {
					logger.error('RproxyClientAuth Update alarm error', err);
				}
				console.log('Alarm.update:', alarm);
			});
			// we ack rproxy anyways
			self.notifyResult('query_response', 'send_video_clip_ok', {'AlarmId': alarmId});
			self.emit('dfu_alarm_update', alarm[0]);
		});
	};
	var handleCancelVideoClip = function(result) {
		var alarmId = result.Interaction.$.AlarmId,
			dfuId = result.Interaction.$.DfuId;
		Alarm.find({dfuId: dfuId, alarmId: alarmId}, function(err, alarm) {
			if (err || alarm.length == 0) {
				self.notifyResult('query_response', 'cancel_video_clip_fail', {'AlarmId': alarmId, 'DfuId': dfuId});
				return;
			}
			console.log('handleCancelVideoClip alarm = ', alarm);
			Alarm.update({dfuId: dfuId, alarmId: alarmId}, {$set: {clipUrl: ''}}, function(err, alarm) {
				if (err) {
					logger.error('RproxyClientAuth Update alarm error', err);
				}
			});
			// we ack rproxy anyways
			self.notifyResult('query_response', 'cancel_video_clip_ok', {'AlarmId': alarmId, 'DfuId': dfuId});
			self.emit('dfu_alarm_update', alarm[0]);
		});
	};
    var handleSubmitAlarm = function(result, data) {
		var alarmCallback = function(result, imageBuffer) {
			var newAlarm = new Alarm({
				dfuId: result.Interaction.$.DfuId,
				alarmType: result.Interaction.$.AlarmType,
				sendEmail: result.Interaction.$.SendEmail == 1,
				streamId: result.Interaction.$.StreamId,
				alarmId: result.Interaction.$.AlarmId,
				snapshot: imageBuffer && imageBuffer.length > 0
						  ? 'data:image/jpeg;base64,' + imageBuffer.toString('base64')
						  : null
			});
			newAlarm.save(function(err, alarm) {
				if (err) {
					logger.error('RproxyClientAuth Save alarm error', err);
				}
				// we ack rproxy anyways
				self.notifyResult('query_response', 'submit_alarm_ok', {'DfuId': newAlarm.dfuId});
			});
			self.emit('dfu_alarm', newAlarm);
		};

		handleMessageWithImage(result, data, alarmCallback);
		/*
        if (!newAlarm.sendEmail) return;

        var lng = result.Interaction.$.Language;
        Dfu.findByDfuId(newAlarm.dfuId, true, function(err, dfu) {
            if (err) {
                logger.error('RproxyClientAuth Err in dfu.findByDfuId', err);
                return;
            }
            if (!dfu || !dfu.users_id || dfu.users_id.length === 0) {
                logger.error('RproxyClientAuth handleSubmitAlarm !dfu || !dfu.users_id || dfu.users_id.length === 0');
                return;
            }
            var emails = '';
            for(var i=0; i<dfu.users_id.length; i++) {
                emails += dfu.users_id[i].email + ',';
            }
            rproxyClientUtils.sendEmailForAlarm(config, emails, newAlarm, dfu, lng);
        });*/
    };
    var handleSubmitStatus = function(result) {
        var newStatus = new Status({
            dfuId: result.Interaction.$.DfuId,
            statusType: result.Interaction.$.StatusType,
            streamId: result.Interaction.$.StreamId,
            max: result.Interaction.$.Max,
            value: result.Interaction.$.Value
        });
        newStatus.save(function(err, status) {
            if (err) {
                logger.error('RproxyClientAuth Save status error', err);
            }
            // we ack rproxy anyways
            self.notifyResult('query_response', 'submit_status_ok', {'DfuId': newStatus.dfuId});
        });
        self.emit('dfu_status', newStatus);
    };

    var handleSubmitReport = function(result) {
        log(result, debug);
        var newAIReport = new AIReport({
            dfuId: result.Interaction.$.DfuId,
            statusType: result.Interaction.$.StatusType,
            streamId: result.Interaction.$.StreamId,
            text: result.Interaction.$.Text
        });
        newAIReport.save(function(err, report) {
            if (err) {
                logger.error('RproxyClientAuth Save AI report error', err);
            }
            // we ack rproxy anyways
            self.notifyResult('query_response', 'submit_report_ok', {'DfuId': newAIReport.dfuId});
        });
        self.emit('dfu_aireport', newAIReport);
    };
    var handleAuth = function(result) {
        var deviceId = result.Interaction.$.DevId,
            email = result.Interaction.$.Email,
            name = result.Interaction.$.Name,
            lng = result.Interaction.$.Language;

        if (!deviceId || !email) {
            // this should never happen.
            logger.error('RproxyClientAuth handleAuth DevId or Email is null!');
            return;
        }

        var registerOrCheckUser = function(dfu) {
            User.findByUsername(email, function(err, user) {
                if (err) {
                    logger.error('RproxyClientAuth registerOrCheckUser err on User.findByUsername', email, err);
                    self.notifyResult('query_response', 'fail', {'DevId': dfu.deviceId, 'reason': 'Error occurred on findByUsername: ' + email});
                    return;
                }
                if (user) {
                    // new dfu, add it to user's dfu list
                    User.update({username: user.username}, {$addToSet: {dfus_id: dfu._id}}, function(err, theUser) {
                        if (err) {
                            logger.error('RproxyClientAuth error on User.update', err);
                            self.notifyResult('query_response', 'fail', {'DevId': deviceId, 'reason': 'Error occurred on adding dfu to user\'s list'});
                            return;
                        }
                        self.notifyResult('query_response', 'ok', {'DevId': deviceId, 'DfuId': dfu.dfuId});
                        Dfu.update({_id: dfu._id}, {$addToSet: {users_id: user._id}}, function(err, dfu) {
                            logger.info('RproxyClientAuth Dfu.update', err, dfu);
                        });
                    });
                    rproxyClientUtils.sendEmailForNewDfu(config, user, dfu, lng);
                } else {
                    // new user, generate and email password, add dfu to the list
                    var tempPassword = 'qwerty';
                    var hash = require('password-hasher').createHash('ssha512', tempPassword, new Buffer(app.salt)),
                        result = hash.hash.toString('hex');
                    var newUser = new User({
                        username: email,
                        email: email,
                        //password: utils.generatePassword(5),
                        //password: require('bcryptjs').hashSync(tempPassword, app.salt),
                        password: result,
                        dfus_id: [dfu._id]
                    });
                    newUser.save(function(err, newUser) {
                        if (err) {
                            console.error(err);
                            self.notifyResult('query_response', 'fail', {'DevId': dfu.deviceId, 'reason': 'Error occurred on saving new user'});
                            return;
                        }
                        self.notifyResult('query_response', 'ok', {'DevId': dfu.deviceId, 'Pword': newUser.password, 'DfuId': dfu.dfuId});

                        rproxyClientUtils.sendEmailForNewUser(config, {username: newUser.username, plainPassword: tempPassword, email: newUser.email}, dfu, lng);
                        Dfu.update({_id: dfu._id}, {$addToSet: {users_id: newUser._id}}, function(err, dfu) {
                            logger.info('RproxyClientAuth Dfu.update', err, dfu);
                        });
                    });
                }
            });
        };
		
        // Make sure deviceId is unique
        Dfu.findByDeviceId(deviceId, function(err, dfu) {
            if (err) {
                logger.error('RproxyClientAuth error on Dfu.findByDeviceId', deviceId, err);
                self.notifyResult('query_response', 'fail', {'DevId': deviceId, 'reason': 'Error occurred on findByDeviceId'});
                return;
            }
            if (!dfu) {
                var newDfu = new Dfu({deviceId: deviceId, deviceName: name});
                newDfu.save(function(err, newDfu) {
                    if (err) {
                        logger.error('RproxyClientAuth on newDfu.save', newDfu, err);
                        self.notifyResult('query_response', 'fail', {'DevId': deviceId, 'reason': 'Error occurred on newDfu.save'});
                        return;
                    }
                    registerOrCheckUser(newDfu);
                });
            } else {
                if (dfu.deviceName !== name) {
                    Dfu.update({deviceId: deviceId}, {$set: {deviceName: name}}, function(err, result) {
                        logger.info('RproxyClientAuth update dfu name, err = ', err, ' result = ', result);
                    });
                }
                registerOrCheckUser(dfu);
            }
        });
        /*
		var newDfu = new Dfu({deviceId: deviceId, deviceName: name});
		newDfu.save(function(err, newDfu) {
			if (err) {
				logger.error('RproxyClientAuth on newDfu.save', newDfu, err);
				self.notifyResult('query_response', 'fail', {'DevId': deviceId, 'reason': 'Error occurred on newDfu.save'});
				return;
			}
			registerOrCheckUser(newDfu);
			var newBruyereResident = new BruyereResident({name: 'Resident Name', room: 'Resident Room', dfuId: newDfu.dfuId});
			newBruyereResident.save(function(err, nbr) {
				if (err) {
					logger.error('RproxyClientAuth on newBruyereResident.save', newBruyereResident, err);
				} else {
					console.log(nbr);
				}
			});
		});*/
    };
    var handleRemoveCaregivers = function(result) {
        var deviceId = result.Interaction.$.DevId,
            emails = result.Interaction.$.Emails.split(';'),
            users = [];
        Dfu.findByDeviceId(deviceId, function(err, dfu) {
            if (err) {
                logger.error('RproxyClientAuth error on Dfu.findByDeviceId for handleRemoveCaregivers', deviceId, err);
                self.notifyResult('query_response', 'fail', {'DevId': deviceId, 'reason': 'Error occurred on findByDeviceId'});
                return;
            }
            if (!dfu) {
                self.notifyResult('query_response', 'fail', {'DevId': deviceId, 'reason': 'Dfu not found.'});
                return;
            }
            User.find({email: {$in: emails}}, {_id: 1}, function(err, docs) {
                if (err) {
                    logger.error('RproxyClientAuth error on User.find(email) for handleRemoveCaregivers', err, emails);
                    self.notifyResult('query_response', 'fail', {'DevId': deviceId, 'reason': 'Error occurred on User.find(email)'});
                    return;
                }
                if (!emails) {
                    self.notifyResult('query_response', 'fail', {'DevId': deviceId, 'reason': 'Users not found.'});
                    return;
                }
                for(var i=0; i<users.length; i++) {
                    users.push(docs._id);
                }
                Dfu.update({deviceId: deviceId}, {$pull: {users_id: {$in: users}}}, function(err, result) {
                    if (err) {
                        logger.error('RproxyClientAuth error on Dfu.update for handleRemoveCaregivers', err, deviceId);
                        self.notifyResult('query_response', 'fail', {'DevId': deviceId, 'reason': 'Error occurred on Dfu.update'});
                        return;
                    }
                    User.update({email: {$in: emails}}, {$pull: {dfus_id: dfu._id}}, function(err, r) {
                        if (err) {
                            logger.error('RproxyClientAuth error on User.update for handleRemoveCaregivers', err, deviceId);
                            self.notifyResult('query_response', 'fail', {'DevId': deviceId, 'reason': 'Error occurred on User.update'});
                            return;
                        }
                        self.notifyResult('query_response', 'removecaregivers_ok', {'DevId': deviceId, 'emails': emails});
                    });
                });
            });

        });

    };
    this.notifyResult = function(actionType, operationType, data) {
        var str = rproxyClientUtils.generateQueryXML(actionType, operationType, data);
        logger.info('RproxyClientAuth.notifyResult', str);
        rproxyClientUtils.sendTlvHeader(self.client, rproxyClientUtils.TlvType.TLV_RESPONSE, str.length);
        rproxyClientUtils.sendXML(self.client, str);
    };
    this.handleRequest = function(actionType, operationType, data) {
        var str = rproxyClientUtils.generateQueryXML(actionType, operationType, data);
        logger.info('RproxyClientAuth.handleRequest', str);
        rproxyClientUtils.sendTlvHeader(self.client, rproxyClientUtils.TlvType.TLV_REQUEST, str.length);
        rproxyClientUtils.sendXML(self.client, str);
    };
    this.cleanupAndReconnect = function() {
        logger.info('RproxyClientAuth.cleanupAndReconnect.');
        self.authSessionCreated = false;
        self.connected = false;
        self.client.destroy();
        delete self.client;
        setTimeout(function() {
            self.client = new net.Socket();
            self.connect();
        }, 5000);
    };

}

var rproxyClientUtils = (function () {
    var XMLVER = '<?xml version="1.0" encoding="UTF-8"?>\n';
    var TlvType = {
        TLV_TOP: 0,   //keep this on the top
        TLV_PING: 1,
        TLV_REQUEST: 2,
        TLV_RESPONSE: 3,
        TLV_BOTTOM: 4  //keep this on the bottom
    };
    var TlvHeader = function (type, length) {
        this.type = type;
        this.length = length;
    };
    var getProjectRoot = function() {
            var path = require('path');
            return path.dirname(require.main.filename);
        };
    var getAlarmTypeI18nStr = function(alarm) {
        // TODO return alarm type str
        return 'sosAlarm';
    };
    var i18next = require('i18next'),
        Backend = require('i18next-node-fs-backend');
    i18next.use(Backend)
            .init({
                'lng': 'en',
                'backend': {
                    'loadPath': getProjectRoot() + '/locales/{{lng}}/{{ns}}.json'
                }
            });
    var checkLng = function(lng) {
        if (!lng) return 'en';
        switch(lng.toLowerCase()) {
        case 'en':
            return 'en';
        case 'zh':
        case 'zh-cn':
            return 'zh-CN';
        };
    };
    var changeLanguage = function(lng, callback) {
            i18next.changeLanguage(lng, function(err, t) {
                // TODO pass logger here
                if (err) {
                    console.error('Change language failed.', err);
                } else {
                    console.log('Change language to ' + lng);
                }
                callback();
            });
        };

    var api = {
        TlvType: TlvType,
        TlvHeader: TlvHeader,
		TlvHeaderLength: 10,
        readTlvHeader: function (buffer) {
            if (!buffer) {
                return;
            }
            if (buffer.readUInt16LE(0) != 0xeb90) {
                return;
            }
            var type = buffer.readUInt32LE(2);
            var length = buffer.readUInt32LE(6);
            return new TlvHeader(type, length);
        },
        changeLanguage: changeLanguage,
        sendTlvHeader: function (socket, type, length) {
            if (socket) {
                var buf = new Buffer(10);
                buf.writeUInt16LE(0xeb90, 0);
                buf.writeUInt32LE(type, 2);
                buf.writeUInt32LE(length, 6);
                return socket.write(buf);
            }
            return false;
        },
        sendXML: function (socket, data) {
            if (socket && data) {
                var buf = new Buffer(data.length);
                buf.write(data);
                return socket.write(buf);
            }
            return false;
        },
        sendBinary: function (socket, data) {
            if (socket && data) {
                var buf = Buffer.from(data);
                return socket.write(buf);
            }
            return false;
        },
        generateQueryXML: function (actionType, operationType, data) {
            var doc = new DOMImpl().createDocument();
            var root = doc.createElement('Interaction');
            root.setAttribute('ActionType', actionType);
            root.setAttribute('OperationType', operationType);
            for(var propertyName in data) {
                root.setAttribute(propertyName, data[propertyName]);
            }
            doc.appendChild(root);
            var str = XMLVER + new XMLSerializer().serializeToString(doc);
            //console.log(str);
            return str;
        },
        sendEmailForNewUser: function(config, user, dfu, lng) {
            changeLanguage(checkLng(lng), function() {
                var mailOptions = {
                    from: 'RemoCare <remocare@remotron.com>', // sender address
                    to: user.email, // list of receivers
                    subject: i18next.t('email.newUser.subject'),
                    //text: i18next.t('email.newUser.text', {loginLink: config.URL + config.V1_LOGIN + '?username=' + user.username + '&password=' + user.plainPassword, password: user.plainPassword}),
                    html: i18next.t('email.newUser.html', {deviceName: dfu.deviceName, loginLink: config.URL + config.V1_LOGIN + '?username=' + user.username + '&password=' + user.plainPassword, password: user.plainPassword})
                };
                utils.sendEmailFromAuto(config, mailOptions);
            });
        },
        sendEmailForNewDfu: function(config, user, dfu, lng) {
            changeLanguage(checkLng(lng), function() {
                var mailOptions = {
                    from: config.DEFAULT_EMAIL_SENDER, // sender address
                    to: user.email, // list of receivers
                    subject: i18next.t('email.newDfu.subject'), // Subject line
                    //text: i18next.t('email.newDfu.text', {deviceName: dfu.deviceName, url: config.URL}),
                    html: i18next.t('email.newDfu.html', {deviceName: dfu.deviceName, url: config.URL})
                };
                utils.sendEmailFromAuto(config, mailOptions);
            });
        },
        sendEmailForAlarm: function(config, emails, alarm, dfu, lng) {
            changeLanguage(checkLng(lng), function() {
                var alarmType = getAlarmTypeI18nStr(alarm);
                var mailOptions = {
                    from: config.DEFAULT_EMAIL_SENDER,
                    to: emails,
                    subject: i18next.t('email.' + alarmType + '.subject', {deviceName: dfu.deviceName}),
                    //text: alarmType + ' is detected from ' + dfu.deviceName + '.' ,
                    html: i18next.t('email.' + alarmType + '.html', {deviceName: dfu.deviceName, date: alarm.date, url: config.url, info: alarm.info})
                };
                utils.sendEmailFromAuto(config, mailOptions);
            });
        },
        getProjectRoot: getProjectRoot
    };
    return api;
})();

RproxyClient.prototype.__proto__ = EventEmitter.prototype;
RproxyClientAuth.prototype.__proto__ = EventEmitter.prototype;

rc.RproxyClient = RproxyClient;
rc.RproxyClientAuth = RproxyClientAuth;
rc.RproxyClientUtils = rproxyClientUtils;

module.exports = rc;
