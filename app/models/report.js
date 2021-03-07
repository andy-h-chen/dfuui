module.exports = function(mongoose) {
    var validator = require('../../lib/validator'),
        Schema    = mongoose.Schema,
        Report;

    Report = new Schema({
        user_id: {
            type: mongoose.Schema.Types.ObjectId, ref: 'User'
        },
        dfuid: { 
            type: String
            //required: true
        },
        files: [
            {
                filename: String,
                mimetype: String
            }
        ],
        content: {
            type: String
        },
        caregiverName: {
            type: String
        },
        date: {
            type: Date,
            default: Date.now
        }
    }, {collection: 'reports'});

    Report.statics.findByDFUId = function findByUserId(id, callback) {
        var Model = mongoose.model('Report');

        if (!id) {
            callback(null, null);
        } else {
            //Model.find().where('user_id', 'Object("' + id + '")').exec(callback);
            Model.find().where('dfuid').equals(id).sort({date: -1}).exec(callback);
        }
    };

    Report.set('toObject', {getters: true});
    return mongoose.model('Report', Report);
}
