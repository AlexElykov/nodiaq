var mongoose = require('mongoose');
var DataTable = require('mongoose-datatable').default;
var runsModel;
var dbURI = process.env.RUNS_URI;
var runsdb = mongoose.connection;
var runs;
var runsTableSchema;
var xenon1tRunsSchema;
var xenon1t_runs_collection = process.env.RUNS_MONGO_COLLECTION_1T;

//DataTable.configure({ verbose: false, debug : false });
mongoose.plugin(DataTable.init);
mongoose.connect(dbURI, {authSource : process.env.RUNS_MONGO_AUTH_DB, useNewUrlParser:true, useUnifiedTopology: true});


runsdb.on('error', console.error.bind(console, 'connection error:'));
runsdb.once('open', function callback ()
	{
	    //console.log('Connection has succesfully opened');
	    var Schema = mongoose.Schema;
	    runsTableSchema = new Schema(
		{
		    number : {type: Number, required: true},
		    detectors: [String],
		    start : Date,
		    end : Date,
		    user: String,
		    mode: String,
		    source: { type: {type: String} },
		    
		    bootstrax: [{state: String, host: String, time: Date, started_processing: Date}],
		    tags: [ {user: String, date: Date, name: String} ],
		    comments: [{user: String, date: Date, text: String}],
		},
		{ collection: process.env.RUNS_MONGO_COLLECTION});
	    
	    // Legacy support for accessing XENON1T runs
	    xenon1tRunsSchema = new Schema(
		{
		    number: {type: Number, required: true},
		    detector: String,
		    start: Date,
		    end: Date,
		    user: String,
		    mode: String,
		    source: { type: {type: String} },
		    //bootstrax: {type: [{state: String, host: String, time: Date, started_processing: Date}], required: false}, // optional		
		    tags: [ {user: String, date: Date, name: String} ],
                    comments: [{user: String, date: Date, text: String}],
                },
		{ collection: xenon1t_runs_collection });
	    runs_1t = mongoose.model('runs_new', xenon1tRunsSchema);
	    runsModel1T = require('mongoose').model('runs_new');

	    runs = mongoose.model('runs', runsTableSchema);
	    runsModel = require('mongoose').model('runs');
	});

exports.getDataForDataTable = function getData (request, response) {

    var conditions = {};
    var detector = 'xenonnt';
    if(typeof request.query['detector'] !== 'undefined')
	detector = request.query['detector'];
    if(typeof request.query['conditions'] !== 'undefined')
	conditions = JSON.parse(request.query['conditions']);
    // Date filtering
    if(request.query['date_min'] !== undefined){
	if(request.query['date_min'] !== '' && 
	   request.query['date_max'] == '' && 
	   !('start' in Object.keys(conditions)))
	    conditions['start'] = {"$gt": new Date(request.query['date_min'])};
	else if(request.query['date_min'] !== '' &&
		request.query['date_max'] !== '' &&
		!('start' in Object.keys(conditions)))
	    conditions['start'] = {"$gt": new Date(request.query['date_min']),
				   "$lt": new Date(request.query['date_max'])};
	else if(request.query['date_min'] == '' &&
		request.query['date_max'] !== '' &&
		!('start' in Object.keys(conditions)))
	    conditions['start'] = {"$lt": new Date(request.query['date_max'])};
    }
    //console.log(conditions);
    if(detector == 'xenonnt'){
        runsModel.dataTable(request.query, {conditions: conditions})
        .then((data) => response.send(data))
        .catch(function(err) {
            console.log("RUNS DB ERROR " + err); return response.send({error: err})
        });
/*	runsModel.dataTable(request.query,  {"conditions": conditions}).then(
			    function (data) {
				response.send(data);
			    }).catch(
				function(err){
				    console.log('RUNS DB ERROR ' + err);
				});*/
    }else{
	var i = -1;
	var query = request.query;
	for(var j=0; j<query.columns.length; j+=1)
	    if(query.columns[j].data =='bootstrax')
		i=j;
	if(i != -1)
	    query.columns.splice(i, 1);
	runsModel1T.dataTable(query,  {"conditions": conditions}).then(
                            function (data) {
                                response.send(data);
                            }).catch(function(err){
				console.log("We had an error!");
				console.log(err);
			    });
    }
    
};
