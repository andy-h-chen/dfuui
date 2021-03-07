var utils    = require('../../lib/utils'),
    _        = require('underscore'),
    NotFound = utils.NotFound,
    checkErr = utils.checkErr,
    log      = console.log,
    UploadController;

UploadController = function(app) {
    app.get(app.v1 + '/uploads/:id', app.ensureAuthenticated, function(req, res, next) {
        var fs = require('fs');
        try {
            var filename = __dirname + '/../../uploads/' + req.params.id;
            var stat = fs.lstatSync(filename);
            res.sendFile(require('path').resolve(filename));
        } catch (e) {
            console.log(e);
            res.status(404).send('File not found');
        }
    });
    app.get(app.v1 + '/uploads/d/:id', app.ensureAuthenticated, function(req, res, next) {
        var fs = require('fs');
        try {
            var filename = __dirname + '/../../uploads/' + req.params.id;
            var stat = fs.lstatSync(filename);
            res.download(require('path').resolve(filename));
        } catch (e) {
            console.log(e);
            res.status(404).send('File not found');
        }
    });


/*    app.post(app.v1 + '/uploads/', multer({
        dest: './uploads',
        onFileUploadStart: function(file, req, res) {
            if (!req.isAuthenticated()) {
                return false;
            }
        },
        onFileUploadComplete: function(file, req, res) {
            var action = req.body.action;
            console.log(action);
        }
    }));

    app.post(app.v1 + '/uploads/', app.ensureAuthenticated, multer({dest: './uploads'}),  function(req, res, next) {
        if (!req.files) {
            console.log('req.files is undefined');
            return;
        }
        
        var action = req.body.action;
        if (action === 'report') {
            var result = {
                originalname: req.files.file.originalname,
                filename: req.files.file.path,
                mimetype: req.files.file.mimetype
            };
            res.json(result);
        }
    });
*/
};

module.exports = UploadController;
