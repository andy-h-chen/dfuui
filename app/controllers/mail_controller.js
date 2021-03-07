var utils    = require('../../lib/utils'),
    _        = require('underscore'),
    nodemailer = require('nodemailer'),
    NotFound = utils.NotFound,
    checkErr = utils.checkErr,
    log      = console.log,
    MailController;

MailController = function(app, config, ENV) {
    app.get(app.v1 + '/mail', app.ensureAuthenticated, function(req, res, next) {
        console.log(app.v1 + '/mail');
        var transporter = nodemailer.createTransport({
            host: config[ENV].SMTP,
            port: config[ENV].SMTP_PORT,
            auth: {
                user: 'auto@remotron.com',
                pass: '$10Aday'
            }
        });
        var mailOptions = {
            from: 'Auto <auto@remotron.com>', // sender address
            to: 'mrchenhuan@gmail.com, tchen@remotronic.com', // list of receivers
            subject: 'Test', // Subject line
            text: 'Hello world', // plaintext body
            html: '<b>Hello world.</b>' // html body
        };
        res.json({status: 'ok'});
        // send mail with defined transport object
        transporter.sendMail(mailOptions, function(error, info){
            if(error){
                console.log(error);
            }else{
                console.log('Message sent: ' + info.response);
            }
        });
    });

};

module.exports = MailController;
