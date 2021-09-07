var utils    = require('../../lib/utils'),
    _        = require('underscore'),
    NotFound = utils.NotFound,
    checkErr = utils.checkErr,
    log      = console.log,
    ENV = process.env.NODE_ENV || 'development',
    DfusController,
    TAG = 'DfusController';

DfusController = function(app, mongoose, config) {

    var Dfu = mongoose.model('Dfu'),
        succededMsg = {result: 'ok'};

    // TODO: remove this, if we go with same origins!!!!!!
    console.log(TAG, ' ENV = ', ENV + ' url = ', config[ENV].URL);


    app.get(app.v1 + '/dfus', app.hasPermission, function index(req, res, next) {
    //app.get(app.v1 + '/dfus', function index(req, res, next) {
        console.log(req.url, req.query);

        Dfu.findWithUserInfo(function(err, dfus) {
            // TODO: finish etag support here, check for If-None-Match
            //res.header('ETag', utils.etag(perms));
            if (ENV === 'development') {
              res.header('Access-Control-Allow-Origin', '*');
            }
            res.json(dfus);
        });
    });
    app.post(app.v1 + '/dfus/allsubagent', app.hasPermission, function(req, res,next) {
        console.log(req.url, req.body);
        Dfu.findByAllSubAgentId(req.body.user.agentId, function(err, result) {
          if (ENV === 'development') {
            res.header('Access-Control-Allow-Origin', '*');
          }
            res.json(result);
        });
    });
    app.get(app.v1 + '/dfus/:id', app.hasPermission, function show(req, res, next) {
        Dfu.findById(req.params.id, true, function(err, dfu) {
            checkErr(
                next,
                [{ cond: err }, { cond: !dfu, err: new NotFound('json') }],
                function() {
                    res.header('ETag', utils.etag(dfu));
                    res.json(dfu);
                }
            );
        });
    });
    app.put(app.v1 + '/dfus/:id', app.hasPermission, function update(req, res, next) {
        var attributes = _.pick(req.body, 'users_id');
        Dfu.update({_id: req.params.id}, {$set: {users_id: attributes.users_id}}, function(err, dfu) {
            if (err) {
                res.status(422).send("err: " + err.message);
            } else {
                res.json(succededMsg);
            }

        });
    });
    app.patch(app.v1 + '/dfus/:id/users_id', app.hasPermission, function(req, res, next) {
        console.log("patch", req.params.id, req.body.users_id);
        if (ENV === 'development') {
          res.header('Access-Control-Allow-Origin', '*');
        }
        if (!req.body || req.body.users_id === undefined) {
            res.status(422).send("err: params incomplete.");
            return;
        }
        Dfu.update({_id: req.params.id},
                   {$set: {users_id: req.body.users_id}},
                   function(err, dfu) {
                       if (err)
                           res.status(422).send('err:' + err.message);
                       else
                           res.json(succededMsg);
                   });
    });
    app.patch(app.v1 + '/dfus/:id/enabled', app.hasPermission, function(req, res, next) {
        console.log("patch", req.params.id, req.body.enabled);
        if (ENV === 'development') {
          res.header('Access-Control-Allow-Origin', '*');
        }
        if (!req.body || req.body.enabled === undefined) {
            res.status(422).send("err: params incomplete.");
            return;
        }
        Dfu.update({_id: req.params.id},
                   {$set: {enabled: req.body.enabled}},
                   function(err, dfu) {
                       if (err)
                           res.status(422).send('err:' + err.message);
                       else
                           res.json(succededMsg);
                   });
    });
    app.patch(app.v1 + '/dfus/:id/admin_id', app.hasPermission, function(req, res, next) {
        console.log("patch", req.params.id, req.body.enabled);
        if (ENV === 'development') {
          res.header('Access-Control-Allow-Origin', '*');
        }
        if (!req.body || req.body.admin_id === undefined) {
            res.status(422).send("err: params incomplete.");
            return;
        }
        Dfu.update({_id: req.params.id},
                   {$set: {admin_id: req.body.admin_id}},
                   function(err, dfu) {
                       if (err)
                           res.status(422).send('err:' + err.message);
                       else
                           res.json(succededMsg);
                   });
    });
    app.patch(app.v1 + '/dfus/:id/status', app.hasPermission, function(req, res, next) {
        console.log("patch", req.params.id, req.body.enabled);
        if (ENV === 'development') {
          res.header('Access-Control-Allow-Origin', '*');
        }
        if (!req.body || req.body.status === undefined) {
            res.status(422).send("err: params incomplete.");
            return;
        }
        Dfu.update({_id: req.params.id},
                   {$set: {status: req.body.status}},
                   function(err, dfu) {
                       if (err)
                           res.status(422).send('err:' + err.message);
                       else
                           res.json(succededMsg);
                   });
    });
    app.delete(app.v1 + '/dfus/:id', app.hasPermission, function destroy(req, res, next) {
        Dfu.findById(req.params.id, false, function(err, dfu) {
          if (ENV === 'development') {
            res.header('Access-Control-Allow-Origin', '*');
          }
          if (err) {
              res.json({error: 'Not Found'});
          } else {
            console.log("Delete dfu id = ", dfu.id);
            dfu.remove();
            res.json(succededMsg);
          }
        });
    });
    app.patch(app.v1 + '/dfus/:id/caregivers', app.hasPermission, function(req, res, next) {
        console.log("patch", req.params.id, req.body.remove, "caregiver_id=", req.body.caregiver_id);
        if (ENV === 'development') {
          res.header('Access-Control-Allow-Origin', '*');
        }
        if (!req.body || req.body.caregiver_id === undefined || req.body.remove != true) {
            res.status(422).send("err: params incomplete.");
            return;
        }

        Dfu.update({ _id: req.params.id }, { $pull: { users_id: { $in: [req.body.caregiver_id] } } }, function(err, result) {
          if (err) {
            console.log(err);
            res.json({error: 'Not Found'});
            return;
          }
          res.json(succededMsg);
          var User = mongoose.model('User');
          User.update({ _id: req.body.caregiver_id }, { $pull: { dfus_id: req.params.id } }, function(err, r) {
            if (err) {
              console.log('Error on User.update for removing caregivers', err, req.params.id, req.body.caregiver_id);
              return;
            }
            console.log('User update succeed.')
          });
        });
    });
};

module.exports = DfusController;
