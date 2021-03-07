var v1       = '/api/v1',
    utils    = require('../../lib/utils'),
    _        = require('underscore'),
    passwordhasher = require('password-hasher'),
	//MongoClient = require('mongodb').MongoClient,
    NotFound = utils.NotFound,
    checkErr = utils.checkErr,
    log      = console.log,
    BruyereController;

BruyereController = function(app, mongoose, config) {
	/*
	var password;
	console.log(utils.getDbPath(config));
	MongoClient.connect(utils.getDbPath(config), function(err, db) {
		if (err) {
			console.log("MongoClient connection error.", err);
			return;
		}
		var bruyere_admin = db.collection('bruyere_admin');
		bruyere_admin.find({'admin_pass': {$ne:''}}).toArray(function(err, docs) {
			if (err) {
				console.log("Error on admin_pass");
				return;
			}
			password = docs[0].admin_pass;
		});
		db.close();
	});
	
	app.post(v1 + '/bruyere/adminpassword', function(req, res, next) {
		if (req.body.adminPassword == password) {
			res.json({message: 'Success!'});
		} else {
			res.json({error: 'Failed!'});
		}
	});*/
	var Dfu = mongoose.model('Dfu'),
	    Alarm = mongoose.model('Alarm');
	app.post(v1 + '/bruyere/edittext', function(req, res, next) {
		console.log(req.body);
		var dfuUpdateHandler = function(error) {
			if (error) {
				res.json({error: 'Error on save'});
				console.log(error);
				return;
			}
			res.json({message: 'Success!'});
		};
		if (req.body.type === 'residentName') {
			Dfu.update({dfuId: req.body.dfuId}, {$set: {residentName: req.body.text}}, dfuUpdateHandler);
		} else if (req.body.type === 'residentRoom') {
			Dfu.update({dfuId: req.body.dfuId}, {$set: {residentRoom: req.body.text}}, dfuUpdateHandler);
		} else if (req.body.type === 'residentPic') {
			Dfu.update({dfuId: req.body.dfuId}, {$set: {residentPic: req.body.text}}, dfuUpdateHandler);
		} else {
			res.json({error: 'Wrong type'});
			return;
		}
	});

	/*
	app.post(v1 + '/bruyere/newresident', function(req, res, next) {
		if (req.body.adminPassword != password) {
			res.json({error: 'Wrong password'});
			return;
		}
		var newResident = new BruyereResident(_.pick(req.body, 'name', 'room', 'dfuId', 'pic'));
		newResident.save(function(err) {
            if (!err) {
                res.json({message: 'Success!'});
            } else {
                errors = utils.parseDbErrors(err, config.error_messages);
                if (errors.code) {
                    code = errors.code;
                    delete errors.code;
                    log(err);
                }
                res.json({error: code});
            }
		});
	});*/
	app.post(app.v1 + '/bruyere/listalarms', function(req, res, next) {
		var dfuId = req.body.dfuId;
		Alarm.findByDfuId(dfuId, function(err, alarms) {
			if (err) {
				res.json({error: 'Error on getting alarm list.'});
				return;
			}
			res.json(alarms);
		});
	});
	app.post(app.v1 + '/bruyere/alarmsnapshot', function(req, res, next) {
		Alarm.find({dfuId: req.body.dfuId, alarmId: req.body.alarmId}, function(err, alarm) {
			if (err) {
				res.json({error: 'Error on getting alarm list.'});
				return;
			}
			res.json(alarm);
		});
	});
    app.post(app.v1 + '/bruyere/residents', function (req, res, next) {
		var dfu_ids = req.body.dfu_ids.split(',');
		if (dfu_ids.length == 1 && dfu_ids[0] == '') {
			res.json({error: 'No data'});
			return;
		}
        Dfu.find({dfuId: {$in: dfu_ids}}, function(err, residents) {
            res.json(residents);
        });
    });
};

module.exports = BruyereController;