'use strict';

const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const bucketName = "file-protector";
const tableName = "file-protector-prod";
const _ = require('lodash');
const mime = require('mime-types')

module.exports.submit = (event, context, callback) => {
  console.log("Request received");
  console.log('Key:', event.queryStringParameters.key)

  // var params = {
  //   TableName: tableName,//process.env.FILE_UPLOAD_TABLE,
  //   Key: {
  //     SecureCode: event.queryStringParameters.key,
  //   },
  //   ProjectionExpression: "SecureCode, OriginalFileName, GeneratedFileName, ProtectedFileName, SubmittedAt, UpdatedAt"
  // };

  var params = {
    TableName: tableName,
    KeyConditionExpression: "#sc = :SecureCode",
    ExpressionAttributeNames: {
      "#sc": "SecureCode"
    },
    ExpressionAttributeValues: {
      ":SecureCode": event.queryStringParameters.key
    }
  };


  console.log("Scanning file upload table.", event.queryStringParameters.key);
  // dynamoDb.get(params).promise()
  // .then(async result => {
  dynamoDb.query(params, async (err, result) => {
    if (err) {
      console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
      callback(new Error('Couldn\'t find the record.'));
      return;
    }
    else {
      console.log("Record found.", result);

      if (!result || _.isEmpty(result) || result.Items === 0 || _.isEmpty(result.Items)) {
        callback(new Error('Sorry, Couldn\'t find the record you are looking for.'));
      }

      const fileInfo = result.Items[0];
      var params = {
        "Bucket": bucketName,
        "Key": fileInfo.GeneratedFileName
      };

      var fileContent = '';
      try {
        fileContent = await getObject(bucketName, 'Outgoing/' + fileInfo.OriginalFileName);
        console.log("object Response:", fileContent)
      }
      catch (s3Ex) {
        console.log('S3 Exception', s3Ex);
        console.log('Copy file from source to destination');
        var copyParams = {
          Bucket: bucketName,
          CopySource: `${bucketName}/Protected/${fileInfo.ProtectedFileName}`,
          Key: `Unprotect/${fileInfo.ProtectedFileName}`
        };
        s3.copyObject(copyParams, function (err, data) {
          if (err)
            console.log(err, err); // an error occurred
          else {
            console.log(data); // successful response
          }
        });

        let response = {
          "statusCode": 202,
          "body": JSON.stringify('Your request has been accepted, we are working on this. Please try after sometime.'),
        };
        return callback(null, response);
      }

      let response = {
        "statusCode": 200,
        "headers": {
          "Content-Type": mime.lookup(fileInfo.OriginalFileName),
          "Content-Disposition": `attachment; filename=${fileInfo.OriginalFileName}`,
        },
        "body": fileContent,
        "isBase64Encoded": true
      };
      callback(null, response);
      // const response = {
      //   statusCode: 200,
      //   body: JSON.stringify(result.Item),
      // };
      // callback(null, response);

    }
  });
  // })
  // .catch(error => {
  //   console.error(error);
  //   callback(new Error('Couldn\'t find the record.'));
  //   return;
  // });
};

async function getObject(bucket, objectKey) {
  try {
    console.log('Output file path: ', `${objectKey}`);
    const params = {
      Bucket: bucket,
      Key: `${objectKey}`
    }

    const data = await s3.getObject(params).promise();
    console.log("data:", data);
    // return data.Body.toString('base64');
    return Buffer.from(data.Body).toString('base64')
  } catch (e) {
    throw new Error(`Could not retrieve file from S3: ${e.message}`)
  }
}