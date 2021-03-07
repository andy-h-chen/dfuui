module.exports = function(mongoose) {
    var validator = require('../../lib/validator'),
        Schema    = mongoose.Schema,
        Dfu,
        Settings,
        settings_id = '559a077c722ee0486705d3fd';
    settingsSchema = new Schema({
        nextDfuId: { type: Number, default: 1000 }
    }, {collection: 'settings'});
    Settings = mongoose.model('Settings', settingsSchema);
    Dfu = new Schema({
       deviceId  :  {
            type     : String,
            required : true
        },
        dfuId : {
            type     : Number,
            unique   : true
        },
        deviceName: {
            type: String
        },
        background: {
            type: String
        },
        residentName :  {
			type: String,
			trim: true
        },
        residentRoom  :  {
            type: String,
			trim: true
        },
		residentPic: {
			type: String,
			trim: true
		},
        users_id: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}]
    }, {collection: 'dfu'});
    Dfu.index({'dfuId': 1}, {unique: true});
    Dfu.pre('save', function(next) {
        var doc = this;
        if (doc.isNew && (!doc.dfuId || doc.dfuId > 1000 )) {
            Settings.findByIdAndUpdate(settings_id, {$inc: {nextDfuId: 1}}, function (err, settings) {
                if (err) {
                    console.log(err);
                    next(err);
                }
                console.log(settings);
                doc.dfuId = settings.nextDfuId - 1;
                next();
            });
        }
    });
    Dfu.statics.findById = function(id, details, callback) {
        if (details) {
            mongoose.model('Dfu').findOne().where('_id', id).populate('users_id').exec(callback);
        } else {
            mongoose.model('Dfu').findOne().where('_id', id).exec(callback);
        }
    };

    Dfu.statics.findByDeviceId = function findByDeviceId(id, callback) {
        mongoose.model('Dfu').findOne().where('deviceId', id).exec(callback);
    };
    Dfu.statics.findByDfuId = function findByDfuId(id, details, callback) {
        if (details) {
            mongoose.model('Dfu').findOne().where('dfuId', id).populate('users_id').exec(callback);
        } else {
            mongoose.model('Dfu').findOne().where('dfuId', id).exec(callback);
        }
    };
    Dfu.methods.users = function (callback) {
        var User = mongoose.model('User');
        User.find({'_id': {$in: this.users_id}}).exec(callback);
    };
    Dfu.set('toObject', {getters: true});
    return mongoose.model('Dfu', Dfu);
}
