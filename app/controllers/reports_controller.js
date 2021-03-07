var utils    = require('../../lib/utils'),
    _        = require('underscore'),
    NotFound = utils.NotFound,
    checkErr = utils.checkErr,
    log      = console.log,
    ReportsController;

ReportsController = function(app, mongoose, config) {

    var Report = mongoose.model('Report');

    app.get(app.v1 + '/reports', app.ensureAuthenticated, function index(req, res, next) {
        Report.findByDFUId(req.query.dfuid, function(err, reports) {
            // TODO: finish etag support here, check for If-None-Match
            //res.header('ETag', utils.etag(perms));
            res.json(reports);
        });
    });


    app.post(app.v1 + '/reports', app.ensureAuthenticated, function create(req, res, next) {
        //log('app.post', req);
        var newReport;
        console.log('req.body', req.body);
        // disallow other fields besides those listed below
        var formElements = _.pick(req.body, 'dfuid', 'files', 'content', 'caregiverName');
        if (!formElements.caregiverName) {
            formElements.caregiverName = req.user.username;
        }
        console.log('formElements', formElements, req.user.username);
        newReport = new Report(_.extend(formElements, {'user_id': req.user._id}));
        console.log('newReport', newReport);
        newReport.save(function(err) {
            var errors, code = 200, loc;

            if (!err) {
                res.status(201).json(newReport);
                //res.json(newReport, 201);
            } else {
                errors = utils.parseDbErrors(err, config.error_messages, 'key'); // key: unique field
                if (errors.code) {
                    code = errors.code;
                    delete errors.code;
                    // TODO: better better logging system
                    log(err);
                }
                res.status(errors).json(code);
                //res.json(errors, code);
            }
        });
    });
};

module.exports = ReportsController;
