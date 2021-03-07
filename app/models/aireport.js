module.exports = function(mongoose) {
    var validator = require('../../lib/validator'),
        Schema    = mongoose.Schema,
        AIReport;
    AIReport = new Schema({
        reportType  :  {
            type     : String,
            required : true
        },
        dfuId : {
            type     : Number,
            required : true
        },
        streamId: {
            type: Number
        },
        text: {
            type: String
        },
        date: {
            type: Date,
            default: Date.now
        }
    }, {collection: 'alarm'});

    AIReport.statics.findByDfuId = function findByDfuId(dfuId, callback) {
        mongoose.model('AIReport').find().where('dfuId', dfuId).exec(callback);
    };
    AIReport.set('toObject', {getters: true});
    return mongoose.model('AIReport', AIReport);
}
