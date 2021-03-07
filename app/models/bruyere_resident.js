module.exports = function(mongoose) {
    var validator = require('../../lib/validator'),
        Schema    = mongoose.Schema,
        BruyereResident;

    BruyereResident = new Schema({
        name  :  {
			type     : String,
			trim     : true,
			required : true
        },
        room  :  {
            type : String,
            required : true
        },
		pic: {
			type: String,
			trim: true
		},
		dfuId: {
			type: Number,
			required: true
		}
    }, {collection: 'bruyere_residents'});

    // similar to SQL's like
    function like(query, field, val) {
        return (field) ? query.regex(field, new RegExp(val, 'i')) : query;
    }
	return mongoose.model('BruyereResident', BruyereResident);
}