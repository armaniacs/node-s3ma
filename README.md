node-s3-multisync-auto (node-s3ma)
============================================

Automatic local file backup to two of S3 buckets.

Your local PC directry (A) -> AWS S3 bucket (B) -> AWS S3 bucket (C)

1. node-s3-multisync-auto (node-s3ma) detects file modification under running directory (A).
2. node-s3ma uploads modified file form (A) to the AWS S3 bucket (B).
3. node-s3ma syncs uploaded file from (B) bucket to (C) bucket.

Setup
---------------
## Install

```
npm install node-watch aws-sdk mime moment
```

## Config

Please use config.json and config_mime.types under "conf" directory.

### conf/config.json

```
{
    "watchDir": "/tmp",
    "accessKeyId": "AKIA******",
    "secretAccessKey": "**********",
    "region": "us-west-2",
    "bucket": "*******-oregon", 
	
    "topPrefix": "backup/",
    "bucketSync": "**********-ireland",
    "topPrefixSync": "backup/",
    "endpointSync": "https://s3-eu-west-1.amazonaws.com"
}
```

* "accessKeyId": KeyId for S3.
* "secretAccessKey": Key for S3.

* "region": Bucket region of the 1st upload.
* "bucket": Bucket name of the 1st upload.
* "topPrefix": Bucket key prefix of the 1st upload.

* "bucketSync": Bucket name of the 2nd sync.
* "topPrefixSync": Bucket key prefix of the 2nd sync.
* "endpointSync": Bucket endpoint URL of the 2nd sync.

### conf/config_mime.types

```
application/x-test  test
```

It is come from https://npmjs.org/package/mime.

Use
---------

```
cd /home/account/target
node node-s3ma.js
```

TODO
---------

* Daemonize with forever (https://github.com/nodejitsu/forever).
* Multipart S3 uplord for large file.




