var cluster = require('cluster');
var watch = require('node-watch');
var AWS = require('aws-sdk');
var numCPUs = require('os').cpus().length;
var mime = require('mime');
var fs = require('fs');
var path = require('path');
var moment = require('moment');

var numReqs = 0;
var worker;
var confFile = process.argv[2] || './conf/config.json';
var config = require(confFile);
AWS.config.loadFromPath(confFile);
var s3 = new AWS.S3();
// mime.load('./conf/config_mime.types');
if (config.mimeConfig) {
    mime.load(config.mimeConfig);
} else {
    mime.load('./conf/config_mime.types');
};
var s3sync = new AWS.S3({endpoint: config.endpointSync});

if (cluster.isMaster) {
    for (var i = 0; i < numCPUs; i++) {
	worker = cluster.fork();

	watch(config.watchDir, function(filename) {

	    if (path.basename(filename).charAt(0) == ".") {
		console.log("SKIP hidden file: " + filename);
	    } else {
		worker.send({chat: filename+' is changed.', watchfile: filename});
	    }
	});
    }
} else {
    process.on('message', function(msg) {
	if (msg.watchfile) {
	    mtimeFile(msg.watchfile);
	};
    });
}

function mtimeFile(filename) {
    fs.stat(filename, function(err, stats) {
	if (err) {console.log(err)}
	else {
	    uploadingFile(filename, stats.mtime);
	}
    })
}

function uploadingFile(filename, mtime) {
    fs.readFile(filename, function(err, data) {
	if (err) {console.log(err)}
	else {	    
	    if (data.length == 0)
		console.log("No upload. Because filesize = "+ data.length);
	    else
	    {
		uploading(filename, mtime, data);
	    }
	}
    })
};


function uploading(filename, mtime, data) {
    var filepath;
    if (config.watchDir.indexOf("/") == 0)
	filepath = filename.replace(config.watchDir, "");
    else
	filepath = filename;
    filepath = filepath.replace(/^\//, "");

    var momentMtime = moment.utc(mtime);
    //  Last-Modified: Sun, 06 Apr 2014 22:53:47 GMT
    var metadataMtime = momentMtime.format("ddd, DD MMM YYYY HH:mm:ss [GMT]");

    if (config.mtimeToMetaData){
	var params = {
		Bucket: config.bucket,
		Key: config.topPrefix + filepath,
		Body: data,
		ContentType: mime.lookup(filename),
		Metadata: {
		    mtime: metadataMtime
		},
		StorageClass: config.storageClass
	};
	}
    else
    {
	var params = {
	    Bucket: config.bucket,
	    Key: config.topPrefix + filepath,
	    Body: data,
	    ContentType: mime.lookup(filename),
	    StorageClass: config.storageClass
	}
    };
	

    s3.putObject(params, function(err, data) {
	if (err){
            console.log("**** " + filename + " ****");
	    console.log(err);
	   }
	else {
	    console.log("Successfully uploaded data to " + config.bucket+'/'+params.Key+ ". ETag is " + data.ETag);
	    syncfile(filepath);
	}
    });
};

function syncfile(filename){
    var params = {
	Bucket: config.bucketSync,
	Key: config.topPrefixSync + filename,
	CopySource: encodeURIComponent(config.bucket+'/'+config.topPrefix+filename)
    };

    s3sync.copyObject(params, function(err,data){
	if (err)
            console.log(err)
	else {
	    console.log("Successfully synced from " + decodeURIComponent(params.CopySource) + " to " + params.Bucket + "/" + params.Key + ". LastModified is " + data.LastModified);
	}
    });
    
};
