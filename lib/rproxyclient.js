var DOMImpl = require('xmldom').DOMImplementation,
  events = require("events"),
  EventEmitter = require("events").EventEmitter,
  net = require('net'),
  //xml2json = require('./xml2json.js'),
  xml2js = require('xml2js'),
  XMLSerializer = require('xmldom').XMLSerializer,
  queue = require('./queue.js'),

  utils = require('./utils.js');

var fs = require('fs');

var rc = {};

var RproxyMessage = function(length, imgLen, curLen, data) {
	this.length = 0;
	this.imgLen = imgLen;
	this.currentLength = 0;
  this.data = data;
}

var RproxyDataHandler = function(data) {
  if (!data) return;
  //console.log(' data.length = ' + data.length);
  //console.log('RproxyDataHandler data.length = ' + data.length + ' data = ' + data);
  //this.logger.debug('RproxyClient.dataHandler data.length = ', data.length);

  var dataPosition = 0;
  while (dataPosition != data.length) {
    var header = rproxyClientUtils.readTlvHeader(data, dataPosition);
    if (!header) {
      // no header, it could be the remaining part of last message
      this.logger.info("No header, responseQueue.length = ", this.responseQueue.length);
      // No msg, ignore this data event
      if (this.responseQueue.length == 0) return;
      // Get the last msg from queue
      var msg = this.responseQueue[this.responseQueue.length - 1];
      var msgLen = msg.length + msg.imgLen;
      this.logger.info("msgLen=", msgLen, " currentLength=", msg.currentLength, " data.length=", data.length);
      if (msgLen > msg.currentLength) {
        var lengthToCopy = Math.min(msg.currentLength, data.length);
        data.copy(msg.dataBuffer, msg.currentLength, dataPosition, dataPosition + lengthToCopy);
        dataPosition += lengthToCopy;
      } else {
        // The last msg is complete, ignore this data event
        return;
      }
      break;
    } else {
      dataPosition += rproxyClientUtils.TlvHeaderLength;
      var msg = new RproxyMessage();
      msg.length = header.length;
      msg.imgLen = header.imgLen;
      var msgLen = msg.imgLen + msg.length;
      msg.dataBuffer = new Buffer.allocUnsafe(header.length + header.imgLen);
      if (msgLen < data.length - dataPosition) {
        // multiple messages in same data event
        data.copy(msg.dataBuffer, 0, dataPosition, dataPosition + msgLen);
        msg.currentLength = msgLen;
        dataPosition += msgLen;
      } else {
        // the remaining data has one message or part of it
        data.copy(msg.dataBuffer, 0, dataPosition);
        msg.currentLength = data.length - dataPosition;
        dataPosition = data.length;
      }
      this.responseQueue.push(msg);
    }
    this.logger.debug('RproxyClient.dataHandler dataPosition = ' + dataPosition + ' queue.size = ' + this.responseQueue.length);
  }
  setTimeout(this.processResponse, 0);
};

function RproxyClient(app, config) {
  EventEmitter.call(this);
  var self = this;
  var logger = app.logger,
      debug = app.debug;
  this.logger = logger;
  this.requestMap = new Map();
  this.responseQueue = [];
  this.requestId = 0;
  this.client = new net.Socket();
  this.dfus = null;
  this.user = null;
  this.connected = false;
  self.client.on('end', function() {
    logger.info('RproxyClient connection end');
    self.emit('dfu_error', 'rproxy connection ends');
    self.connected = false;
  });
  this.client.on('error', function(err) {
    logger.info('RproxyClient', err);
    self.emit('dfu_error', err);
    self.connected = false;
  });
  this.connect = function() {
    self.client.connect(config.RPROXY_PORT, config.HOST, self.connectionHandler);
  };
  this.connectionHandler = function() {
    if (debug) {
      logger.debug('RproxyClient Connected to ' + config.HOST + ':' + config.RPROXY_PORT);
    }
    self.connected = true;
  };
  this.setUser = function(user) {
    self.user = user;
  };
  this.setDfuPermissions = function(dfus) {
    logger.debug('setDfuPermissions', dfus);
    self.dfus = dfus;
  };
  this.destroy = function() {
    self.client.end();
    self.client.destroy();
    delete self.client;
    if (debug) {
      logger.debug('RproxyClient destroy.');
    }
  };
  this.reset = function() {
  }; 

  this.processResponse = function() {
  	if (self.responseQueue.length > 0) {
  		var msg = self.responseQueue[0];
  		if (msg.length + msg.imgLen != msg.currentLength) {
  			// msg not complete, wait for more data
        console.log('msg.length = ', msg.length, ' msg.imgLen = ', msg.imgLen, ' msg.currentLength = ', msg.currentLength);
  			return;
  		}

  		var xmlBuffer = Buffer.alloc(msg.length, 0);
  		msg.dataBuffer.copy(xmlBuffer, 0, 0, msg.length);
  		var xmlStr = xmlBuffer.toString('utf8');
  		xml2js.parseString(xmlStr, function(err, result) {
        if (result && result.Interaction
                   //&& result.Interaction.$.OperationType == 'ok'
                   && result.Interaction.$.ID) {
          var imgData;
          if (msg.imgLen > 0) {
            var imgBuffer = Buffer.allocUnsafe(msg.imgLen);
            msg.dataBuffer.copy(imgBuffer, 0, msg.length);
            imgData = 'base64, ' + imgBuffer.toString('base64');
          }
          var request = self.requestMap.get(result.Interaction.$.ID);
          self.requestMap.delete(result.Interaction.$.ID);
          self.emit('dfu_data', request, result, imgData);
          var processedMsg = self.responseQueue.shift();
          delete processedMsg;
          console.log('result.Interaction.$ = ' + JSON.stringify(result.Interaction.$));
          console.log('processResponse finish one iteration. self.responseQueue.length = ', self.responseQueue.length);
          setTimeout(self.processResponse, 0);
        }
      });
  	}
  };
 
  this.client.on('data', RproxyDataHandler.bind(this));
  this.handleRequest = function(request) {
    if (debug) {
      logger.debug('RproxyClient handleRequest', request);
    }
    if (!request || !request.operation) {
      return;
    }
    if (!self.connected) {
      self.emit('dfu_error', 'rproxy disconnected');
      self.reset();
      return;
    }

    self.currentRequest = request;
    request.data = request.data ? request.data : {};
    request.data.DfuId = request.dfuId;
    request.data.SensorId = request.sensorId;
    request.data.ID = self.requestId++;
    self.requestMap.set(request.data.ID.toString(), request);
    var xmlStr = rproxyClientUtils.generateQueryXML(request.action, request.operation, request.data);
    rproxyClientUtils.sendTlvHeader(self.client, rproxyClientUtils.TlvType.TLV_REQUEST, xmlStr.length);
    rproxyClientUtils.sendXML(self.client, xmlStr);
    if (debug) {
      logger.debug('Rproxyclient handleRequest', xmlStr);
    }
  };
};

function RproxyClientAuth(app, config, mongoose, logger) {
  var self = this;
  var User = mongoose.model('User'),
    Dfu = mongoose.model('Dfu'),
    Alarm = mongoose.model('Alarm'),
    Permission = mongoose.model('Permission');
  //BruyereResident = mongoose.model('BruyereResident');
  this.logger = app.logger;
  this.responseQueue = [];
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
  this.connect = function() {
    if (self.connected) {
      return;
    }
    self.client.on('connect', self.connectionHandler);
    self.client.on('data', RproxyDataHandler.bind(self));
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
  this.setAuthSession = function() {
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
  this.connectionHandler = function() {
    logger.info('RproxyClientAuth Connected to ' + config.HOST + ':' + config.RPROXY_PORT)
    self.connected = true;
    self.setAuthSession();
    self.client.setKeepAlive(true, 3000);
  };
  this.destroy = function() {
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

  this.processResponse = function() {
    if (self.responseQueue.length == 0) return;
    var msg = self.responseQueue[0];
    if (msg.length + msg.imgLen != msg.currentLength) {
      if (self.responseQueue.length == 1) {
        // msg not complete, wait for more data
        logger.info('Msg not complete, wait for more data. msg.length = ', msg.length, ' msg.imgLen = ', msg.imgLen, ' msg.currentLength = ', msg.currentLength);
        return;
      }
      // The 1st message is corrupted, delete it.
      self.responseQueue.shift();
      setTimeout(self.processResponse, 0);
      return;
    }

    msg = self.responseQueue.shift();
    var xmlBuffer = Buffer.alloc(msg.length, 0);
    msg.dataBuffer.copy(xmlBuffer, 0, 0, msg.length);
    var xmlStr = xmlBuffer.toString('utf8');
    var imgBuffer;
    if (msg.imgLen > 0) {
      imgBuffer = Buffer.allocUnsafe(msg.imgLen);
      msg.dataBuffer.copy(imgBuffer, 0, msg.length, msg.imgLen);
    }
    xml2js.parseString(xmlStr, function(err, result) {
      logger.info("processResponse xml2js.parseString", result);
      if (result && result.Interaction) {
        if (result.Interaction.$.ActionType === 'command_response' &&
            result.Interaction.$.OperationType === 'ok' &&
            result.Interaction.$.Replyto === 'set_auth_session') {
          self.authSessionCreated = true;
          delete msg;
          return;
        }
        if (result.Interaction.$.ActionType === 'query') {
          switch (result.Interaction.$.OperationType) {
            case 'authenticate':
              handleAuth(result);
              break;
            case 'check_dfuid':
              handleCheckDfuid(result);
              break;
            case 'submit_alarm':
              handleSubmitAlarm(result, imgBuffer);
              return;
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
              handleSendEmail(result, imgBuffer);
              return;
            case 'send_video_clip':
              handleSendVideoClip(result);
              break;
            case 'cancel_video_clip':
              handleCancelVideoClip(result);
              break;
          }
        }
        
        delete msg;
        setTimeout(self.processResponse, 0);
      }
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
        self.notifyResult('query_response', 'dfu_not_registered', { 'DevId': deviceId, 'DfuId': dfuId });
        return;
      }

      self.notifyResult('query_response', 'dfu_registered', { 'DevId': deviceId, 'DfuId': dfuId });
    });
  };

  var handleSendEmail = function(result, imageBuffer) {
    logger.info("handleSendEmail, imageBuffer.length=", imageBuffer ? imageBuffer.length : 0);
    // TODO localization
    var receivers = result.Interaction.$.EmailTo,
      sender = result.Interaction.$.EmailFrom,
      subject = result.Interaction.$.EmailSubject,
      body = result.Interaction.$.EmailBody,
      dfuId = result.Interaction.$.DfuId;
    var attachment = imageBuffer && imageBuffer.length > 0 ? {
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
      self.notifyResult('query_response', error ? 'email_send_fail' : 'email_send_ok', { 'DfuId': dfuId });

      /* write file to disk for debugging
      if (!imageBuffer) return;
      var tmp_filename = __dirname + '/../public/test_dump/EmailAttachment.jpeg';
      fs.writeFile(tmp_filename, imageBuffer, function(err, data) {
        if (err)
          console.log('writeFile error:', err);
        else
          console.log('writeFile succeed. length = ', imageBuffer.length);
      });
      */
    });

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
        self.notifyResult('query_response', 'check_dfuid_ok', { 'DevId': deviceId, 'DfuId': 0 });
        return;
      }

      self.notifyResult('query_response', 'check_dfuid_ok', { 'DevId': deviceId, 'DfuId': dfuId });
    });
  };
  var handleSendVideoClip = function(result) {
    var alarmId = result.Interaction.$.AlarmId,
      dfuId = result.Interaction.$.DfuId,
      clipUrl = result.Interaction.$.ClipUrl;
    Alarm.find({ dfuId: dfuId, alarmId: alarmId }, function(err, alarm) {
      if (err || alarm.length == 0) {
        self.notifyResult('query_response', 'send_video_clip_fail', { 'AlarmId': alarmId, 'DfuId': dfuId });
        return;
      }

      Alarm.update({ dfuId: dfuId, alarmId: alarmId }, { $set: { clipUrl: clipUrl } }, function(err, alarm) {
        if (err) {
          logger.error('RproxyClientAuth Update alarm error', err);
        }
      });
      // we ack rproxy anyways
      self.notifyResult('query_response', 'send_video_clip_ok', { 'AlarmId': alarmId });
      self.emit('dfu_alarm_update', alarm[0]);
    });
  };
  var handleCancelVideoClip = function(result) {
    var alarmId = result.Interaction.$.AlarmId,
      dfuId = result.Interaction.$.DfuId;
    Alarm.find({ dfuId: dfuId, alarmId: alarmId }, function(err, alarm) {
      if (err || alarm.length == 0) {
        self.notifyResult('query_response', 'cancel_video_clip_fail', { 'AlarmId': alarmId, 'DfuId': dfuId });
        return;
      }
      //console.log('handleCancelVideoClip alarm = ', alarm);
      Alarm.update({ dfuId: dfuId, alarmId: alarmId }, { $set: { clipUrl: '' } }, function(err, alarm) {
        if (err) {
          logger.error('RproxyClientAuth Update alarm error', err);
        }
      });
      // we ack rproxy anyways
      self.notifyResult('query_response', 'cancel_video_clip_ok', { 'AlarmId': alarmId, 'DfuId': dfuId });
      self.emit('dfu_alarm_update', alarm[0]);
    });
  };
  var handleSubmitAlarm = function(result, imageBuffer) {
    var newAlarm = new Alarm({
      dfuId: result.Interaction.$.DfuId,
      alarmType: result.Interaction.$.AlarmType,
      sendEmail: result.Interaction.$.SendEmail == 1,
      streamId: result.Interaction.$.StreamId,
      alarmId: result.Interaction.$.AlarmId,
      snapshot: imageBuffer && imageBuffer.length > 0 ?
        'data:image/jpeg;base64,' + imageBuffer.toString('base64') : null
    });
    newAlarm.save(function(err, alarm) {
      if (err) {
        logger.error('RproxyClientAuth Save alarm error', err);
      }
      // we ack rproxy anyways
      self.notifyResult('query_response', 'submit_alarm_ok', { 'DfuId': newAlarm.dfuId });
    });
    self.emit('dfu_alarm', newAlarm);

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
      self.notifyResult('query_response', 'submit_status_ok', { 'DfuId': newStatus.dfuId });
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
      self.notifyResult('query_response', 'submit_report_ok', { 'DfuId': newAIReport.dfuId });
    });
    self.emit('dfu_aireport', newAIReport);
  };
  var handleAuth = function(result) {
    var deviceId = result.Interaction.$.DevId,
      email = result.Interaction.$.Email,
      name = result.Interaction.$.Name,
      agentId = result.Interaction.$.AgentId,
      //agentId = '10',
      lng = result.Interaction.$.Language;
    logger.info('handleAuth result = ', result);
    console.log('handleAuth agentId = ', agentId);
    if (!deviceId || !email) {
      // this should never happen.
      logger.error('RproxyClientAuth handleAuth DevId or Email is null!');
      return;
    }
    var updateAgentId = function(dfu) {
      console.log('updateAgentId ', agentId);
      User.findByAgentId(agentId, function(err, user) {
        if (err) {
          logger.error('RproxyClientAuth updateAgentId error on User.findByAgentId ', agentId, err);
          self.notifyResult('query_response', 'fail', { 'DevId': dfu.deviceId, 'reason': 'Error occurred on findByAgentId: ' + agentId });
          return;
        }
        if (user && user[0]) {
          Dfu.update({ _id: dfu._id }, { $set: { admin_id: user[0]._id } }, function(err, dfu) {
            logger.info('RproxyClientAuth updateAgentId Dfu.update', err, dfu);
          });
        } else {
          console.log('RproxyClientAuth updateAgentId no result on User.findByAgentId:', agentId);
          self.notifyResult('query_response', 'fail', { 'DevId': dfu.deviceId, 'reason': 'No result on findByAgentId: ' + agentId });
        }
      });
    };

    var registerOrCheckUser = function(dfu) {
      User.findByUsername(email, function(err, user) {
        if (err) {
          logger.error('RproxyClientAuth registerOrCheckUser err on User.findByUsername', email, err);
          self.notifyResult('query_response', 'fail', { 'DevId': dfu.deviceId, 'reason': 'Error occurred on findByUsername: ' + email });
          return;
        }
        if (user) {
          // new dfu, add it to user's dfu list
          User.update({ username: user.username }, { $addToSet: { dfus_id: dfu._id } }, function(err, theUser) {
            if (err) {
              logger.error('RproxyClientAuth error on User.update', err);
              self.notifyResult('query_response', 'fail', { 'DevId': deviceId, 'reason': 'Error occurred on adding dfu to user\'s list' });
              return;
            }
            self.notifyResult('query_response', 'ok', { 'DevId': deviceId, 'DfuId': dfu.dfuId });
            Dfu.update({ _id: dfu._id }, { $addToSet: { users_id: user._id } }, function(err, dfu) {
              logger.info('RproxyClientAuth Dfu.update', err, dfu);
            });
          });
          rproxyClientUtils.sendEmailForNewDfu(config, user, dfu, lng);
        } else {
          // new user, generate and email password, add dfu to the list
          var tempPassword = 'qwerty';
          var hash = require('password-hasher').createHash('ssha512', tempPassword, new Buffer.allocUnsafe(app.salt)),
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
              //console.error(err);
              self.notifyResult('query_response', 'fail', { 'DevId': dfu.deviceId, 'reason': 'Error occurred on saving new user' });
              return;
            }
            self.notifyResult('query_response', 'ok', { 'DevId': dfu.deviceId, 'Pword': newUser.password, 'DfuId': dfu.dfuId });

            rproxyClientUtils.sendEmailForNewUser(config, { username: newUser.username, plainPassword: tempPassword, email: newUser.email }, dfu, lng);
            Dfu.update({ _id: dfu._id }, { $addToSet: { users_id: newUser._id } }, function(err, dfu) {
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
        self.notifyResult('query_response', 'fail', { 'DevId': deviceId, 'reason': 'Error occurred on findByDeviceId' });
        return;
      }
      if (!dfu) {
        var newDfu = new Dfu({ deviceId: deviceId, deviceName: name });
        newDfu.save(function(err, newDfu) {
          if (err) {
            logger.error('RproxyClientAuth on newDfu.save', newDfu, err);
            self.notifyResult('query_response', 'fail', { 'DevId': deviceId, 'reason': 'Error occurred on newDfu.save' });
            return;
          }
          registerOrCheckUser(newDfu);
          updateAgentId(newDfu);
        });
      } else {
        if (dfu.deviceName !== name) {
          Dfu.update({ deviceId: deviceId }, { $set: { deviceName: name } }, function(err, result) {
            logger.info('RproxyClientAuth update dfu name, err = ', err, ' result = ', result);
          });
        }
        registerOrCheckUser(dfu);
        updateAgentId(dfu);
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
        self.notifyResult('query_response', 'fail', { 'DevId': deviceId, 'reason': 'Error occurred on findByDeviceId' });
        return;
      }
      if (!dfu) {
        self.notifyResult('query_response', 'fail', { 'DevId': deviceId, 'reason': 'Dfu not found.' });
        return;
      }
      User.find({ email: { $in: emails } }, { _id: 1 }, function(err, docs) {
        if (err) {
          logger.error('RproxyClientAuth error on User.find(email) for handleRemoveCaregivers', err, emails);
          self.notifyResult('query_response', 'fail', { 'DevId': deviceId, 'reason': 'Error occurred on User.find(email)' });
          return;
        }
        if (!emails) {
          self.notifyResult('query_response', 'fail', { 'DevId': deviceId, 'reason': 'Users not found.' });
          return;
        }
        for (var i = 0; i < users.length; i++) {
          users.push(docs._id);
        }
        Dfu.update({ deviceId: deviceId }, { $pull: { users_id: { $in: users } } }, function(err, result) {
          if (err) {
            logger.error('RproxyClientAuth error on Dfu.update for handleRemoveCaregivers', err, deviceId);
            self.notifyResult('query_response', 'fail', { 'DevId': deviceId, 'reason': 'Error occurred on Dfu.update' });
            return;
          }
          User.update({ email: { $in: emails } }, { $pull: { dfus_id: dfu._id } }, function(err, r) {
            if (err) {
              logger.error('RproxyClientAuth error on User.update for handleRemoveCaregivers', err, deviceId);
              self.notifyResult('query_response', 'fail', { 'DevId': deviceId, 'reason': 'Error occurred on User.update' });
              return;
            }
            self.notifyResult('query_response', 'removecaregivers_ok', { 'DevId': deviceId, 'emails': emails });
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

var rproxyClientUtils = (function() {
  var XMLVER = '<?xml version="1.0" encoding="UTF-8"?>\n';
  var TlvType = {
    TLV_TOP: 0, //keep this on the top
    TLV_PING: 1,
    TLV_REQUEST: 2,
    TLV_RESPONSE: 3,
    TLV_BOTTOM: 4 //keep this on the bottom
  };
  var TlvHeader = function(type, length, imgLen = 0) {
    this.type = type;
    this.length = length;
    this.imgLen = imgLen;
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
    switch (lng.toLowerCase()) {
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
    TlvHeaderLength: 14,
    readTlvHeader: function(buffer, pos = 0) {
      if (!buffer) {
        return;
      }
      if (buffer.readUInt16LE(pos) != 0xeb90) {
      	console.log('!= 0xeb90');
        return;
      }
      var type = buffer.readUInt32LE(pos + 2);
      var length = buffer.readUInt32LE(pos + 6);
      var imgLen = buffer.readUInt32LE(pos + 10);
      return new TlvHeader(type, length, imgLen);
    },
    changeLanguage: changeLanguage,
    sendTlvHeader: function(socket, type, length) {
      if (socket) {
        var buf = new Buffer.allocUnsafe(10);
        buf.writeUInt16LE(0xeb90, 0);
        buf.writeUInt32LE(type, 2);
        buf.writeUInt32LE(length, 6);
        return socket.write(buf);
      }
      return false;
    },
    sendXML: function(socket, data) {
      if (socket && data) {
        var buf = new Buffer.allocUnsafe(data.length);
        buf.write(data);
        return socket.write(buf);
      }
      return false;
    },
    sendBinary: function(socket, data) {
      if (socket && data) {
        var buf = Buffer.from(data);
        return socket.write(buf);
      }
      return false;
    },
    generateQueryXML: function(actionType, operationType, data) {
      var doc = new DOMImpl().createDocument();
      var root = doc.createElement('Interaction');
      root.setAttribute('ActionType', actionType);
      root.setAttribute('OperationType', operationType);
      for (var propertyName in data) {
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
          html: i18next.t('email.newUser.html', { deviceName: dfu.deviceName, loginLink: config.URL + config.V1_LOGIN + '?username=' + user.username + '&password=' + user.plainPassword, password: user.plainPassword })
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
          html: i18next.t('email.newDfu.html', { deviceName: dfu.deviceName, url: config.URL })
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
          subject: i18next.t('email.' + alarmType + '.subject', { deviceName: dfu.deviceName }),
          //text: alarmType + ' is detected from ' + dfu.deviceName + '.' ,
          html: i18next.t('email.' + alarmType + '.html', { deviceName: dfu.deviceName, date: alarm.date, url: config.url, info: alarm.info })
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