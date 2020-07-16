'use strict';

const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const bucketName = "file-protector";
const tableName = "file-protector-prod";
const _ = require('lodash');
const mime = require('mime-types')

module.exports.submit = async (event, context, callback) => {
  try {
    console.log("Request received");

    if (!event.queryStringParameters) {
      let response = {
        "statusCode": 400,
        "body": JSON.stringify(`parameters are missing.`),
      };

      return callback(null, response);
    }

    if (!event.queryStringParameters.key) {
      let response = {
        "statusCode": 400,
        "body": JSON.stringify(`Key is required.`),
      };
      callback(null, response);
      return;
    }

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

    console.log("Querying table.", event.queryStringParameters.key);
    const result = await dynamoDb.query(params).promise();
    console.log('result:', result);

    if (!result || _.isEmpty(result) || result.Items === 0 || _.isEmpty(result.Items)) {
      let response = {
        "statusCode": 404,
        "body": JSON.stringify(`Sorry, Couldn\'t find the record you are looking for.`),
      };
      callback(null, response);
      return;
    }

    const fileInfo = result.Items[0];
    var params = {
      "Bucket": bucketName,
      "Key": fileInfo.GeneratedFileName
    };

    const source = `${bucketName}/Protected/${fileInfo.ProtectedFileName}`;
    const destination = `Unprotect/${fileInfo.ProtectedFileName}`;
    const outgoing = `Outgoing/${fileInfo.OriginalFileName}`;
    var fileContent = '';
    try {
      fileContent = await getObject(bucketName, outgoing);
    }
    catch (s3Ex) {
      console.log('S3 Exception', s3Ex);
      await copyObject(bucketName, source, destination);

      let response = {
        "statusCode": 202,
        "body": JSON.stringify('Your request has been accepted, we are working on this. Please try after sometime.'),
      };

      callback(null, response);
      return;
    }

    await deleteObject(bucketName, outgoing);

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
    return;
  } catch (e) {
    console.error(e);
    let response = {
      "statusCode": 400,
      "body": JSON.stringify('Couldn\'t download the file.'),
    };

    callback(null, response);
  }
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
    // return Buffer.from(data.Body).toString('base64')
    return data.Body.toString('ascii');
  } catch (e) {
    throw new Error(`Could not retrieve file from S3: ${e.message}`)
  }
}

async function copyObject(bucket, copySource, key) {
  try {
    console.log('Copy object start', `${key}`);

    var params = {
      Bucket: bucket,
      CopySource: copySource,
      Key: key
    };

    const data = await s3.copyObject(params).promise();
    console.log("data:", data);
    console.log("file copied Successfully")
  } catch (e) {
    console.log("Can not copy file : ", err.code)
  }
}

async function deleteObject(bucket, key) {
  try {
    console.log('Delete object start', `${key}`);

    var params = {
      Bucket: bucket,
      Key: key
    };

    await s3.deleteObject(params).promise();
    console.log("file deleted Successfully")
  } catch (e) {
    console.log("File not Found error : ", err.code)
  }
}