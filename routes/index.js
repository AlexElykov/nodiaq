var express = require('express');
var url = require('url');
var router = express.Router();

function InsertRunDoc(req, res, host, callback){
    var db = req.runs_db;
    var collection = db.get('run');
    
   // Get most recent run doc and get it's number (we'll increment)
    collection.find(
	{},  { "sort": {"_id": -1}, "limit" : 1 },
	function(e, docs){
	    var run_identifier = 0;
	    if(docs.length>0)
		run_identifier = parseInt(docs[0]['run_identifier']) + 1;
	    // Nested callback time. Now we want the current run mode
	    // Gotta fail if we can't find it
	    var daxdb = req.db;
	    var daxcoll = daxdb.get('status');
	    daxcoll.find(
		{"host": host}, { "sort": {"_id": -1}, "limit" : 1 },
		function(e, sdoc){
		    run_mode = sdoc[0]['run_mode'];

		    // OK now that we have the run mode have to query the
		    // options collection to pull that mode and place into
		    // the run doc
		    var options_coll = daxdb.get('options');
		    options_coll.find(
			{"name": run_mode},
			function(e, odoc){
			    		    
			    run_doc = {
				"run_identifier": run_identifier,
				"user": "web",
				"start": new Date(),
				"readout": odoc[0]
			    }
			    collection.insert(run_doc);
			    callback(req, res, run_identifier);
			});
		});
	});
}

/* GET home page. */
router.get('/', function(req, res) {
    res.render('index', { title: 'Express' });
});

router.get('/arm', function(req,res){
    // Arm the DAQ with a specific settings doc
    
    // Get argument if there is one
    var q = url.parse(req.url, true).query;
    var mode = q.mode;
    if (typeof mode == 'undefined')
	mode = "test";
    console.log("THIS MODE");
    console.log(mode);
    var db = req.db;
    var collection = db.get('control');
    console.log("ARM");

    var idoc = {
	mode: mode,
	command: 'arm',
	host: 'fdaq00',
	user: 'web'
    };

    collection.insert(idoc);
    return res.redirect('/status');
});

router.get('/start', function(req, res){
    // Start an armed DAQ. This requires creation of a
    // unique run identifier and will insert a run document
    // into the runs database
    console.log("HERE");
    host = 'fdaq00';
    InsertRunDoc(req, res, host, function(req, res, run_identifier){
	var db = req.db;
	var collection = db.get('control');
	var idoc = {
	    run_identifier: run_identifier,
	    command: 'start',
	    host: host,
	    user: 'web'
	};
	collection.insert(idoc);
	return res.redirect('/status');
    });
});

router.get('/stop', function(req, res){

    // First get most recent status to see if DAQ running
    var daxdb = req.db;
    var daxcoll = daxdb.get('status');
    host = "fdaq00";
    daxcoll.find(
	{"host": host}, { "sort": {"_id": -1}, "limit" : 1 },
	function(e, sdoc){
	    s = sdoc[0]['status'];

	    // If running update run doc
	    console.log("HERE");
	    console.log(s);
	    if(s==3){
		console.log(sdoc[0]['current_run_id']);
		var rdb = req.runs_db;
		var rcoll = rdb.get("run");
		rcoll.update({"run_identifier": parseInt(sdoc[0]['current_run_id'])},
			     {"$set": {"stop": new Date()}});
	    }
	    
	    var db = req.db;
	    var collection = db.get('control');
	    var idoc = {
		command: 'stop',
		host: 'fdaq00',
		user: 'web'
	    };
	    collection.insert(idoc);
	    return res.redirect('/status');
	});
});

router.get('/log', function(req, res){
    var db = req.db;
    var collection = db.get('log');
    var q = url.parse(req.url, true).query;
    var limit = q.limit;
    if (typeof limit == 'undefined')
	limit = 10; //sure, why not
    collection.find({},  { "sort": {"_id": -1}, "limit" : parseInt(limit) },
		    function(e,docs){
			var ret = [];
			for(var i in docs){			    
			    var oid = new req.ObjectID(docs[i]['_id']);
			    var rd = {"time": oid.getTimestamp()};
			    for(var key in docs[i]){
				rd[key] = docs[i][key];
			    }			    
			    ret.push(rd);
			}			 
			return res.send(JSON.stringify(ret));
			});
});

router.get('/runs', function(req, res){
    var db = req.runs_db;
    var collection = db.get("run");
    var q = url.parse(req.url, true).query;
    var limit = q.limit;
    if(typeof limit == 'undefined')
	limit=5;
    collection.find({}, {"sort": {"_id": -1}, "limit": parseInt(limit)},
		    function(e, docs){
			return res.send(JSON.stringify(docs));
		    });
});
		   

    

router.get('/status_update', function(req, res){
    var db = req.db;
    var statuses = {
	0: "Idle",
	1: "Arming",
	2: "Armed",
	3: "Running",
	4: "Error"
    };
    var collection = db.get('status');
    var clients = {
	fdaq00: { status: 'none', rate: 0, buffer_length: 0}
    };
    for (var client in clients){
	docs = collection.find({"host": client},
			       { "sort": {"_id": -1}, "limit" : 1 },
			       function(e,docs){

				   if(docs.length>0){
				       for(var key in docs[0]){
					   clients[client]['status'] = statuses[docs[0].status];
					   clients[client][key] = docs[0][key];
				       }
				       // Overwrite status with human readable
				       clients[client]['status'] = statuses[docs[0].status];
				   }
				   return res.send(JSON.stringify(clients));
			       });
    }

    //    res.render('index', { clients: clients });
});

router.get('/modes', function(req,res){
    var db = req.db;
    var collection = db.get("options");
    var spromise = collection.distinct("name");
    spromise.then(function(doc){
	return res.send(JSON.stringify(doc));
    });
});
    
router.get('/status', function(req, res) {
    var clients = {
	fdaq00: { status: 'none', rate: 0, buffer_length: 0}
    };
    res.render('index', { clients: clients});
//    res.render('index', { clients: clients });
});

router.get('/helloworld', function(req, res){
    res.render('helloworld', {title: 'Hello, World!'});
});

module.exports = router;
